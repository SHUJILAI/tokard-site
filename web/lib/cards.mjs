// The card economy, decided only on the server: today's hand, flips, prices,
// invites, checkout, issuing keys, and what happens on refunds and disputes.
//
// Abuse rules in one place:
// - Every random draw uses crypto.randomInt; the browser never picks or prices anything.
// - One live card per deck per account per UTC day (a unique index enforces it).
// - Jackpots are capped sitewide per day inside the same transaction that draws them.
// - Flips are also capped per IP and per device per day, so throwaway accounts
//   on one machine or network can't farm the deck.
// - Gold within five: the fifth flip in a row without gold is a Lucky card at
//   PITY_PRICE_RATIO of face value (7折), never below the cost floor. The count
//   lives on the account, so it can't be reset by clearing the browser.
// - An invite earns an extra flip only after the friend signs up, passes the
//   puzzle and flips; never for the same device or a recent IP of the inviter;
//   at most 3 a day and 10 held.
// - Checkout prices come from the database; a card is issued only from a signed,
//   amount-checked Stripe webhook, once. One card number can buy at most 3
//   flip-priced cards a day and 1 jackpot a week; past that the payment is
//   refunded automatically.
// - A dispute freezes the card's key at once and blocks the account from buying.

import { randomInt } from 'node:crypto';
import { HttpError, enforce, randomId } from './security.mjs';

const DAY = 86400e3, HOUR = 3600e3;
export const DECKS = ['text', 'image', 'video'];
export const DECK_NAMES = { text: 'Coding', image: 'Design', video: 'Film' };
export const VALUES = [[5, 40], [20, 45], [100, 15]];   // [face value, flip weight]
export const TIERS = [
  { key: 'nice', extra: 5, w: 45 }, { key: 'good', extra: 10, w: 30 }, { key: 'great', extra: 15, w: 17 },
  { key: 'rare', extra: 20, w: 6 }, { key: 'jackpot', half: true, w: 2 },
  // never drawn by weight: the fifth flip in a row without gold becomes one
  { key: 'lucky', lucky: true, w: 0 },
];
// a gold card: under 75% of its face value (or a jackpot / the Ultimate)
const GOLD_BELOW = 0.75;
const isGold = (tier, usd, cents) => tier === 'jackpot' || tier === 'ultimate' || cents < usd * 100 * GOLD_BELOW;
const TIER = Object.fromEntries(TIERS.map((t) => [t.key, t]));
const FOREVER = 8.64e15;
// The Ultimate: one $100 card at 0.01折 ($0.10) is released into the draw for every
// 10,000 cards sold. Anyone can turn it over; only an account with $20+ of real
// purchases can claim it, so a farm of fresh accounts gets nothing out of it.
const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const nextDay = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };
const pick = (table, w) => { let r = randomInt(0, table.reduce((s, x) => s + w(x), 0)); for (const x of table) { r -= w(x); if (r < 0) return x; } return table[table.length - 1]; };

export function createCards({ db, limiter, issuer, stripe, sealer, config }) {
  // shop discount grows with the card: { text: [[5, 15], [20, 20], [100, 25]], ... } (% off by face value)
  const ladder = config.shopLadder;
  const offAt = (deck, usd) => ladder[deck].reduce((off, [v, o]) => (usd >= v ? o : off), ladder[deck][0][1]);
  // a refill is priced by the size of the card it fills
  const shopCents = (deck, usd, bracket = usd) => Math.round(usd * 100 * (1 - offAt(deck, bracket) / 100));
  // flips take an extra cut off the shop price, but never below the cost floor (jackpots are capped per day instead)
  const P = { every: 5, ratio: 0.7, ...(config.pity || {}) };
  const flipCents = (deck, usd, t) => (t.half ? usd * 50 : t.lucky ? Math.max(Math.round(usd * 100 * P.ratio), Math.ceil(usd * 100 * config.flipFloor)) : Math.max(Math.round(shopCents(deck, usd) * (1 - t.extra / 100)), Math.ceil(usd * 100 * config.flipFloor)));
  const offOf = (usd, cents) => Math.round((1 - cents / (usd * 100)) * 100);
  const serial = () => String(randomInt(1000, 10000));

  function activeUser(userId) {
    const u = db.get('SELECT * FROM users WHERE id = ?', userId);
    if (!u || u.status === 'banned') throw new HttpError(403, 'This account is closed.');
    return u;
  }
  const U = { every: 10000, odds: 1000, value: 100, cents: 10, needCents: 2000, holdMs: DAY, cooldownMs: 30 * DAY, ...(config.ultimate || {}) };
  const publicOffer = (o) => o && {
    id: o.id, kind: o.deck, value: o.value, tier: o.tier, off: o.tier === 'ultimate' ? 99.9 : o.off, price: o.price_cents / 100, expires: o.expires, serial: o.serial,
    status: o.status, claimed: o.status === 'paid',
  };

  // inside a transaction: draw a card for this deck (jackpots counted against the day's cap)
  // what this account has really paid: refunded, disputed and refused orders don't count
  const spentCents = (userId) => db.get("SELECT COALESCE(SUM(price_cents), 0) AS c FROM orders WHERE user_id = ? AND kind != 'ultimate' AND status IN ('paid', 'issued', 'paid_unissued')", userId).c;
  function drawUltimate(userId, deck, ip) {
    if (db.count('ultimate_pool') < 1 || randomInt(0, U.odds) !== 0) return null;
    if (!db.run("UPDATE counters SET n = n - 1 WHERE key = 'ultimate_pool' AND n > 0").changes) return null;
    const o = { id: randomId(12), user_id: userId, day: dayKey(), deck, value: U.value, tier: 'ultimate', off: 100, price_cents: U.cents, created: Date.now(), expires: Date.now() + U.holdMs, status: 'open', ip, serial: serial() };
    db.run('INSERT INTO offers (id, user_id, day, deck, value, tier, off, price_cents, created, expires, status, ip, serial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      o.id, o.user_id, o.day, o.deck, o.value, o.tier, o.off, o.price_cents, o.created, o.expires, o.status, o.ip, o.serial);
    db.audit('ultimate.drawn', { user: userId, detail: o.id, ip });
    return o;
  }
  // every flip counts toward gold within five: daily flips and invite flips alike
  function draw(userId, deck, ip) {
    const since = db.get('SELECT pity FROM users WHERE id = ?', userId)?.pity || 0;
    let o = drawUltimate(userId, deck, ip);
    if (!o) {
      const day = dayKey(), value = pick(VALUES, (x) => x[1])[0];
      let tier = pick(TIERS, (t) => t.w);
      if (tier.half) {
        db.run('INSERT OR IGNORE INTO jackpots (day, used) VALUES (?, 0)', day);
        const used = db.get('SELECT used FROM jackpots WHERE day = ?', day).used;
        if (used >= config.jackpotsPerDay) tier = TIER.rare; else db.run('UPDATE jackpots SET used = used + 1 WHERE day = ?', day);
      }
      let cents = flipCents(deck, value, tier);
      // four in a row without gold: this one is gold
      if (!isGold(tier.key, value, cents) && since >= P.every - 1) { tier = TIER.lucky; cents = flipCents(deck, value, tier); }
      o = { id: randomId(12), user_id: userId, day, deck, value, tier: tier.key, off: offOf(value, cents), price_cents: cents, created: Date.now(), expires: Date.now() + DAY, status: 'open', ip, serial: serial() };
      db.run('INSERT INTO offers (id, user_id, day, deck, value, tier, off, price_cents, created, expires, status, ip, serial) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        o.id, o.user_id, o.day, o.deck, o.value, o.tier, o.off, o.price_cents, o.created, o.expires, o.status, o.ip, o.serial);
    }
    db.run('UPDATE users SET pity = ? WHERE id = ?', isGold(o.tier, o.value, o.price_cents) ? 0 : Math.min(since + 1, P.every - 1), userId);
    return o;
  }

  // inside a transaction: the friend's first flip pays the inviter one extra flip, if it's clean
  function rewardInvite(friend) {
    const ref = db.get("SELECT * FROM referrals WHERE friend_id = ? AND state = 'pending'", friend.id);
    if (!ref) return;
    const inviter = db.get('SELECT * FROM users WHERE id = ?', ref.referrer_id);
    let reason = '';
    if (!inviter || inviter.status !== 'active') reason = 'inviter not active';
    else if (inviter.id === friend.id) reason = 'self';
    else if (db.get('SELECT 1 AS x FROM devices WHERE user_id = ? AND device = ?', inviter.id, friend.signup_device)) reason = 'same device';
    else if (db.get('SELECT 1 AS x FROM logins WHERE user_id = ? AND ip = ? AND at > ?', inviter.id, friend.signup_ip, Date.now() - 30 * DAY)) reason = 'same network';
    else if (db.count(`tix:${inviter.id}:${dayKey()}`) >= 3) reason = 'daily cap';
    else if (inviter.tickets >= 10) reason = 'holding cap';
    if (reason) { db.run("UPDATE referrals SET state = 'rejected', reason = ? WHERE friend_id = ?", reason, friend.id); return; }
    db.bump(`tix:${inviter.id}:${dayKey()}`, nextDay());
    db.run('UPDATE users SET tickets = tickets + 1 WHERE id = ?', inviter.id);
    db.run("UPDATE referrals SET state = 'rewarded' WHERE friend_id = ?", friend.id);
    db.audit('invite.rewarded', { user: inviter.id, detail: `friend ${friend.id}` });
  }

  async function issueCard(order) {
    if (order.card_id) return order.card_id;
    const cardId = randomId(10);
    const { tokenId, key } = await issuer.create({ cardId, deck: order.deck, usd: order.value });
    db.tx(() => {
      db.run('INSERT INTO cards (id, user_id, deck, value, tier, off, paid_cents, serial, token_id, key_enc, created, order_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        cardId, order.user_id, order.deck, order.value, order.tier, Math.round((1 - order.price_cents / (order.value * 100)) * 100), order.price_cents,
        order.offer_id ? db.get('SELECT serial FROM offers WHERE id = ?', order.offer_id)?.serial || serial() : serial(), tokenId, sealer.seal(key), Date.now(), order.id);
      db.run("UPDATE orders SET card_id = ?, status = 'issued' WHERE id = ?", cardId, order.id);
      if (order.kind !== 'ultimate' && db.bump('cards_sold', FOREVER) % U.every === 0) { db.bump('ultimate_pool', FOREVER); db.audit('ultimate.released', { detail: `after ${db.count('cards_sold')} cards` }); }
    });
    db.audit('card.issued', { user: order.user_id, detail: `${cardId} ${order.deck} $${order.value}` });
    return cardId;
  }

  // Stripe can't charge less than $0.50, so a qualifying account gets the $0.10 card issued directly
  async function claimUltimate(u, o, ip) {
    const spent = spentCents(u.id);
    if (spent < U.needCents) throw new HttpError(402, `Spend $${((U.needCents - spent) / 100).toFixed(2)} more to claim the Ultimate.`, { code: 'spend_more', spent: spent / 100, need: U.needCents / 100 });
    if (db.get("SELECT 1 AS x FROM orders WHERE user_id = ? AND kind = 'ultimate' AND status IN ('issued', 'paid', 'paid_unissued') AND created > ?", u.id, Date.now() - U.cooldownMs)) throw new HttpError(409, 'One Ultimate per account every 30 days.');
    const id = randomId(12);
    const order = db.tx(() => {
      const live = db.get("SELECT * FROM offers WHERE id = ? AND user_id = ? AND status = 'open' AND expires > ?", o.id, u.id, Date.now());
      if (!live) throw new HttpError(409, 'This offer is no longer open.');
      db.run("UPDATE offers SET status = 'paid' WHERE id = ?", o.id);
      db.run("INSERT INTO orders (id, user_id, kind, offer_id, deck, value, tier, price_cents, status, created, paid, ip) VALUES (?, ?, 'ultimate', ?, ?, ?, 'ultimate', ?, 'paid', ?, ?, ?)",
        id, u.id, o.id, o.deck, o.value, o.price_cents, Date.now(), Date.now(), ip);
      return db.get('SELECT * FROM orders WHERE id = ?', id);
    });
    db.audit('ultimate.claimed', { user: u.id, detail: `${o.id} spent ${spent}`, ip });
    try { return { claimed: true, cardId: await issueCard(order) }; }
    catch (e) { db.run("UPDATE orders SET status = 'paid_unissued' WHERE id = ?", id); db.audit('issue.failed', { user: u.id, detail: e.message }); return { claimed: true, pending: true }; }
  }

  async function refill(order) {
    const card = db.get('SELECT * FROM cards WHERE id = ?', order.card_id);
    await issuer.addUsd(card.token_id, order.value);
    db.run("UPDATE orders SET status = 'issued' WHERE id = ?", order.id);
    db.audit('card.refilled', { user: order.user_id, detail: `${card.id} +$${order.value}` });
  }

  return {
    shopCents, flipCents,
    hand(userId) {
      const day = dayKey();
      const rows = db.all("SELECT * FROM offers WHERE user_id = ? AND day = ? AND status != 'void'", userId, day);
      const me = db.get('SELECT tickets, pity FROM users WHERE id = ?', userId) || {};
      return { day, next: nextDay(), ultimateIn: U.every - (db.count('cards_sold') % U.every), tickets: me.tickets || 0, pity: { since: me.pity || 0, every: P.every }, jackpotsLeft: Math.max(0, config.jackpotsPerDay - (db.get('SELECT used FROM jackpots WHERE day = ?', day)?.used || 0)),
        hand: DECKS.map((deck) => ({ kind: deck, offer: publicOffer(rows.find((o) => o.deck === deck)) })) };
    },
    history(userId) { return db.all('SELECT * FROM offers WHERE user_id = ? ORDER BY created DESC LIMIT 20', userId).map(publicOffer); },

    flip(userId, deck, { ip, device }) {
      if (!DECKS.includes(deck)) throw new HttpError(400, 'Unknown deck.');
      const user = activeUser(userId);
      if (user.status === 'review') throw new HttpError(403, 'This account is under review. Write to support.');
      enforce(limiter, [[`flip:u:${userId}`, 20, HOUR]]);
      return db.tx(() => {
        const live = db.get("SELECT * FROM offers WHERE user_id = ? AND day = ? AND deck = ? AND status != 'void'", userId, dayKey(), deck);
        if (live) return publicOffer(live);
        const until = nextDay();
        if (db.count(`flips:ip:${ip}:${dayKey()}`) >= config.flipsPerIpPerDay) throw new HttpError(429, 'Too many flips from this network today.');
        if (device && db.count(`flips:dev:${device}:${dayKey()}`) >= 9) throw new HttpError(429, 'Too many flips from this device today.');
        db.bump(`flips:ip:${ip}:${dayKey()}`, until); if (device) db.bump(`flips:dev:${device}:${dayKey()}`, until);
        const first = !db.get('SELECT 1 AS x FROM offers WHERE user_id = ? LIMIT 1', userId);
        const o = draw(userId, deck, ip);
        if (first) rewardInvite(user);
        return publicOffer(o);
      });
    },

    // spend an extra flip: the unclaimed card for this deck is voided and drawn again
    reflip(userId, deck, { ip }) {
      if (!DECKS.includes(deck)) throw new HttpError(400, 'Unknown deck.');
      activeUser(userId);
      return db.tx(() => {
        const u = db.get('SELECT tickets FROM users WHERE id = ?', userId);
        if (!u || u.tickets < 1) throw new HttpError(409, 'No extra flips left. Invite a friend to get one.');
        const live = db.get("SELECT * FROM offers WHERE user_id = ? AND day = ? AND deck = ? AND status != 'void'", userId, dayKey(), deck);
        if (!live) throw new HttpError(409, 'Flip this card first.');
        if (live.status !== 'open') throw new HttpError(409, 'This card is already yours.');
        if (live.tier === 'ultimate') throw new HttpError(409, "An Ultimate can't be flipped again.");
        if (db.get("SELECT 1 AS x FROM orders WHERE offer_id = ? AND status = 'pending' AND created > ?", live.id, Date.now() - 35 * 60e3)) throw new HttpError(409, 'A checkout for this card is still open.');
        db.run("UPDATE offers SET status = 'void' WHERE id = ?", live.id);
        db.run("UPDATE orders SET status = 'void' WHERE offer_id = ? AND status = 'pending'", live.id);
        db.run('UPDATE users SET tickets = tickets - 1 WHERE id = ?', userId);
        db.audit('reflip', { user: userId, detail: live.id, ip });
        return publicOffer(draw(userId, deck, ip));
      });
    },

    inviteLink(userId) { const u = activeUser(userId); return `${config.siteUrl}/?ref=${u.ref_code}`; },

    // what = { offerId } | { deck, value } | { refillCardId }
    async checkout(user, what, { ip }) {
      const u = activeUser(user.id);
      if (u.status === 'review') throw new HttpError(403, 'This account is under review. Write to support.');
      enforce(limiter, [[`co:u:${u.id}`, 10, HOUR], [`co:ip:${ip}`, 20, HOUR]]);
      let order;
      if (what.offerId) {
        const o = db.get('SELECT * FROM offers WHERE id = ? AND user_id = ?', String(what.offerId), u.id);
        if (!o || o.status !== 'open' || o.expires < Date.now()) throw new HttpError(409, 'This offer is no longer open.');
        if (o.tier === 'ultimate') return claimUltimate(u, o, ip);
        order = { kind: 'flip', offer_id: o.id, deck: o.deck, value: o.value, tier: o.tier, price_cents: o.price_cents, expires: o.expires, card_id: null };
      } else if (what.refillCardId) {
        const c = db.get("SELECT * FROM cards WHERE id = ? AND user_id = ? AND status = 'active'", String(what.refillCardId), u.id);
        if (!c) throw new HttpError(404, 'Card not found.');
        const left = await issuer.remainingUsd(c.token_id);
        const add = Math.max(0, Math.floor((c.value - left) * 100) / 100);
        if (add < 1) throw new HttpError(409, 'This card is already full.');
        order = { kind: 'refill', offer_id: null, deck: c.deck, value: add, tier: offAt(c.deck, c.value) ? 'shop' : 'full', price_cents: shopCents(c.deck, add, c.value), expires: Date.now() + DAY, card_id: c.id };
      } else {
        const deck = String(what.deck || ''), value = Number(what.value);
        if (!DECKS.includes(deck) || !VALUES.some(([v]) => v === value)) throw new HttpError(400, 'Unknown card.');
        order = { kind: 'shop', offer_id: null, deck, value, tier: offAt(deck, value) ? 'shop' : 'full', price_cents: shopCents(deck, value), expires: Date.now() + DAY, card_id: null };
      }
      if (db.get("SELECT COUNT(*) AS n FROM cards WHERE user_id = ? AND status != 'deleted'", u.id).n >= 200) throw new HttpError(409, 'You have 200 cards. Delete some before buying more.');
      const id = randomId(12);
      db.run('INSERT INTO orders (id, user_id, kind, offer_id, card_id, deck, value, tier, price_cents, created, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id, u.id, order.kind, order.offer_id, order.card_id, order.deck, order.value, order.tier, order.price_cents, Date.now(), ip);
      const name = order.kind === 'refill' ? `Refill: $${order.value} ${DECK_NAMES[order.deck]} credit` : `$${order.value} ${DECK_NAMES[order.deck]} card`;
      const s = await stripe.checkout({ orderId: id, email: u.email, name, cents: order.price_cents, expiresAt: order.expires,
        successUrl: `${config.siteUrl}/console.html?paid=${id}`, cancelUrl: `${config.siteUrl}/shop.html` });
      db.run('UPDATE orders SET stripe_session = ? WHERE id = ?', s.id, id);
      return { url: s.url };
    },

    spending: (userId) => ({ spent: spentCents(userId) / 100, ultimateNeed: U.needCents / 100 }),

    // Ultimates nobody claimed in time go back into the draw
    sweepUltimates() {
      db.tx(() => {
        for (const o of db.all("SELECT id FROM offers WHERE tier = 'ultimate' AND status = 'open' AND expires < ?", Date.now())) {
          db.run("UPDATE offers SET status = 'expired' WHERE id = ?", o.id);
          db.bump('ultimate_pool', FOREVER);
          db.audit('ultimate.returned', { detail: o.id });
        }
      });
    },

    async webhook(raw, signature) {
      const ev = stripe.verify(raw, signature);
      if (!ev) throw new HttpError(400, 'Bad signature.');
      try { db.run('INSERT INTO stripe_events (id, type, received) VALUES (?, ?, ?)', ev.id, ev.type, Date.now()); } catch { return { duplicate: true }; }
      const obj = ev.data?.object || {};
      if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
        if (obj.payment_status !== 'paid') return { waiting: true };
        const order = db.get('SELECT * FROM orders WHERE id = ?', String(obj.metadata?.order_id || obj.client_reference_id || ''));
        if (!order || order.stripe_session !== obj.id) { db.audit('stripe.mismatch', { detail: `session ${obj.id}` }); return { ignored: true }; }
        if (obj.amount_total !== order.price_cents || String(obj.currency).toLowerCase() !== 'usd') { db.audit('stripe.amount_mismatch', { user: order.user_id, detail: order.id }); return { ignored: true }; }
        if (order.status !== 'pending') return { already: order.status };
        // card fingerprint limits for flip-priced cards
        let fingerprint = '';
        try { const pi = await stripe.paymentIntent(obj.payment_intent); fingerprint = pi.latest_charge?.payment_method_details?.card?.fingerprint || ''; } catch { /* keep going without */ }
        const refuse = order.kind === 'flip' && fingerprint && (
          db.get("SELECT COUNT(*) AS n FROM orders WHERE fingerprint = ? AND kind = 'flip' AND status IN ('paid','issued') AND paid > ?", fingerprint, Date.now() - DAY).n >= 3
          || (order.tier === 'jackpot' && db.get("SELECT COUNT(*) AS n FROM orders WHERE fingerprint = ? AND tier = 'jackpot' AND status IN ('paid','issued') AND paid > ?", fingerprint, Date.now() - 7 * DAY).n >= 1));
        db.run("UPDATE orders SET status = ?, payment_intent = ?, fingerprint = ?, paid = ? WHERE id = ?", refuse ? 'refused' : 'paid', obj.payment_intent, fingerprint, Date.now(), order.id);
        if (refuse) {
          await stripe.refund(obj.payment_intent, 'duplicate').catch(() => {});
          db.audit('order.refused', { user: order.user_id, detail: `${order.id} card limit` });
          return { refused: true };
        }
        if (order.offer_id) db.run("UPDATE offers SET status = 'paid' WHERE id = ?", order.offer_id);
        const fresh = db.get('SELECT * FROM orders WHERE id = ?', order.id);
        try { if (fresh.kind === 'refill') await refill(fresh); else await issueCard(fresh); }
        catch (e) { db.run("UPDATE orders SET status = 'paid_unissued' WHERE id = ?", order.id); db.audit('issue.failed', { user: order.user_id, detail: e.message }); }
        return { ok: true };
      }
      if (ev.type === 'checkout.session.expired') { db.run("UPDATE orders SET status = 'expired' WHERE stripe_session = ? AND status = 'pending'", obj.id); return { ok: true }; }
      if (ev.type === 'charge.dispute.created' || ev.type === 'charge.refunded') {
        const order = db.get('SELECT * FROM orders WHERE payment_intent = ?', String(obj.payment_intent || ''));
        if (!order) return { ignored: true };
        const fullRefund = ev.type === 'charge.refunded' && obj.amount_refunded >= obj.amount;
        if (ev.type === 'charge.dispute.created' || fullRefund) {
          db.run('UPDATE orders SET status = ? WHERE id = ?', ev.type === 'charge.refunded' ? 'refunded' : 'disputed', order.id);
          if (spentCents(order.user_id) < U.needCents) {
            for (const uc of db.all("SELECT c.* FROM cards c JOIN orders o ON o.card_id = c.id WHERE o.user_id = ? AND o.kind = 'ultimate' AND c.status = 'active'", order.user_id)) {
              await issuer.setStatus(uc.token_id, false).catch(() => {});
              db.run("UPDATE cards SET status = 'frozen' WHERE id = ?", uc.id);
              db.audit('ultimate.frozen', { user: order.user_id, detail: uc.id });
            }
          }
          const card = order.card_id && db.get('SELECT * FROM cards WHERE id = ?', order.card_id);
          if (card && card.status === 'active') { await issuer.setStatus(card.token_id, false).catch(() => {}); db.run('UPDATE cards SET status = ? WHERE id = ?', ev.type === 'charge.refunded' ? 'refunded' : 'disputed', card.id); }
          if (ev.type === 'charge.dispute.created') db.run("UPDATE users SET status = 'review', note = 'dispute' WHERE id = ? AND status = 'active'", order.user_id);
          db.audit(ev.type, { user: order.user_id, detail: order.id });
        }
        return { ok: true };
      }
      return { ignored: true };
    },

    // retry issuing for paid orders whose key creation failed (gateway down, etc.)
    async retryIssuing() {
      for (const o of db.all("SELECT * FROM orders WHERE status = 'paid_unissued' AND paid > ? LIMIT 20", Date.now() - 7 * DAY)) {
        try { if (o.kind === 'refill') await refill(o); else await issueCard(o); } catch { /* next round */ }
      }
    },

    async list(userId) {
      const rows = db.all("SELECT * FROM cards WHERE user_id = ? AND status != 'deleted' ORDER BY created DESC LIMIT 200", userId);
      return Promise.all(rows.map(async (c) => {
        let left = null;
        try { left = c.token_id ? await issuer.remainingUsd(c.token_id) : null; } catch { /* show without */ }
        return { id: c.id, kind: c.deck, value: c.value, tier: c.tier, off: c.off, paid: c.paid_cents / 100, serial: c.serial, label: c.label, status: c.status, left, created: c.created };
      }));
    },
    reveal(userId, cardId, { ip }) {
      enforce(limiter, [[`reveal:u:${userId}`, 30, HOUR]]);
      const c = db.get("SELECT * FROM cards WHERE id = ? AND user_id = ? AND status != 'deleted'", String(cardId), userId);
      if (!c || !c.key_enc) throw new HttpError(404, 'Card not found.');
      db.audit('key.revealed', { user: userId, detail: c.id, ip });
      return { key: sealer.open(c.key_enc) };
    },
    rename(userId, cardId, label) {
      const clean = String(label || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 28);
      const r = db.run('UPDATE cards SET label = ? WHERE id = ? AND user_id = ?', clean, String(cardId), userId);
      if (!r.changes) throw new HttpError(404, 'Card not found.');
      return { label: clean };
    },
    async setFrozen(userId, cardId, frozen) {
      const c = db.get('SELECT * FROM cards WHERE id = ? AND user_id = ?', String(cardId), userId);
      if (!c || !['active', 'frozen'].includes(c.status)) throw new HttpError(404, 'Card not found.');
      await issuer.setStatus(c.token_id, !frozen);
      db.run('UPDATE cards SET status = ? WHERE id = ?', frozen ? 'frozen' : 'active', c.id);
      return { status: frozen ? 'frozen' : 'active' };
    },
    async remove(userId, cardId) {
      const c = db.get('SELECT * FROM cards WHERE id = ? AND user_id = ?', String(cardId), userId);
      if (!c || c.status === 'deleted') throw new HttpError(404, 'Card not found.');
      await issuer.remove(c.token_id).catch(() => issuer.setStatus(c.token_id, false));
      db.run("UPDATE cards SET status = 'deleted', key_enc = NULL WHERE id = ?", c.id);
      db.audit('card.deleted', { user: userId, detail: c.id });
      return { ok: true };
    },
  };
}
