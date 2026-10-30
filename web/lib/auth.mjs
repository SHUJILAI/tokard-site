// Email sign-in with a one-time code. No passwords to leak or reuse.
// - The same answer for every email, so the form can't be used to find accounts.
// - A new email, or a known email on a new device, must pass the pixel puzzle first.
// - Codes are random, single use, 10 minutes, 5 tries, stored only as an HMAC.
// - Sends are capped per email, per IP and in total, so nobody can mail-bomb a
//   stranger or run up the email bill.
// - Sessions are random 256-bit tokens in an HttpOnly cookie; the database keeps a hash.

import { createHmac, randomInt } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { HttpError, enforce, randomId, sha256, safeEqual, cookie, parseCookies } from './security.mjs';

const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;
const SESSION_TTL = 30 * DAY, DEVICE_TTL = 400 * DAY;

// Throwaway inbox providers (extend with DISPOSABLE_DOMAINS="a.com,b.net")
const DISPOSABLE = new Set(('mailinator.com guerrillamail.com guerrillamail.info sharklasers.com grr.la 10minutemail.com 10minutemail.net tempmail.com temp-mail.org temp-mail.io '
  + 'tempmail.net tempmailo.com throwawaymail.com yopmail.com yopmail.net yopmail.fr getnada.com nada.email dispostable.com maildrop.cc mailnesia.com mintemail.com '
  + 'trashmail.com trashmail.de trashmail.net fakeinbox.com emailondeck.com moakt.com mohmal.com tempr.email discard.email mailpoof.com spamgourmet.com '
  + 'mytemp.email tempinbox.com burnermail.io inboxkitten.com mail.tm mail.gw linshiyouxiang.net 33mail.com mailcatch.com spambox.us').split(' '));

export const EMAIL_RE = /^[^\s@"<>()[\]\\,;:]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/i;

// One person, one identity: case, +tags and Gmail dots don't make a new account.
export function canonical(email) {
  let [local, domain] = String(email).trim().toLowerCase().split('@');
  if (!local || !domain) return '';
  local = local.split('+')[0];
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

export function createAuth({ db, limiter, human, mailer, secret, production, extraDisposable = [], sendsPerHourCap = 600, mxCheck = true }) {
  const disposable = new Set([...DISPOSABLE, ...extraDisposable.map((d) => d.trim().toLowerCase()).filter(Boolean)]);
  const codeHash = (canon, code) => createHmac('sha256', secret).update(`otp:${canon}:${code}`).digest('hex');
  const secure = production;

  async function domainOk(domain) {
    if (disposable.has(domain) || [...disposable].some((d) => domain.endsWith('.' + d))) return false;
    if (!mxCheck) return true;
    try { const mx = await Promise.race([dns.resolveMx(domain), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 4000))]); return Array.isArray(mx) && mx.length > 0; }
    catch (e) { return e && e.code === 'ENODATA' ? false : e && e.code === 'ENOTFOUND' ? false : !production; }
  }

  function deviceOf(req, res) {
    const c = parseCookies(req).tk_dev;
    if (c && /^[A-Za-z0-9_-]{22,64}$/.test(c)) return c;
    const d = randomId(18);
    res.appendHeader?.('Set-Cookie', cookie('tk_dev', d, { maxAge: DEVICE_TTL / 1000, secure }));
    return d;
  }

  return {
    deviceOf,
    // step 1: send a code. Returns { ok } for every valid email, or 428 when the puzzle is needed.
    async start(req, res, body, ip) {
      const email = String(body.email || '').trim().slice(0, 254);
      if (!EMAIL_RE.test(email)) throw new HttpError(400, "That doesn't look like an email address.");
      const canon = canonical(email), domain = canon.split('@')[1];
      enforce(limiter, [[`otp:ip:${ip}`, 10, HOUR], [`otp:ipd:${ip}`, 30, DAY]]);
      if (!(await domainOk(domain))) throw new HttpError(400, 'Use an email address you can receive mail at. Temporary inboxes are not accepted.');
      const device = deviceOf(req, res);
      const user = db.get('SELECT id, status FROM users WHERE canon = ?', canon);
      if (user && user.status === 'banned') return { ok: true };   // same answer; no email goes out
      const knownDevice = user && db.get('SELECT 1 AS k FROM devices WHERE user_id = ? AND device = ?', user.id, device);
      if (!knownDevice) {
        if (!human.spend(body.human)) throw new HttpError(428, 'One quick check first.', { code: 'human_needed' });
        if (!(await human.turnstile(body.cf, ip))) throw new HttpError(428, 'One quick check first.', { code: 'human_needed' });
      }
      // Per-inbox caps count only real sends, and the owner's own devices have their
      // own bucket, so a stranger spamming someone's address can't lock them out.
      const lane = knownDevice ? 'k' : 'u';
      enforce(limiter, [[`otp:em:${canon}:${lane}`, 5, HOUR], [`otp:emd:${canon}:${lane}`, 10, DAY], ['otp:all', sendsPerHourCap, HOUR]]);
      const last = db.get('SELECT created FROM otp WHERE canon = ? ORDER BY created DESC LIMIT 1', canon);
      if (last && last.created > Date.now() - 30e3) throw new HttpError(429, 'A code is already on its way. Wait 30 seconds to ask again.', { retryAfter: 30 });
      const code = String(randomInt(0, 1e6)).padStart(6, '0');
      db.tx(() => {
        db.run('UPDATE otp SET used = 1 WHERE canon = ? AND used = 0', canon);
        db.run('INSERT INTO otp (canon, code_hash, created, expires, ip) VALUES (?, ?, ?, ?, ?)', canon, codeHash(canon, code), Date.now(), Date.now() + 10 * MIN, ip);
      });
      await mailer.sendCode(email, code);
      db.audit('otp.sent', { detail: sha256(canon).slice(0, 16), ip });
      return { ok: true };
    },

    // step 2: check the code, create the account on first sign-in, open a session
    verify(req, res, body, ip, { refCode = '' } = {}) {
      const email = String(body.email || '').trim().slice(0, 254), code = String(body.code || '');
      if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) throw new HttpError(400, 'Enter the 6-digit code from the email.');
      const canon = canonical(email);
      enforce(limiter, [[`ver:ip:${ip}`, 30, HOUR], [`ver:em:${canon}`, 15, HOUR]]);
      const device = deviceOf(req, res);
      const row = db.get('SELECT * FROM otp WHERE canon = ? AND used = 0 ORDER BY created DESC LIMIT 1', canon);
      if (!row || row.expires < Date.now()) throw new HttpError(400, 'That code has expired. Ask for a new one.');
      if (row.attempts >= 5) { db.run('UPDATE otp SET used = 1 WHERE id = ?', row.id); throw new HttpError(400, 'Too many wrong codes. Ask for a new one.'); }
      if (!safeEqual(row.code_hash, codeHash(canon, code))) {
        db.run('UPDATE otp SET attempts = attempts + 1 WHERE id = ?', row.id);
        throw new HttpError(400, "That code isn't right.", { left: Math.max(0, 4 - row.attempts) });
      }
      const token = randomId(32);
      const user = db.tx(() => {
        db.run('UPDATE otp SET used = 1 WHERE id = ?', row.id);
        let u = db.get('SELECT * FROM users WHERE canon = ?', canon);
        if (!u) {
          const referrer = refCode ? db.get('SELECT id FROM users WHERE ref_code = ?', refCode) : null;
          const r = db.run('INSERT INTO users (email, canon, created, ref_code, referred_by, signup_ip, signup_device) VALUES (?, ?, ?, ?, ?, ?, ?)',
            email, canon, Date.now(), randomId(5).toLowerCase().replace(/[^a-z0-9]/g, 'x'), referrer ? referrer.id : null, ip, device);
          u = db.get('SELECT * FROM users WHERE id = ?', Number(r.lastInsertRowid));
          if (referrer) db.run('INSERT INTO referrals (friend_id, referrer_id, created) VALUES (?, ?, ?)', u.id, referrer.id, Date.now());
        }
        if (u.status === 'banned') throw new HttpError(403, 'This account is closed. Write to support if you think that is a mistake.');
        db.run('UPDATE users SET last_login = ? WHERE id = ?', Date.now(), u.id);
        db.run('INSERT OR IGNORE INTO devices (user_id, device, first_seen) VALUES (?, ?, ?)', u.id, device, Date.now());
        db.run('INSERT INTO logins (user_id, at, ip, device) VALUES (?, ?, ?, ?)', u.id, Date.now(), ip, device);
        db.run('INSERT INTO sessions (hash, user_id, created, expires, last_seen, ip) VALUES (?, ?, ?, ?, ?, ?)', sha256(token), u.id, Date.now(), Date.now() + SESSION_TTL, Date.now(), ip);
        return u;
      });
      res.appendHeader('Set-Cookie', cookie('tk_sess', token, { maxAge: SESSION_TTL / 1000, secure }));
      db.audit('login', { user: user.id, ip });
      return { email: user.email };
    },

    // who is this? (null when signed out). Sliding renewal once a day.
    user(req) {
      const t = parseCookies(req).tk_sess;
      if (!t || !/^[A-Za-z0-9_-]{40,64}$/.test(t)) return null;
      const s = db.get('SELECT s.hash, s.user_id, s.expires, s.last_seen, u.email, u.status, u.tickets, u.ref_code FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = ?', sha256(t));
      if (!s || s.expires < Date.now() || s.status === 'banned') return null;
      if (s.last_seen < Date.now() - DAY) db.run('UPDATE sessions SET last_seen = ?, expires = ? WHERE hash = ?', Date.now(), Date.now() + SESSION_TTL, s.hash);
      return { id: s.user_id, email: s.email, tickets: s.tickets, refCode: s.ref_code };
    },
    logout(req, res) {
      const t = parseCookies(req).tk_sess;
      if (t) db.run('DELETE FROM sessions WHERE hash = ?', sha256(t));
      res.appendHeader('Set-Cookie', cookie('tk_sess', '', { maxAge: 0, secure }));
    },
    logoutEverywhere(userId) { db.run('DELETE FROM sessions WHERE user_id = ?', userId); },
  };
}
