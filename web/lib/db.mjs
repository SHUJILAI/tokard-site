// Tokard's own records: accounts, sign-in codes, sessions, daily hands, offers,
// orders and cards. SQLite (built into Node 22), one writer, WAL. Every money or
// limit decision runs inside a transaction so two requests can't both win.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL, canon TEXT NOT NULL UNIQUE,
  created INTEGER NOT NULL, last_login INTEGER, status TEXT NOT NULL DEFAULT 'active', note TEXT,
  ref_code TEXT UNIQUE, referred_by INTEGER, tickets INTEGER NOT NULL DEFAULT 0, signup_ip TEXT, signup_device TEXT,
  pity INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS logins ( user_id INTEGER NOT NULL, at INTEGER NOT NULL, ip TEXT, device TEXT );
CREATE INDEX IF NOT EXISTS logins_user ON logins(user_id, at);
CREATE INDEX IF NOT EXISTS logins_ip ON logins(ip, at);
CREATE TABLE IF NOT EXISTS referrals ( friend_id INTEGER PRIMARY KEY, referrer_id INTEGER NOT NULL, created INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending', reason TEXT );
CREATE INDEX IF NOT EXISTS referrals_referrer ON referrals(referrer_id, created);
CREATE TABLE IF NOT EXISTS devices ( user_id INTEGER NOT NULL, device TEXT NOT NULL, first_seen INTEGER NOT NULL, PRIMARY KEY (user_id, device) );
CREATE TABLE IF NOT EXISTS otp (
  id INTEGER PRIMARY KEY, canon TEXT NOT NULL, code_hash TEXT NOT NULL, created INTEGER NOT NULL,
  expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0, ip TEXT
);
CREATE INDEX IF NOT EXISTS otp_canon ON otp(canon, created);
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, last_seen INTEGER NOT NULL, ip TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS human ( id TEXT PRIMARY KEY, gx INTEGER NOT NULL, gy INTEGER NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0, ip TEXT );
CREATE TABLE IF NOT EXISTS human_used ( jti TEXT PRIMARY KEY, expires INTEGER NOT NULL );
CREATE TABLE IF NOT EXISTS jackpots ( day TEXT PRIMARY KEY, used INTEGER NOT NULL );
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, day TEXT NOT NULL, deck TEXT NOT NULL, value INTEGER NOT NULL,
  tier TEXT NOT NULL, off INTEGER NOT NULL, price_cents INTEGER NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', ip TEXT, serial TEXT NOT NULL
);
-- one live card per deck per day; a re-flip voids the old one first
CREATE UNIQUE INDEX IF NOT EXISTS offers_hand ON offers(user_id, day, deck) WHERE status != 'void';
CREATE INDEX IF NOT EXISTS offers_user ON offers(user_id, created);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, kind TEXT NOT NULL, offer_id TEXT, card_id TEXT, deck TEXT NOT NULL,
  value INTEGER NOT NULL, tier TEXT NOT NULL, price_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending', stripe_session TEXT, payment_intent TEXT, fingerprint TEXT,
  created INTEGER NOT NULL, paid INTEGER, ip TEXT
);
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, created);
CREATE INDEX IF NOT EXISTS orders_pi ON orders(payment_intent);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, deck TEXT NOT NULL, value INTEGER NOT NULL, tier TEXT NOT NULL,
  off INTEGER NOT NULL, paid_cents INTEGER NOT NULL, serial TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
  token_id INTEGER, key_enc TEXT, status TEXT NOT NULL DEFAULT 'active', created INTEGER NOT NULL, order_id TEXT
);
CREATE INDEX IF NOT EXISTS cards_user ON cards(user_id);
CREATE TABLE IF NOT EXISTS stripe_events ( id TEXT PRIMARY KEY, type TEXT NOT NULL, received INTEGER NOT NULL );
CREATE TABLE IF NOT EXISTS audit ( id INTEGER PRIMARY KEY, at INTEGER NOT NULL, user_id INTEGER, action TEXT NOT NULL, detail TEXT, ip TEXT );
CREATE TABLE IF NOT EXISTS counters ( key TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL );
`;

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA secure_delete = ON;');
  db.exec(SCHEMA);
  // columns added after launch: add them to an existing database
  const has = (t, c) => db.prepare(`PRAGMA table_info(${t})`).all().some((r) => r.name === c);
  if (!has('users', 'pity')) db.exec('ALTER TABLE users ADD COLUMN pity INTEGER NOT NULL DEFAULT 0');
  if (file !== ':memory:') { try { chmodSync(file, 0o600); } catch { /* best effort */ } }
  const cache = new Map();
  const st = (sql) => { let s = cache.get(sql); if (!s) { s = db.prepare(sql); cache.set(sql, s); } return s; };
  const api = {
    raw: db,
    get: (sql, ...p) => st(sql).get(...p),
    all: (sql, ...p) => st(sql).all(...p),
    run: (sql, ...p) => st(sql).run(...p),
    // BEGIN IMMEDIATE takes the write lock up front, so check-then-write is atomic
    tx(fn) {
      db.exec('BEGIN IMMEDIATE');
      try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch { /* already rolled back */ } throw e; }
    },
    audit(action, { user = null, detail = '', ip = '' } = {}) {
      st('INSERT INTO audit (at, user_id, action, detail, ip) VALUES (?, ?, ?, ?, ?)').run(Date.now(), user, action, String(detail).slice(0, 500), ip);
    },
    // persistent counter with expiry (daily caps that must survive a restart)
    bump(key, until, by = 1) {
      const row = st('SELECT n, until FROM counters WHERE key = ?').get(key);
      if (!row || row.until < Date.now()) { st('INSERT OR REPLACE INTO counters (key, n, until) VALUES (?, ?, ?)').run(key, by, until); return by; }
      st('UPDATE counters SET n = n + ? WHERE key = ?').run(by, key); return row.n + by;
    },
    count: (key) => { const row = st('SELECT n, until FROM counters WHERE key = ?').get(key); return row && row.until >= Date.now() ? row.n : 0; },
    sweep() {
      const t = Date.now();
      st('DELETE FROM otp WHERE expires < ?').run(t - 86400e3);
      st('DELETE FROM sessions WHERE expires < ?').run(t);
      st('DELETE FROM human WHERE expires < ?').run(t - 3600e3);
      st('DELETE FROM human_used WHERE expires < ?').run(t);
      st('DELETE FROM counters WHERE until < ?').run(t);
      st("UPDATE offers SET status = 'expired' WHERE status = 'open' AND expires < ?").run(t);
      st('DELETE FROM audit WHERE at < ?').run(t - 180 * 86400e3);
      st('DELETE FROM logins WHERE at < ?').run(t - 90 * 86400e3);
    },
  };
  return api;
}
