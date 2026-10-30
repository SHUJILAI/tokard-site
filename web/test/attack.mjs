// Attack-style tests: start the real server against a real gateway (new-api) and a
// fake Stripe, then try what an abuser would try.
//   GATEWAY_URL=http://127.0.0.1:3300 ISSUER_TOKEN=... node test/attack.mjs
import { spawn } from 'node:child_process';
import http from 'node:http';
import { createHmac, randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 8099, STRIPE_PORT = 8098, BASE = `http://localhost:${PORT}`, ORIGIN = BASE;
const DATA = mkdtempSync(join(tmpdir(), 'tokard-'));
const WHSEC = 'whsec_' + randomBytes(16).toString('hex');
let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };

// ---------- fake Stripe ----------
let sessionN = 0, refunds = [], fingerprint = 'fp_A';
const stripe = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/v1/checkout/sessions')) { const p = new URLSearchParams(b); sessionN++; return res.end(JSON.stringify({ id: `cs_test_${sessionN}`, url: 'https://checkout.stripe.com/c/pay/x', amount_total: +p.get('line_items[0][price_data][unit_amount]'), metadata: { order_id: p.get('metadata[order_id]') } })); }
    if (req.url.startsWith('/v1/payment_intents/')) return res.end(JSON.stringify({ latest_charge: { payment_method_details: { card: { fingerprint } } } }));
    if (req.url.startsWith('/v1/refunds')) { refunds.push(new URLSearchParams(b).get('payment_intent')); return res.end(JSON.stringify({ id: 're_1' })); }
    res.statusCode = 404; res.end('{}');
  });
}).listen(STRIPE_PORT);

// ---------- server ----------
const logs = [];
const env = { ...process.env, PORT: String(PORT), SITE_URL: BASE, DATA_DIR: DATA, TRUST_PROXY_HOPS: '1', MAIL_DEV: '1', EMAIL_MX_CHECK: '0',
  SESSION_SECRET: randomBytes(32).toString('hex'), KEY_ENC_SECRET: randomBytes(32).toString('base64'),
  ULTIMATE_EVERY: '5', ULTIMATE_ODDS: '1', PITY_EVERY: '2', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_API_BASE: `http://127.0.0.1:${STRIPE_PORT}`, NODE_ENV: 'test' };
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', join(HERE, '..', 'server.mjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
srv.stdout.on('data', (d) => logs.push(...String(d).split('\n'))); srv.stderr.on('data', (d) => logs.push(...String(d).split('\n')));
await new Promise((r) => setTimeout(r, 1200));
const db = () => new DatabaseSync(join(DATA, 'tokard.sqlite'), { readOnly: true });

// a tiny client with its own cookies, IP and device
function client(ip) {
  const jar = {};
  return {
    jar,
    async req(method, path, body, headers = {}) {
      const h = { 'x-forwarded-for': `6.6.6.6, ${ip}`, cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...headers };
      if (body !== undefined) { h['content-type'] ??= 'application/json'; h.origin ??= ORIGIN; }
      if (method !== 'GET' && h.origin === undefined) h.origin = ORIGIN;
      const res = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body), redirect: 'manual' });
      for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); const v = kv.slice(i + 1); if (/Max-Age=0/.test(c)) delete jar[kv.slice(0, i)]; else jar[kv.slice(0, i)] = v; }
      let data = null; const text = await res.text(); try { data = JSON.parse(text); } catch { data = text; }
      return { status: res.status, data, headers: res.headers };
    },
  };
}
// a believable drag: speeds up, slows down, small overshoot
const humanTrail = (gx) => { const pts = [[0, 0]]; let t = 0; for (let i = 1; i <= 12; i++) { t += 40 + (i % 3) * 25; pts.push([t, Math.min(gx + 1, Math.round(gx * Math.sin((i / 12) * Math.PI / 2)))]); } pts.push([t + 90, gx]); return pts; };
async function solve(c) {
  const ch = (await c.req('POST', '/api/auth/human', {})).data;
  const gx = db().prepare('SELECT gx FROM human WHERE id = ?').get(ch.id).gx;
  return (await c.req('POST', '/api/auth/human/verify', { id: ch.id, x: gx, trail: humanTrail(gx) })).data.token;
}
const codeFor = async (email) => { await new Promise((r) => setTimeout(r, 150)); const line = [...logs].reverse().find((l) => l.includes(`code for ${email}:`)); return line && line.split(': ').pop().trim(); };
async function signIn(c, email) {
  let r = await c.req('POST', '/api/auth/start', { email });
  if (r.status === 428) r = await c.req('POST', '/api/auth/start', { email, human: await solve(c) });
  const code = await codeFor(email);
  return c.req('POST', '/api/auth/verify', { email, code });
}
function webhook(type, object, { secret = WHSEC, t = Math.floor(Date.now() / 1000) } = {}) {
  const raw = JSON.stringify({ id: 'evt_' + randomBytes(6).toString('hex'), type, data: { object } });
  const sig = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  return fetch(BASE + '/api/stripe/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${sig}` }, body: raw }).then(async (r) => ({ status: r.status, data: await r.json(), raw }));
}
const replay = (raw, secret = WHSEC) => { const t = Math.floor(Date.now() / 1000); const sig = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex'); return fetch(BASE + '/api/stripe/webhook', { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${sig}` }, body: raw }).then((r) => r.json()); };

try {
  console.log('Headers and files');
  const home = await fetch(BASE + '/');
  const csp = home.headers.get('content-security-policy') || '';
  ok(home.status === 200 && /script-src 'self'( 'sha256-[^']+')*/.test(csp) && !/unsafe-inline'[^;]*script/.test(csp) && csp.includes("frame-ancestors 'none'"), 'strict CSP on pages (inline scripts by hash)');
  ok(home.headers.get('x-frame-options') === 'DENY' && home.headers.get('x-content-type-options') === 'nosniff', 'clickjacking and sniffing headers');
  for (const p of ['/..%2f..%2fserver.mjs', '/%2e%2e/%2e%2e/server.mjs', '/assets/../../server.mjs', '/.env', '/%00', '/%E0%A4%A', '/public2/x', '/data/tokard.sqlite']) { const r = await fetch(BASE + p); ok(r.status === 404 || r.status === 400, `blocked ${p}`, r.status); }
  const rg = await fetch(BASE + '/', { headers: { range: 'bytes=-' } }); ok(rg.status === 200, 'bad Range header does not crash');

  console.log('Cross-site requests');
  const a = client('10.0.0.1');
  ok((await a.req('POST', '/api/auth/start', { email: 'x@a.co' }, { origin: 'https://evil.example' })).status === 403, 'other origins are refused');
  ok((await fetch(BASE + '/api/auth/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status === 403, 'missing Origin is refused');
  ok((await a.req('POST', '/api/auth/start', 'email=x', { 'content-type': 'application/x-www-form-urlencoded' })).status === 415, 'form posts are refused');
  ok((await a.req('POST', '/api/auth/start', { email: 'x@a.co' }, { referer: 'not a url' , origin: '' })).status === 403, 'bad Referer is a 403, not a crash');

  console.log('Sign-in');
  ok((await a.req('POST', '/api/auth/start', { email: 'lin@tokard-test.io' })).status === 428, 'new email needs the puzzle');
  ok((await a.req('POST', '/api/auth/start', { email: 'lin@mailinator.com', human: 'x' })).status === 400, 'throwaway inbox refused');
  const ch = (await a.req('POST', '/api/auth/human', {})).data;
  ok(typeof ch.bg === 'string' && ch.bg.startsWith('data:image/png') && !('gx' in ch), 'puzzle never reveals the answer');
  const gx = db().prepare('SELECT gx FROM human WHERE id = ?').get(ch.id).gx;
  const robot = Array.from({ length: 10 }, (_, i) => [i * 50, Math.round((gx * i) / 9)]);
  const rb = await a.req('POST', '/api/auth/human/verify', { id: ch.id, x: gx, trail: robot }); ok(rb.status === 422, 'a constant-speed robot drag fails', rb.status);
  ok((await a.req('POST', '/api/auth/human/verify', { id: ch.id, x: gx + 5, trail: humanTrail(gx + 5) })).status === 422, 'wrong position fails');
  const tok = (await a.req('POST', '/api/auth/human/verify', { id: ch.id, x: gx, trail: humanTrail(gx) })).data.token;
  ok(!!tok, 'a human drag passes');
  ok((await a.req('POST', '/api/auth/human/verify', { id: ch.id, x: gx, trail: humanTrail(gx) })).status === 410, 'a solved puzzle cannot be reused');
  ok((await a.req('POST', '/api/auth/start', { email: 'lin@tokard-test.io', human: tok })).status === 200, 'code sent');
  ok((await a.req('POST', '/api/auth/start', { email: 'lin@tokard-test.io', human: tok })).status === 428, 'puzzle token is single use');
  const code = await codeFor('lin@tokard-test.io');
  for (let i = 0; i < 5; i++) await a.req('POST', '/api/auth/verify', { email: 'lin@tokard-test.io', code: code === '000000' ? '111111' : '000000' });
  ok((await a.req('POST', '/api/auth/verify', { email: 'lin@tokard-test.io', code })).status === 400, 'five wrong codes burn the code');
  await new Promise((r) => setTimeout(r, 30500));   // resend cooldown
  const sA = await signIn(a, 'Lin+promo@Tokard-Test.io');
  ok(sA.status === 200 && a.jar.tk_sess, 'sign in works (and +tags map to one account)');
  const sess = db().prepare('SELECT hash FROM sessions LIMIT 1').get().hash;
  ok(sess !== a.jar.tk_sess && sess.length === 64, 'database stores only a hash of the session');
  ok((await a.req('GET', '/api/me')).data.email, 'session works');
  await new Promise((r) => setTimeout(r, 30500));   // past the resend cooldown
  const a2 = client('10.0.0.1'); a2.jar.tk_dev = a.jar.tk_dev;
  const kd = await a2.req('POST', '/api/auth/start', { email: 'lin@tokard-test.io' });
  ok(kd.status === 200, 'known email on a known device skips the puzzle', kd.status);
  const stranger = client('10.9.9.9');
  ok((await stranger.req('POST', '/api/auth/start', { email: 'lin@tokard-test.io' })).status === 428, 'known email on a new device looks exactly like a new account');
  for (let i = 0; i < 8; i++) await client('10.8.0.' + i).req('POST', '/api/auth/start', { email: 'lin@tokard-test.io', human: await solve(client('10.8.1.' + i)) });
  await new Promise((r) => setTimeout(r, 30500));
  const own = await a2.req('POST', '/api/auth/start', { email: 'lin@tokard-test.io' });
  ok(own.status === 200, "strangers spamming an address don't lock its owner out", own.status);
  let limited = false; for (let i = 0; i < 12; i++) { const r = await client('10.7.0.' + i).req('POST', '/api/auth/start', { email: 'victim@tokard-test.io', human: await solve(client('10.7.1.' + i)) }); if (r.status === 429) limited = true; }
  ok(limited, 'one inbox cannot be mail-bombed (per-email cap)');

  console.log('Flips');
  const f1 = await a.req('POST', '/api/flip', { deck: 'text' });
  ok(f1.status === 200 && f1.data.price > 0 && f1.data.price < f1.data.value, 'flip draws a server-priced card');
  const f2 = await a.req('POST', '/api/flip', { deck: 'text' });
  ok(f2.data.id === f1.data.id, 'flipping the same deck again returns the same card');
  ok((await a.req('POST', '/api/flip', { deck: 'gold' })).status === 400, 'unknown deck refused');
  ok((await client('10.0.0.3').req('POST', '/api/flip', { deck: 'text' })).status === 401, 'flips need an account');
  const shopText = { 5: 0.85, 20: 0.8, 100: 0.75 }[f1.data.value];
  ok(f1.data.price < shopText * f1.data.value, 'a flip always beats the shop price', JSON.stringify(f1.data));
  ok(f1.data.tier === 'jackpot' || f1.data.price >= 0.6 * f1.data.value, 'a flip never goes below cost (except capped jackpots)');

  console.log('Gold within five (every 2nd here)');
  const g = client('10.0.4.1'); await signIn(g, 'gold@tokard-test.io');
  const seq = []; for (const deck of ['text', 'image', 'video']) seq.push((await g.req('POST', '/api/flip', { deck })).data);
  const goldish = (o) => o.tier === 'jackpot' || o.tier === 'ultimate' || o.price < o.value * 0.75 - 1e-9;
  ok(seq.every((o, i) => i === 0 || goldish(o) || goldish(seq[i - 1])), 'never more flips in a row without gold than the rule allows', seq.map((o) => `${o.tier}:${o.price}/${o.value}`).join(' '));
  ok(seq.filter((o) => o.tier === 'lucky').every((o) => Math.abs(o.price - o.value * 0.7) < 0.005), 'a Lucky card is 70% of face value');
  const want = seq.reduce((n, o) => (goldish(o) ? 0 : Math.min(n + 1, 1)), 0);
  ok(db().prepare("SELECT pity FROM users WHERE canon = 'gold@tokard-test.io'").get().pity === want && (await g.req('GET', '/api/hand')).data.pity.since === want, 'the count is kept on the account and sent with the hand');

  console.log('Invites');
  const link = (await a.req('GET', '/api/invite')).data.link; const ref = new URL(link).searchParams.get('ref');
  const b = client('10.0.1.1'); await b.req('GET', '/?ref=' + ref); await signIn(b, 'bo@tokard-test.io'); await b.req('POST', '/api/flip', { deck: 'image' });
  ok((await a.req('GET', '/api/me')).data.tickets === 1, "a friend's first flip earns one extra flip");
  const c = client('10.0.2.1'); c.jar.tk_dev = a.jar.tk_dev; await c.req('GET', '/?ref=' + ref); await signIn(c, 'self@tokard-test.io'); await c.req('POST', '/api/flip', { deck: 'image' });
  ok((await a.req('GET', '/api/me')).data.tickets === 1, 'an invite from your own device earns nothing');
  const d = client('10.0.0.1'); await d.req('GET', '/?ref=' + ref); await signIn(d, 'samenet@tokard-test.io'); await d.req('POST', '/api/flip', { deck: 'video' });
  ok((await a.req('GET', '/api/me')).data.tickets === 1, 'an invite from your own network earns nothing');
  const rf = await a.req('POST', '/api/reflip', { deck: 'text' });
  ok(rf.status === 200 && rf.data.id !== f1.data.id, 'an extra flip redraws the card');
  ok(db().prepare('SELECT status FROM offers WHERE id = ?').get(f1.data.id).status === 'void', 'the old card is void');
  ok((await a.req('POST', '/api/reflip', { deck: 'text' })).status === 409, 'no extra flips left, no redraw');

  console.log('Checkout and webhooks');
  const co = await a.req('POST', '/api/checkout', { offerId: rf.data.id, price: 0.01 });
  const order = db().prepare('SELECT * FROM orders WHERE offer_id = ?').get(rf.data.id);
  ok(co.status === 200 && order.price_cents === Math.round(rf.data.price * 100), 'price comes from the server, not the request');
  ok((await b.req('POST', '/api/checkout', { offerId: rf.data.id })).status === 409, "nobody can buy someone else's card");
  ok((await a.req('POST', '/api/checkout', { offerId: f1.data.id })).status === 409, 'a void card cannot be bought');
  ok((await a.req('POST', '/api/checkout', { deck: 'text', value: 7 })).status === 400, 'made-up face values refused');
  await a.req('POST', '/api/checkout', { deck: 'text', value: 5 }); await a.req('POST', '/api/checkout', { deck: 'text', value: 20 }); await a.req('POST', '/api/checkout', { deck: 'text', value: 100 });
  const ladder = db().prepare("SELECT value, price_cents FROM orders WHERE kind = 'shop' AND deck = 'text' ORDER BY value").all().map((r) => `${r.value}:${r.price_cents}`).join(' ');
  ok(ladder === '5:425 20:1600 100:7500', 'coding shop ladder: $5 → $4.25, $20 → $16, $100 → $75', ladder);
  const shop = await a.req('POST', '/api/checkout', { deck: 'video', value: 100 });
  ok(db().prepare("SELECT price_cents FROM orders WHERE kind = 'shop' AND deck = 'video' ORDER BY created DESC").get().price_cents === 8300, 'film shop price: $100 card costs $83');
  const unsigned = await fetch(BASE + '/api/stripe/webhook', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"type":"checkout.session.completed"}' });
  ok(unsigned.status === 400, 'unsigned webhook refused');
  ok((await webhook('checkout.session.completed', {}, { secret: 'whsec_wrong' })).status === 400, 'webhook with the wrong secret refused');
  ok((await webhook('checkout.session.completed', {}, { t: Math.floor(Date.now() / 1000) - 3600 })).status === 400, 'old (replayed) webhook refused');
  const sess1 = { id: order.stripe_session, payment_status: 'paid', amount_total: order.price_cents - 1, currency: 'usd', payment_intent: 'pi_1', metadata: { order_id: order.id } };
  await webhook('checkout.session.completed', sess1);
  ok(!db().prepare('SELECT card_id FROM orders WHERE id = ?').get(order.id).card_id, 'wrong amount issues nothing');
  const good = await webhook('checkout.session.completed', { ...sess1, amount_total: order.price_cents });
  const cardRow = db().prepare('SELECT * FROM cards WHERE order_id = ?').get(order.id);
  ok(good.data.ok && cardRow && cardRow.token_id, 'paid webhook issues a card in the gateway', JSON.stringify(good.data));
  ok(cardRow && !String(cardRow.key_enc).includes('sk-'), 'the key is stored sealed');
  ok((await replay(good.raw)).duplicate, 'the same event twice is processed once');
  const list = (await a.req('GET', '/api/cards')).data.cards;
  ok(list.length === 1 && Math.abs(list[0].left - list[0].value) < 0.01, 'card budget equals its face value', JSON.stringify(list));
  const key = (await a.req('POST', `/api/cards/${cardRow.id}/reveal`, {})).data.key;
  const models = await fetch(process.env.GATEWAY_URL + '/v1/models', { headers: { Authorization: `Bearer ${key}` } }).then((r) => r.json());
  ok(Array.isArray(models.data) && models.data.every((m) => m.id === 'text'), 'the card key only sees its own model', JSON.stringify(models).slice(0, 200));
  ok((await b.req('POST', `/api/cards/${cardRow.id}/reveal`, {})).status === 404, "nobody can see someone else's key");
  const rn = await a.req('PATCH', `/api/cards/${cardRow.id}`, { label: '<img src=x onerror=alert(1)>Bot' });
  ok(!/[<>]/.test(rn.data.label), 'card names are cleaned');

  console.log('Card-number limits and disputes');
  fingerprint = 'fp_farm';
  let refused = 0;
  for (let i = 0; i < 4; i++) {
    const u = client('10.3.0.' + i); await signIn(u, `farm${i}@tokard-test.io`);
    const o = (await u.req('POST', '/api/flip', { deck: 'video' })).data;
    await u.req('POST', '/api/checkout', { offerId: o.id });
    const ord = db().prepare('SELECT * FROM orders WHERE offer_id = ?').get(o.id);
    const r = await webhook('checkout.session.completed', { id: ord.stripe_session, payment_status: 'paid', amount_total: ord.price_cents, currency: 'usd', payment_intent: 'pi_farm' + i, metadata: { order_id: ord.id } });
    if (r.data.refused) refused++;
  }
  ok(refused === 1 && refunds.includes('pi_farm3'), 'one card number buys at most 3 flip-priced cards a day; the 4th is refunded');
  await webhook('charge.dispute.created', { payment_intent: 'pi_1' });
  const tok2 = await fetch(process.env.GATEWAY_URL + '/v1/models', { headers: { Authorization: `Bearer ${key}` } });
  ok(tok2.status === 401 || tok2.status === 403, 'a dispute freezes the key at once', tok2.status);
  ok((await a.req('POST', '/api/checkout', { deck: 'text', value: 20 })).status === 403, 'a disputed account cannot buy');

  console.log('The Ultimate');
  const pay = async (offerOrShop, u, pi) => {
    const r = await u.req('POST', '/api/checkout', offerOrShop);
    const ord = db().prepare('SELECT * FROM orders WHERE stripe_session IS NOT NULL ORDER BY created DESC LIMIT 1').get();
    await webhook('checkout.session.completed', { id: ord.stripe_session, payment_status: 'paid', amount_total: ord.price_cents, currency: 'usd', payment_intent: pi, metadata: { order_id: ord.id } });
    return { r, ord };
  };
  const v = client('10.5.0.1'); await signIn(v, 'vee@tokard-test.io');
  await pay({ deck: 'text', value: 5 }, v, 'pi_v1');
  ok(db().prepare("SELECT n FROM counters WHERE key = 'ultimate_pool'").get()?.n === 1, 'the 5th card sold (test setting) releases one Ultimate');
  const w = client('10.5.0.2'); await signIn(w, 'wen@tokard-test.io');
  const uo = (await w.req('POST', '/api/flip', { deck: 'video' })).data;
  ok(uo.tier === 'ultimate' && uo.value === 100 && uo.price === 0.1 && uo.off === 99.9, 'the next flip turns it over: $100 for $0.10', JSON.stringify(uo));
  const notYet = await w.req('POST', '/api/checkout', { offerId: uo.id });
  ok(notYet.status === 402 && notYet.data.code === 'spend_more', 'an account with no purchases cannot claim it', notYet.status);
  ok((await v.req('POST', '/api/flip', { deck: 'video' })).data.tier !== 'ultimate', 'one release, one Ultimate');
  await pay({ deck: 'text', value: 20 }, w, 'pi_w1');
  ok((await w.req('GET', '/api/me')).data.spent === 16, 'purchases are counted', JSON.stringify((await w.req('GET', '/api/me')).data));
  ok((await w.req('POST', '/api/checkout', { offerId: uo.id })).status === 402, '$16 is still short of $20');
  const big = await pay({ deck: 'image', value: 20 }, w, 'pi_w2');
  const claim = await w.req('POST', '/api/checkout', { offerId: uo.id });
  ok(claim.status === 200 && claim.data.claimed && claim.data.cardId, 'with $20+ spent it is claimed, no checkout needed', JSON.stringify(claim.data));
  const ucard = db().prepare('SELECT * FROM cards WHERE id = ?').get(claim.data.cardId);
  ok(ucard && ucard.value === 100 && ucard.paid_cents === 10, 'a real $100 card is issued for $0.10');
  ok((await w.req('POST', '/api/checkout', { offerId: uo.id })).status === 409, 'it cannot be claimed twice');
  const ukey = (await w.req('POST', `/api/cards/${ucard.id}/reveal`, {})).data.key;
  await webhook('charge.refunded', { payment_intent: 'pi_w2', amount: big.ord.price_cents, amount_refunded: big.ord.price_cents });
  ok(db().prepare('SELECT status FROM cards WHERE id = ?').get(ucard.id).status === 'frozen', 'refunding the purchase it relied on freezes the Ultimate');
  const uk = await fetch(process.env.GATEWAY_URL + '/v1/models', { headers: { Authorization: `Bearer ${ukey}` } });
  ok(uk.status === 401 || uk.status === 403, 'and its key stops working', uk.status);

  console.log('Public API edge');
  const spoof = await fetch(BASE + '/v1/images/generations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer sk-nothing', 'x-forwarded-for': '1.1.1.1, 10.4.4.4' }, body: JSON.stringify({ model: 'image', prompt: 'nude teen' }) });
  ok(spoof.status === 400, 'sexual content involving minors is blocked before the model');
  const gwHit = await fetch(BASE + '/v1/models', { headers: { authorization: 'Bearer sk-nothing', 'x-forwarded-for': '9.9.9.9, 10.4.4.4' } });
  ok(gwHit.status === 401, 'bad keys are refused by the gateway');
  await new Promise((r) => setTimeout(r, 300));
  const logIp = logs.filter((l) => l.includes('"p":"/v1/models"')).pop() || '';
  ok(logIp.includes('"ip":"10.4.4.4"'), 'client-written X-Forwarded-For entries are ignored', logIp);

  console.log('Startup');
  const prod = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', join(HERE, '..', 'server.mjs')], { env: { ...env, NODE_ENV: 'production', PORT: '8097', SESSION_SECRET: 'change-me' }, stdio: 'ignore' });
  const codeExit = await new Promise((r) => prod.on('exit', r));
  ok(codeExit === 1, 'production refuses to start with a weak secret');
} catch (e) { fail++; console.error(e); }
finally {
  srv.kill(); stripe.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
