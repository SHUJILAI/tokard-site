// The pixel slide puzzle, decided on the server. The browser only ever gets two
// PNGs (the scene with the gap cut in, and the piece) and the piece's row; the gap's
// column never leaves the server. A pass needs the right column plus a drag that
// looks like a hand moved it, and earns a single-use token for one email send.

import { createHmac, randomInt } from 'node:crypto';
import { deflateSync, crc32 as zcrc } from 'node:zlib';
import { HttpError, randomId, safeEqual } from './security.mjs';

const GW = 48, GH = 24, S = 3;   // grid; PNG pixels per cell (the page scales ×2)
const MASK = ['....##....', '...####...', '.########.', '.########.', '..########', '..########', '.########.', '.########.', '.########.', '.########.'];
const PW = MASK[0].length, PH = MASK.length;
const inMask = (i, j) => j >= 0 && j < PH && i >= 0 && i < PW && MASK[j][i] === '#';

// ---------- tiny PNG encoder (RGBA, no filters) ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = typeof zcrc === 'function' ? (b) => zcrc(b) >>> 0 : (b) => { let c = 0xffffffff; for (const x of b) c = CRC_TABLE[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

function scene() {
  const r = () => randomInt(0, 1e9) / 1e9;
  const g = Array.from({ length: GH }, (_, y) => Array.from({ length: GW }, () => ['#D2ECFF', '#DCF1FF', '#E6F6FF', '#EFFAFF'][Math.min(3, y >> 2)]));
  const put = (x, y, c) => { if (x >= 0 && x < GW && y >= 0 && y < GH) g[y][x] = c; };
  const sx = 4 + Math.floor(r() * 36); for (let y = 2; y < 6; y++) for (let x = sx; x < sx + 4; x++) put(x, y, (x + y) % 3 ? '#FFC83D' : '#FFD866');
  for (let k = 0; k < 3; k++) { const cx = Math.floor(r() * 44), cy = 1 + Math.floor(r() * 6); for (let x = cx; x < cx + 6; x++) put(x, cy, '#FFFFFF'); for (let x = cx + 1; x < cx + 4; x++) put(x, cy - 1, '#FFFFFF'); }
  const range = (base, amp, col, cap) => { let h = base; for (let x = 0; x < GW; x++) { h = Math.max(base - amp, Math.min(base + 1, h + (r() < 0.5 ? -1 : 1) * (r() < 0.6 ? 1 : 0))); for (let y = GH - 1; y >= h; y--) put(x, y, col); if (h < base - amp + 2) put(x, h, cap); } };
  range(12, 6, '#1D7BFF', '#FFFFFF'); range(16, 5, '#0B3A8C', '#C9D8FF');
  for (let y = 20; y < GH; y++) for (let x = 0; x < GW; x++) put(x, y, r() < 0.12 ? '#34B985' : '#4ED8A0');
  return g;
}

// paint cells at S px each; edge lines are 1 px (2 px on screen)
function render(grid, gx, gy) {
  const W = GW * S, H = GH * S, bg = Buffer.alloc(W * H * 4), pc = Buffer.alloc(PW * S * PH * S * 4);
  const set = (buf, w, x, y, [r, g, b], a = 255) => { const i = (y * w + x) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a; };
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    let c = hex(grid[y][x]);
    const i = x - gx, j = y - gy, hole = inMask(i, j);
    if (hole) c = c.map((v) => Math.round(v * 0.58 + 11 * 0.42));
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      let cc = c;
      if (hole && ((py === 0 && !inMask(i, j - 1)) || (py === S - 1 && !inMask(i, j + 1)) || (px === 0 && !inMask(i - 1, j)) || (px === S - 1 && !inMask(i + 1, j)))) cc = c.map((v) => Math.round(v * 0.25 + 255 * 0.75));
      set(bg, W, x * S + px, y * S + py, cc);
    }
  }
  for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
    if (!inMask(i, j)) continue;
    const c = hex(grid[gy + j][gx + i]);
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const edge = (py === 0 && !inMask(i, j - 1)) || (py === S - 1 && !inMask(i, j + 1)) || (px === 0 && !inMask(i - 1, j)) || (px === S - 1 && !inMask(i + 1, j));
      set(pc, PW * S, i * S + px, j * S + py, edge ? [255, 255, 255] : c);
    }
  }
  return { bg: png(W, H, bg), piece: png(PW * S, PH * S, pc) };
}

export function createHuman({ db, secret, turnstileSecret = '' }) {
  const sign = (s) => createHmac('sha256', secret).update('human:' + s).digest('base64url');
  return {
    challenge(ip) {
      const id = randomId(18), gx = randomInt(18, GW - PW - 1), gy = randomInt(2, GH - PH - 1);
      const { bg, piece } = render(scene(), gx, gy);
      db.run('INSERT INTO human (id, gx, gy, expires, ip) VALUES (?, ?, ?, ?, ?)', id, gx, gy, Date.now() + 120e3, ip);
      return { id, cols: GW, rows: GH, pieceCols: PW, gy, bg: 'data:image/png;base64,' + bg.toString('base64'), piece: 'data:image/png;base64,' + piece.toString('base64') };
    },
    // body: { id, x, trail: [[ms, col], ...] }
    verify(body) {
      const row = db.get('SELECT * FROM human WHERE id = ?', String(body.id || ''));
      if (!row || row.used || row.expires < Date.now()) throw new HttpError(410, 'That puzzle expired. Here is a new one.', { code: 'puzzle_expired' });
      db.run('UPDATE human SET attempts = attempts + 1, used = CASE WHEN attempts + 1 >= 3 THEN 1 ELSE 0 END WHERE id = ?', row.id);
      const x = Number(body.x), trail = Array.isArray(body.trail) ? body.trail.slice(0, 600) : [];
      const ok = Number.isFinite(x) && Math.abs(x - row.gx) <= 1 && looksHuman(trail, x);
      if (!ok) throw new HttpError(422, 'Not quite. Try again.', { code: 'puzzle_wrong', left: Math.max(0, 2 - row.attempts) });
      db.run('UPDATE human SET used = 1 WHERE id = ?', row.id);
      const jti = randomId(12), exp = Date.now() + 10 * 60e3;
      return { token: `${jti}.${exp}.${sign(jti + '.' + exp)}` };
    },
    // single use: a token buys one code email
    spend(token) {
      const [jti, exp, mac] = String(token || '').split('.');
      if (!jti || !exp || !mac || !safeEqual(mac, sign(jti + '.' + exp)) || +exp < Date.now()) return false;
      try { db.run('INSERT INTO human_used (jti, expires) VALUES (?, ?)', jti, +exp); return true; } catch { return false; }
    },
    async turnstile(token, ip) {
      if (!turnstileSecret) return true;
      if (!token) return false;
      try {
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret: turnstileSecret, response: String(token).slice(0, 2048), remoteip: ip }), signal: AbortSignal.timeout(8000),
        });
        return !!(await res.json()).success;
      } catch { return false; }
    },
  };
}

// A hand drags unevenly: it accelerates, slows, sometimes overshoots. A script
// that jumps straight to the answer, or glides at one constant speed, does not.
export function looksHuman(trail, x) {
  if (trail.length < 4) return false;
  let lastT = -1;
  for (const p of trail) {
    if (!Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return false;
    if (p[0] < lastT || p[1] < -1 || p[1] > GW) return false;
    lastT = p[0];
  }
  const dur = trail[trail.length - 1][0] - trail[0][0];
  if (dur < 250 || dur > 60000) return false;
  if (Math.abs(trail[trail.length - 1][1] - x) > 1) return false;
  if (new Set(trail.map((p) => Math.round(p[1]))).size < 4) return false;
  const v = [];
  for (let i = 1; i < trail.length; i++) { const dt = trail[i][0] - trail[i - 1][0]; if (dt > 0) v.push((trail[i][1] - trail[i - 1][1]) / dt); }
  if (v.length < 3) return false;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  if (!(sd > Math.abs(mean) * 0.08 + 1e-4)) return false;
  // a hand speeds up and slows down: split the drag into four equal stretches of
  // time and the distance covered in each differs. A scripted glide covers the same
  // distance in every quarter, even with rounding noise on top.
  const t0 = trail[0][0], at = (t) => {
    for (let i = 1; i < trail.length; i++) if (trail[i][0] >= t) { const [ta, xa] = trail[i - 1], [tb, xb] = trail[i]; return tb === ta ? xb : xa + ((xb - xa) * (t - ta)) / (tb - ta); }
    return trail[trail.length - 1][1];
  };
  const q = [0, 1, 2, 3].map((i) => Math.abs(at(t0 + (dur * (i + 1)) / 4) - at(t0 + (dur * i) / 4)));
  const qm = q.reduce((a, b) => a + b, 0) / 4;
  if (qm <= 0) return false;
  const cv = Math.sqrt(q.reduce((a, b) => a + (b - qm) ** 2, 0) / 4) / qm;
  return cv > 0.2;
}
