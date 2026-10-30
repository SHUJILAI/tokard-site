// Tokard web: the site, the Studio agent, the public API edge (/v1), and Tokard's
// own accounts and card economy (/api). Plain Node 22, no dependencies.
// Security model and abuse rules: see SECURITY.md.

import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { createGateway } from './lib/gateway.mjs';
import { createMockGateway } from './lib/mock.mjs';
import { runAgent } from './lib/agent.mjs';
import { openDb } from './lib/db.mjs';
import { createHuman } from './lib/human.mjs';
import { createMailer } from './lib/mail.mjs';
import { createAuth } from './lib/auth.mjs';
import { createIssuer } from './lib/issuer.mjs';
import { createStripe } from './lib/stripe.mjs';
import { createCards } from './lib/cards.mjs';
import { checkPrompt, promptOf } from './lib/moderation.mjs';
import { HttpError, Limiter, enforce, clientIpFactory, cspFor, BASE_HEADERS, checkOrigin, readBody, readJson, safePath, sealer as makeSealer, rid, parseCookies, cookie } from './lib/security.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, 'public');
const env = process.env;
const MOCK = env.MOCK === '1' || env.MOCK === 'true';
const PRODUCTION = env.NODE_ENV === 'production' && !MOCK;

// ---------- configuration (refuses to start in production with weak or missing secrets) ----------
function secret(name, { bytes = 32, b64 = false } = {}) {
  const v = env[name] || '';
  const weak = !v || /change-?me|example|secret|password/i.test(v) || v.length < (b64 ? 40 : 32);
  if (weak && PRODUCTION) { console.error(`Refusing to start: ${name} is missing or weak.`); process.exit(1); }
  if (weak) { const gen = randomBytes(bytes).toString(b64 ? 'base64' : 'hex'); console.warn(`[dev] ${name} not set; using a temporary random value.`); return gen; }
  return v;
}
const ALIASES = { image: 'doubao-seedream-5-0-pro-260628', video: 'doubao-seedance-2-5-260628', ...(env.MODEL_ALIASES ? JSON.parse(env.MODEL_ALIASES) : {}) };
const PUBLIC_NAMES = { ...Object.fromEntries(Object.entries(ALIASES).map(([a, r]) => [r, a])), [env.TEXT_UPSTREAM_MODEL || 'deepseek-flash']: 'text' };
const PINS = { 'text@2026-10': 'text', 'image@2026-10': ALIASES.image, 'video@2026-10': ALIASES.video, ...(env.MODEL_PINS ? JSON.parse(env.MODEL_PINS) : {}) };
function ladder(spec) {
  const steps = String(spec).split(',').map((x) => x.split(':').map(Number)).filter(([v, o]) => v > 0 && o >= 0 && o < 60).sort((a, b) => a[0] - b[0]);
  if (!steps.length) { console.error(`Refusing to start: bad shop ladder "${spec}".`); process.exit(1); }
  return steps;
}
const CONFIG = {
  port: parseInt(env.PORT || '8080', 10),
  siteUrl: (env.SITE_URL || `http://localhost:${env.PORT || 8080}`).replace(/\/+$/, ''),
  gatewayUrl: env.GATEWAY_URL || 'http://new-api:3000',
  publicApiUrl: env.PUBLIC_API_URL || 'https://api.tokard.ai',
  trialKey: env.STUDIO_TRIAL_KEY || '',
  trialPerDay: parseInt(env.STUDIO_TRIAL_PER_DAY || '10', 10),
  trialVideo: env.STUDIO_TRIAL_VIDEO === '1',
  models: { text: env.MODEL_TEXT || 'text', image: env.MODEL_IMAGE || ALIASES.image, video: env.MODEL_VIDEO || ALIASES.video },
  vision: env.TEXT_VISION !== '0',
  trustHops: parseInt(env.TRUST_PROXY_HOPS || (PRODUCTION ? '1' : '0'), 10),
  jackpotsPerDay: parseInt(env.JACKPOTS_PER_DAY || '20', 10),
  flipsPerIpPerDay: parseInt(env.FLIPS_PER_IP_PER_DAY || '30', 10),
  // "face:%off,..." per deck. Coding 8.5/8/7.5折, Film 9/8.6/8.3折, Design at face value for now.
  shopLadder: { text: ladder(env.SHOP_LADDER_TEXT || '5:15,20:20,100:25'), image: ladder(env.SHOP_LADDER_IMAGE || '5:0,20:0,100:0'), video: ladder(env.SHOP_LADDER_VIDEO || '5:10,20:14,100:17') },
  flipFloor: Math.min(1, Math.max(0, +(env.FLIP_FLOOR_RATIO ?? 0.6))),
  // one $100 card at $0.10 per ULTIMATE_EVERY cards sold; claimable after ULTIMATE_NEED_USD of purchases
  // gold within five: the fifth flip in a row without gold is a Lucky card at this share of face value
  pity: { every: Math.max(2, parseInt(env.PITY_EVERY || '5', 10)), ratio: Math.min(0.75, Math.max(+(env.FLIP_FLOOR_RATIO ?? 0.6), +(env.PITY_PRICE_RATIO ?? 0.7))) },
  ultimate: { every: parseInt(env.ULTIMATE_EVERY || '10000', 10), odds: parseInt(env.ULTIMATE_ODDS || '1000', 10), needCents: Math.round(+(env.ULTIMATE_NEED_USD ?? 20) * 100) },
  legacyAccounts: env.LEGACY_ACCOUNTS === '1',
  turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
};
const SESSION_SECRET = secret('SESSION_SECRET');
const sealer = makeSealer(secret('KEY_ENC_SECRET', { b64: true }));
if (PRODUCTION) for (const k of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'ISSUER_TOKEN', 'RESEND_API_KEY', 'MAIL_FROM', 'SITE_URL']) if (!env[k]) { console.error(`Refusing to start: ${k} is not set.`); process.exit(1); }
if (PRODUCTION && !CONFIG.siteUrl.startsWith('https://')) { console.error('Refusing to start: SITE_URL must be https.'); process.exit(1); }

const db = openDb(MOCK ? ':memory:' : join(env.DATA_DIR || join(HERE, 'data'), 'tokard.sqlite'));
const limiter = new Limiter();
const clientIp = clientIpFactory(CONFIG.trustHops);
const human = createHuman({ db, secret: SESSION_SECRET, turnstileSecret: env.TURNSTILE_SECRET || '' });
const mailer = createMailer({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM, dev: env.MAIL_DEV === '1', production: PRODUCTION });
const auth = createAuth({ db, limiter, human, mailer, secret: SESSION_SECRET, production: PRODUCTION, extraDisposable: (env.DISPOSABLE_DOMAINS || '').split(','), sendsPerHourCap: parseInt(env.EMAIL_SENDS_PER_HOUR || '600', 10), mxCheck: env.EMAIL_MX_CHECK !== '0' });
const issuer = createIssuer({ baseUrl: CONFIG.gatewayUrl, token: env.ISSUER_TOKEN || '', quotaPerUsd: parseInt(env.QUOTA_PER_USD || '500000', 10), models: CONFIG.models });
const stripe = createStripe({ secretKey: env.STRIPE_SECRET_KEY || '', webhookSecret: env.STRIPE_WEBHOOK_SECRET || '', apiBase: env.STRIPE_API_BASE || 'https://api.stripe.com' });
const cards = createCards({ db, limiter, issuer, stripe, sealer, config: { ...CONFIG, siteUrl: CONFIG.siteUrl } });
const ORIGINS = [CONFIG.siteUrl, ...(PRODUCTION ? [] : [`http://localhost:${CONFIG.port}`, `http://127.0.0.1:${CONFIG.port}`])];

// the gateway client, with the same prompt check the public API uses
const rawGw = MOCK ? createMockGateway({ samplesDir: join(PUBLIC, 'samples') }) : createGateway({ baseUrl: CONFIG.gatewayUrl, models: CONFIG.models });
const gw = {
  ...rawGw,
  generateImage(a) { const why = checkPrompt(a.prompt); if (why) throw Object.assign(new Error(why), { status: 400 }); return rawGw.generateImage(a); },
  createVideo(a) { const why = checkPrompt(a.prompt); if (why) throw Object.assign(new Error(why), { status: 400 }); return rawGw.createVideo(a); },
};

// ---------- small helpers ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };
function send(res, status, body, headers = {}) {
  if (res.headersSent) return res.end();
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...BASE_HEADERS, ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
const bearer = (req) => { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7).trim() : ''; };
const needUser = (req) => { const u = auth.user(req); if (!u) throw new HttpError(401, 'Sign in first.'); return u; };

// media links: short-lived, unguessable, bounded
const mediaLinks = new Map();
const media = {
  register({ key, taskId }) {
    if (mediaLinks.size > 20000) for (const k of [...mediaLinks.keys()].slice(0, 5000)) mediaLinks.delete(k);
    const token = randomBytes(18).toString('base64url');
    mediaLinks.set(token, { key, taskId, expires: Date.now() + 24 * 3600e3 });
    return '/api/media/' + token;
  },
};

// ---------- static files ----------
const PAGES = { '/': 'index.html', '/flip': 'cards.html', '/shop': 'shop.html', '/wallet': 'console.html', '/playground': 'playground.html', '/studio': 'studio.html' };
function serveStatic(req, res, pathname) {
  const rel = PAGES[pathname.replace(/\/+$/, '') || '/'] || pathname;
  const file = safePath(PUBLIC, rel.startsWith('/') ? rel : '/' + rel);
  let st;
  try { st = file && statSync(file); } catch { st = null; }
  if (!st || !st.isFile()) return send(res, 404, '<!doctype html><meta charset="utf-8"><title>Not found</title><p>Not found. <a href="/">Tokard</a></p>', { 'Content-Type': 'text/html; charset=utf-8' });
  const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { ...BASE_HEADERS, 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': type.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600' };
  if (type.startsWith('text/html')) headers['Content-Security-Policy'] = cspFor(file, { scriptHosts: ['https://cdn.jsdelivr.net/npm/morphicons@1.7.1/', 'https://challenges.cloudflare.com'], connect: ['https://cdn.jsdelivr.net'], img: ['https:'] });
  if (PRODUCTION) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  const range = req.headers.range;
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? parseInt(m[1], 10) : st.size - parseInt(m[2], 10);
    let end = m[1] && m[2] ? parseInt(m[2], 10) : st.size - 1;
    if (end >= st.size) end = st.size - 1;
    if (!(start >= 0) || start > end) return send(res, 416, { error: 'Range not satisfiable' }, { 'Content-Range': `bytes */${st.size}` });
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    return req.method === 'HEAD' ? res.end() : createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': st.size });
  return req.method === 'HEAD' ? res.end() : createReadStream(file).pipe(res);
}

// ---------- Studio ----------
function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-24).map((m) => ({
    role: m && m.role === 'assistant' ? 'assistant' : 'user',
    text: String((m && m.text) || '').slice(0, 20000),
    images: Array.isArray(m && m.images) ? m.images.filter((u) => typeof u === 'string' && (/^data:image\/(png|jpe?g|webp);base64,/.test(u) || /^https:\/\//.test(u)) && u.length < 8e6).slice(0, 4) : [],
    media: Array.isArray(m && m.media) ? m.media.filter((x) => x && typeof x.url === 'string').slice(0, 8).map((x) => ({ kind: x.kind === 'video' ? 'video' : 'image', url: String(x.url).slice(0, 4000), prompt: String(x.prompt || '').slice(0, 2000) })) : [],
  }));
}
async function handleChat(req, res, ip) {
  const body = await readJson(req, 25 * 1024 * 1024);
  const history = cleanHistory(body.messages);
  const mode = ['auto', 'text', 'image', 'video'].includes(body.mode) ? body.mode : 'auto';
  let key = bearer(req), trial = false;
  if (!key && MOCK) key = 'demo';
  if (!key && CONFIG.trialKey) {
    const u = auth.user(req);
    if (!u) throw new HttpError(401, 'Sign in to try Studio, or add a card key.');
    if (db.bump(`trial:${u.id}:${new Date().toISOString().slice(0, 10)}`, Date.now() + 86400e3) > CONFIG.trialPerDay) throw new HttpError(429, "You've used today's free tries. Add a card key to keep going.");
    enforce(limiter, [[`trial:ip:${ip}`, CONFIG.trialPerDay * 3, 86400e3]]);
    key = CONFIG.trialKey; trial = true;
  }
  if (!key) throw new HttpError(401, 'Add a card key to start.');
  if (!history.length) throw new HttpError(400, 'Write a message first.');
  enforce(limiter, [[`chat:ip:${ip}`, 60, 60e3]]);
  res.writeHead(200, { ...BASE_HEADERS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const controller = new AbortController();
  res.on('close', () => controller.abort());
  const emit = (ev) => { if (!res.writableEnded) res.write('data: ' + JSON.stringify(ev) + '\n\n'); };
  const ping = setInterval(() => { if (!res.writableEnded) res.write(': ping\n\n'); }, 15000);
  emit({ t: 'start', mode, trial });
  try {
    await runAgent({ gw, key, history, mode, emit, signal: controller.signal, media, limits: { video: trial ? CONFIG.trialVideo : true, vision: CONFIG.vision, pollMs: MOCK ? 800 : 4000 } });
  } catch (err) {
    if (!controller.signal.aborted) emit({ t: 'error', message: err.status === 401 || err.status === 403 ? 'This key was not accepted.' : err.status === 400 ? err.message : 'Something went wrong. Try again.' });
  } finally { clearInterval(ping); res.end(); }
}
async function handleMedia(req, res, token) {
  const link = mediaLinks.get(token);
  if (!link || link.expires < Date.now()) return send(res, 404, { error: 'This video link has expired.' });
  const up = await gw.videoContent({ key: link.key, id: link.taskId, range: req.headers.range });
  if (!up.ok && up.status !== 206) return send(res, up.status === 404 ? 404 : 502, { error: 'The video is not available yet.' });
  const headers = { ...BASE_HEADERS, 'Content-Type': /^video\//.test(up.headers.get('content-type') || '') ? up.headers.get('content-type') : 'video/mp4', 'Cache-Control': 'private, max-age=3600', 'Accept-Ranges': 'bytes' };
  for (const h of ['content-length', 'content-range']) if (up.headers.get(h)) headers[h] = up.headers.get(h);
  res.writeHead(up.status, headers);
  Readable.fromWeb(up.body).on('error', () => res.end()).pipe(res);
}

// ---------- public API edge: api.<domain>/v1 ----------
function resolveModel(name) {
  if (ALIASES[name]) return ALIASES[name];
  if (PINS[name]) return ALIASES[PINS[name]] || PINS[name];
  const m = /^(text|image|video)@/.exec(name);
  if (m) throw new HttpError(400, `Unknown version "${name}". Use "${m[1]}" for the newest.`);
  return name;
}
const publicName = (n) => PUBLIC_NAMES[n] || n;
const MODEL_FIELD = /"model"\s*:\s*"([^"]+)"/g;
// Only these headers reach the gateway; X-Forwarded-For is rebuilt from the real address.
const EDGE_HEADERS = ['authorization', 'content-type', 'accept', 'accept-language', 'user-agent', 'openai-organization', 'openai-project', 'x-stainless-lang', 'anthropic-version', 'anthropic-beta', 'x-api-key'];
async function handleApiEdge(req, res, url, ip) {
  const key = bearer(req) || String(req.headers['x-api-key'] || '');
  enforce(limiter, [[`edge:ip:${ip}`, 1200, 60e3], ...(key ? [[`edge:key:${key.slice(-16)}`, 600, 60e3]] : [])]);
  let body = Buffer.alloc(0);
  if (req.method !== 'GET' && req.method !== 'HEAD') body = await readBody(req, 25 * 1024 * 1024);
  const contentType = req.headers['content-type'] || '';
  if (body.length && /application\/json/i.test(contentType)) {
    let j = null;
    try { j = JSON.parse(body.toString('utf8')); } catch { /* not JSON: pass through */ }
    if (j && typeof j === 'object') {
      if (/\/(images|videos|video)\b/.test(url.pathname)) { const why = checkPrompt(promptOf(j)); if (why) { db.audit('edge.blocked', { detail: why, ip }); throw new HttpError(400, why); } }
      if (typeof j.model === 'string') { const real = resolveModel(j.model); if (real !== j.model) { j.model = real; body = Buffer.from(JSON.stringify(j)); } }
    }
  } else if (body.length && /multipart\/form-data/i.test(contentType)) {
    const text = body.toString('latin1');
    const out = text.replace(/(name="model"\r\n(?:[^\r\n]+\r\n)*\r\n)([^\r\n]+)(\r\n)/, (m, head, value, tail) => head + resolveModel(value) + tail);
    const p = /name="prompt"\r\n(?:[^\r\n]+\r\n)*\r\n([^\r]*)\r\n/.exec(text);
    if (p) { const why = checkPrompt(Buffer.from(p[1], 'latin1').toString('utf8')); if (why) throw new HttpError(400, why); }
    if (out !== text) body = Buffer.from(out, 'latin1');
  }
  const headers = {};
  for (const h of EDGE_HEADERS) if (req.headers[h]) headers[h] = req.headers[h];
  headers['x-forwarded-for'] = ip; headers['x-real-ip'] = ip;
  const controller = new AbortController();
  res.on('close', () => controller.abort());
  let up;
  try {
    up = await fetch(CONFIG.gatewayUrl.replace(/\/+$/, '') + url.pathname + url.search, { method: req.method, headers, body: body.length ? body : undefined, signal: controller.signal, redirect: 'manual' });
  } catch (err) {
    if (controller.signal.aborted) return;
    return send(res, 502, { error: { message: 'The gateway is not reachable right now.' } });
  }
  const outHeaders = {};
  up.headers.forEach((v, k) => { if (!['content-length', 'content-encoding', 'transfer-encoding', 'connection', 'set-cookie', 'server'].includes(k)) outHeaders[k] = v; });
  outHeaders['x-content-type-options'] = 'nosniff';
  const type = up.headers.get('content-type') || '';
  if (/application\/json/i.test(type)) {
    const text = await up.text();
    let out = text;
    try {
      const data = JSON.parse(text);
      if (url.pathname === '/v1/models' && Array.isArray(data.data)) { const seen = new Set(); data.data = data.data.map((m) => ({ ...m, id: publicName(m.id) })).filter((m) => !seen.has(m.id) && seen.add(m.id)); }
      else if (data && typeof data.model === 'string') data.model = publicName(data.model);
      out = JSON.stringify(data);
    } catch { /* leave as is */ }
    res.writeHead(up.status, { ...outHeaders, 'content-length': Buffer.byteLength(out) });
    return res.end(out);
  }
  if (/text\/event-stream/i.test(type) && up.body) {
    res.writeHead(up.status, outHeaders);
    const decoder = new TextDecoder(); let pending = '';
    try {
      for await (const chunk of up.body) {
        pending += decoder.decode(chunk, { stream: true });
        const cut = pending.lastIndexOf('\n'); if (cut < 0) continue;
        res.write(pending.slice(0, cut + 1).replace(MODEL_FIELD, (m, n) => `"model":"${publicName(n)}"`));
        pending = pending.slice(cut + 1);
      }
      if (pending) res.write(pending.replace(MODEL_FIELD, (m, n) => `"model":"${publicName(n)}"`));
    } catch { /* client went away */ }
    return res.end();
  }
  res.writeHead(up.status, up.headers.get('content-length') ? { ...outHeaders, 'content-length': up.headers.get('content-length') } : outHeaders);
  if (!up.body || req.method === 'HEAD') return res.end();
  Readable.fromWeb(up.body).on('error', () => res.end()).pipe(res);
}

// ---------- Tokard API ----------
async function handleApi(req, res, url, ip) {
  const p = url.pathname, m = req.method;
  const json = (status, body) => send(res, status, body);

  // Stripe calls us directly: no cookies, no origin, signature only
  if (m === 'POST' && p === '/api/stripe/webhook') {
    const raw = await readBody(req, 1024 * 1024);
    return json(200, await cards.webhook(raw, req.headers['stripe-signature']));
  }
  if (m !== 'GET' && m !== 'HEAD') checkOrigin(req, ORIGINS);

  // remember who invited this visitor (set by /?ref=, 30 days, never overwritten)
  const refCode = parseCookies(req).tk_ref || '';

  if (m === 'GET' && p === '/api/me') { const u = auth.user(req); return u ? json(200, { email: u.email, tickets: u.tickets, ...cards.spending(u.id) }) : json(401, { error: 'Signed out' }); }
  if (m === 'POST' && p === '/api/auth/human') { enforce(limiter, [[`human:ip:${ip}`, 30, 3600e3]]); return json(200, human.challenge(ip)); }
  if (m === 'POST' && p === '/api/auth/human/verify') { enforce(limiter, [[`humanv:ip:${ip}`, 60, 3600e3]]); return json(200, human.verify(await readJson(req, 64 * 1024))); }
  if (m === 'POST' && p === '/api/auth/start') return json(200, await auth.start(req, res, await readJson(req), ip));
  if (m === 'POST' && p === '/api/auth/verify') return json(200, auth.verify(req, res, await readJson(req), ip, { refCode: /^[a-z0-9]{4,16}$/.test(refCode) ? refCode : '' }));
  if (m === 'POST' && p === '/api/auth/logout') { auth.logout(req, res); return json(200, { ok: true }); }

  const user = needUser(req);
  const device = parseCookies(req).tk_dev || '';
  if (m === 'GET' && p === '/api/hand') return json(200, cards.hand(user.id));
  if (m === 'GET' && p === '/api/offers') return json(200, { offers: cards.history(user.id) });
  if (m === 'POST' && p === '/api/flip') { const b = await readJson(req); return json(200, cards.flip(user.id, String(b.deck || ''), { ip, device })); }
  if (m === 'POST' && p === '/api/reflip') { const b = await readJson(req); return json(200, cards.reflip(user.id, String(b.deck || ''), { ip })); }
  if (m === 'GET' && p === '/api/invite') return json(200, { link: cards.inviteLink(user.id), tickets: user.tickets });
  if (m === 'POST' && p === '/api/checkout') { const b = await readJson(req); return json(200, await cards.checkout(user, { offerId: b.offerId, deck: b.deck, value: b.value, refillCardId: b.refillCardId }, { ip })); }
  if (m === 'GET' && p === '/api/cards') return json(200, { cards: await cards.list(user.id) });
  const cm = /^\/api\/cards\/([A-Za-z0-9_-]{6,32})(\/(reveal|freeze|unfreeze))?$/.exec(p);
  if (cm) {
    const id = cm[1], action = cm[3];
    if (m === 'POST' && action === 'reveal') return json(200, cards.reveal(user.id, id, { ip }));
    if (m === 'POST' && action === 'freeze') return json(200, await cards.setFrozen(user.id, id, true));
    if (m === 'POST' && action === 'unfreeze') return json(200, await cards.setFrozen(user.id, id, false));
    if (m === 'PATCH' && !action) { const b = await readJson(req); return json(200, cards.rename(user.id, id, b.label)); }
    if (m === 'DELETE' && !action) return json(200, await cards.remove(user.id, id));
  }
  throw new HttpError(404, 'Not found');
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const id = rid(), t0 = Date.now();
  const ip = clientIp(req);
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { return send(res, 400, { error: 'Bad request' }); }
  const p = url.pathname;
  res.on('finish', () => { if (p.startsWith('/api/') || p.startsWith('/v1')) console.log(JSON.stringify({ t: new Date().toISOString(), id, ip, m: req.method, p: p.replace(/\/api\/(media|cards)\/[^/]+/, '/api/$1/:id'), s: res.statusCode, ms: Date.now() - t0 })); });
  try {
    if (req.method === 'GET' && p === '/config.json') return send(res, 200, { demo: MOCK, live: !MOCK, apiUrl: CONFIG.publicApiUrl, turnstileSiteKey: CONFIG.turnstileSiteKey, shopLadder: CONFIG.shopLadder });
    if (req.method === 'GET' && p === '/healthz') return send(res, 200, { ok: true });
    if (p === '/v1' || p.startsWith('/v1/')) {
      if (MOCK) return send(res, 503, { error: { message: 'The public API is off in demo mode.' } });
      return await handleApiEdge(req, res, url, ip);
    }
    if (req.method === 'POST' && p === '/api/chat') { checkOrigin(req, ORIGINS); return await handleChat(req, res, ip); }
    if (req.method === 'POST' && p === '/api/key/check') {
      checkOrigin(req, ORIGINS); enforce(limiter, [[`keycheck:ip:${ip}`, 30, 3600e3]]);
      const key = bearer(req); if (!key) throw new HttpError(400, 'Paste a key first.');
      try { return send(res, 200, { ok: true, models: [...new Set((await gw.checkKey(key)).map(publicName))] }); } catch (err) { return send(res, 200, { ok: false, error: err.status === 401 ? 'This key was not accepted.' : 'The key could not be checked right now.' }); }
    }
    if (req.method === 'GET' && p.startsWith('/api/media/')) return await handleMedia(req, res, p.slice('/api/media/'.length));
    if (p.startsWith('/api/')) return await handleApi(req, res, url, ip);
    if (req.method === 'GET' || req.method === 'HEAD') {
      const ref = url.searchParams.get('ref');
      if (ref && /^[a-z0-9]{4,16}$/.test(ref) && !parseCookies(req).tk_ref) res.setHeader('Set-Cookie', cookie('tk_ref', ref, { maxAge: 30 * 86400, secure: PRODUCTION }));
      return serveStatic(req, res, p);
    }
    send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof HttpError || err.expose) {
      const headers = err.extra && err.extra.retryAfter ? { 'Retry-After': String(err.extra.retryAfter) } : {};
      return send(res, err.status, { error: err.message, ...Object.fromEntries(Object.entries(err.extra || {}).filter(([k]) => k !== 'retryAfter')) }, headers);
    }
    console.error(JSON.stringify({ t: new Date().toISOString(), id, error: String(err && err.stack || err).slice(0, 2000) }));
    send(res, 500, { error: 'Something went wrong. Try again in a moment.', ref: id });
  }
});
server.headersTimeout = 20e3;
server.requestTimeout = 120e3;
server.keepAliveTimeout = 5e3;
server.maxRequestsPerSocket = 1000;

setInterval(() => { db.sweep(); limiter.sweep(); const t = Date.now(); for (const [k, v] of mediaLinks) if (v.expires < t) mediaLinks.delete(k); }, 10 * 60e3).unref();
setInterval(() => { cards.retryIssuing().catch(() => {}); cards.sweepUltimates(); }, 2 * 60e3).unref();
process.on('unhandledRejection', (e) => console.error('unhandledRejection', String(e && e.stack || e).slice(0, 1000)));

server.listen(CONFIG.port, () => console.log(`Tokard web on :${CONFIG.port} (${MOCK ? 'demo mode' : 'gateway ' + CONFIG.gatewayUrl}${PRODUCTION ? ', production' : ''})`));
export { server, db, cards, auth, human, CONFIG };
