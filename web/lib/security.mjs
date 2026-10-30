// Request hygiene shared by every route: real client IP, rate limits, security
// headers (with a strict CSP that hashes each page's inline scripts), origin
// checks for state-changing requests, safe static paths and bounded bodies.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { normalize, join, sep, basename } from 'node:path';

export const now = () => Date.now();
export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const rid = () => randomBytes(8).toString('hex');
export const randomId = (bytes = 16) => randomBytes(bytes).toString('base64url');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; this.expose = true; }
}

// ---------- client IP ----------
// Caddy appends the connecting address to X-Forwarded-For. Anything to the left
// of the last TRUST_PROXY_HOPS entries was written by the client and is ignored.
export function clientIpFactory(hops) {
  return (req) => {
    const sock = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    if (!hops) return sock;
    const list = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
    const ip = list.length >= hops ? list[list.length - hops] : sock;
    return /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip.replace(/^::ffff:/, '') : sock;
  };
}

// ---------- rate limits (sliding window, in memory, bounded) ----------
export class Limiter {
  constructor({ max = 200000 } = {}) { this.hits = new Map(); this.max = max; }
  // returns { ok, retryAfter } ; key like 'otp:ip:1.2.3.4'
  take(key, limit, windowMs, cost = 1) {
    const t = now(), arr = (this.hits.get(key) || []).filter((x) => x > t - windowMs);
    if (arr.length + cost > limit) { this.hits.set(key, arr); return { ok: false, retryAfter: Math.ceil((arr[0] + windowMs - t) / 1000) }; }
    for (let i = 0; i < cost; i++) arr.push(t);
    this.hits.set(key, arr);
    if (this.hits.size > this.max) this.sweep(true);
    return { ok: true, retryAfter: 0 };
  }
  sweep(hard) {
    const t = now();
    for (const [k, arr] of this.hits) if (!arr.length || arr[arr.length - 1] < t - 24 * 3600e3 || (hard && arr[arr.length - 1] < t - 3600e3)) this.hits.delete(k);
  }
}
export function enforce(limiter, rules) {
  for (const [key, limit, windowMs] of rules) {
    const r = limiter.take(key, limit, windowMs);
    if (!r.ok) throw new HttpError(429, 'Too many requests. Try again in a little while.', { retryAfter: r.retryAfter });
  }
}

// ---------- headers ----------
// Inline <script> blocks are allowed by hash, never by 'unsafe-inline'.
const cspCache = new Map();
export function cspFor(file, { scriptHosts = [], connect = [], img = [] } = {}) {
  if (cspCache.has(file)) return cspCache.get(file);
  let hashes = [];
  try {
    const html = readFileSync(file, 'utf8');
    hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  } catch { /* not html */ }
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')} ${scriptHosts.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${img.join(' ')}`.trim(),
    `media-src 'self' blob: ${img.join(' ')}`.trim(),
    `connect-src 'self' ${connect.join(' ')}`.trim(),
    "frame-src https://challenges.cloudflare.com https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self' https://checkout.stripe.com",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
  cspCache.set(file, csp);
  return csp;
}

export const BASE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
};

// ---------- CSRF: state-changing browser requests must come from our own origin ----------
export function checkOrigin(req, allowed) {
  const origin = req.headers.origin || '';
  const ref = req.headers.referer || '';
  let from = origin;
  if (!from && ref) { try { from = new URL(ref).origin; } catch { from = ''; } }
  if (!from || !allowed.includes(from)) throw new HttpError(403, 'This request did not come from the Tokard site.');
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Send JSON.');
}

// ---------- bodies ----------
export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = parseInt(req.headers['content-length'] || '0', 10);
    if (declared > limit) { reject(new HttpError(413, 'Request is too large.')); req.resume(); return; }
    const parts = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Request is too large.')); req.destroy(); } else parts.push(c); });
    req.on('end', () => resolve(Buffer.concat(parts)));
    req.on('error', reject);
  });
}
export async function readJson(req, limit = 64 * 1024) {
  const buf = await readBody(req, limit);
  try { const v = JSON.parse(buf.toString('utf8') || '{}'); if (!v || typeof v !== 'object' || Array.isArray(v)) throw 0; return v; } catch { throw new HttpError(400, 'Invalid JSON.'); }
}

// ---------- static paths ----------
export function safePath(root, urlPath) {
  let rel;
  try { rel = decodeURIComponent(urlPath); } catch { return null; }
  if (rel.includes('\0')) return null;
  const file = normalize(join(root, rel));
  if (file !== root && !file.startsWith(root + sep)) return null;
  if (file.split(sep).some((part) => part.startsWith('.') && part !== '.')) return null;   // no dotfiles
  if (/\.(map|bak|orig|log|env|sqlite|db)$/i.test(basename(file))) return null;
  return file;
}

// ---------- cookies ----------
export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    const k = part.slice(0, i).trim(); if (!k || k in out) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore */ }
  }
  return out;
}
export function cookie(name, value, { maxAge, secure = true, httpOnly = true, sameSite = 'Lax', path = '/' } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
  if (maxAge !== undefined) c += `; Max-Age=${Math.floor(maxAge)}`;
  if (httpOnly) c += '; HttpOnly';
  if (secure) c += '; Secure';
  return c;
}

// ---------- secrets at rest: card keys are stored sealed (AES-256-GCM) ----------
import { createCipheriv, createDecipheriv } from 'node:crypto';
export function sealer(secretB64) {
  const key = Buffer.from(String(secretB64 || ''), 'base64');
  if (key.length !== 32) throw new Error('KEY_ENC_SECRET must be 32 random bytes, base64 (openssl rand -base64 32).');
  return {
    seal(plain) {
      const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv);
      const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
      return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
    },
    open(blob) {
      const [v, iv, tag, ct] = String(blob).split('.');
      if (v !== 'v1') throw new Error('Unknown sealed format');
      const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
      d.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
    },
  };
}
