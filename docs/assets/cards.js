// Tokard cards: the shared card engine (springs, faces, flip, particles),
// the demo deal state, and small page chrome helpers. Needs assets/site.js first.
(() => {
  'use strict';
  const CA = window.ChinaAPI;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 20) : ms));
  const clamp = (v, a = 0, b = 100) => Math.min(b, Math.max(a, v));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DAY = 24 * 3600 * 1000;

  // ---------- odds & catalogue (published on the site; the only thing that decides a flip) ----------
  // A flip takes an extra cut off the shop price; a jackpot is half the face value. So a flip always beats the shop.
  const TIERS = [
    { key: 'nice', extra: 5, w: 45, name: 'Nice', color: '#A9B2C6' },
    { key: 'good', extra: 10, w: 30, name: 'Good', color: '#A9B2C6' },
    { key: 'great', extra: 15, w: 17, name: 'Great', color: '#2340FF' },
    { key: 'rare', extra: 20, w: 6, name: 'Rare', color: '#7A5CFF' },
    { key: 'jackpot', half: true, w: 2, name: 'Jackpot', color: '#F2B51C' },
    // never drawn by weight: one is released for every 10,000 cards sold (see ULTIMATE)
    { key: 'ultimate', ultimate: true, w: 0, name: 'Ultimate', color: '#F2B51C' },
    // never drawn by weight: the fifth flip in a row without gold becomes one (see PITY)
    { key: 'lucky', lucky: true, w: 0, name: 'Lucky', color: '#F2B51C' },
  ];
  const FULL = { key: 'full', name: '', color: '#2340FF' };
  const SHOP = { key: 'shop', name: '', color: '#2340FF' };
  const VALUES = [[5, 40], [20, 45], [100, 15]];
  const KINDS = [['text', 50], ['image', 25], ['video', 25]];
  const KIND = {
    text: { label: 'Coding credit', deck: 'Coding', via: 'Official DeepSeek API', ladder: [[5, 15], [20, 20], [100, 25]], units: (v) => `≈ ${Math.round(v / 0.525)}M tokens`, unit: '$0.30 in · $1.20 out / 1M tokens' },
    image: { label: 'Design credit', deck: 'Design', via: 'Official BytePlus API', ladder: [[5, 0], [20, 0], [100, 0]], units: (v) => `≈ ${Math.floor(v / 0.045).toLocaleString('en-US')} images`, unit: '$0.045 / image' },
    video: { label: 'Film credit', deck: 'Film', via: 'Official BytePlus API', ladder: [[5, 10], [20, 14], [100, 17]], units: (v) => (v / 0.23 < 60 ? `≈ ${Math.floor(v / 0.23)} s of 720p video` : `≈ ${Math.floor(v / 0.23 / 60)} min of 720p video`), unit: '$0.23 / second, 720p' },
  };
  const JACKPOTS_PER_DAY = 20;
  const weighted = (table, w = (x) => x[1]) => { let r = Math.random() * table.reduce((s, x) => s + w(x), 0); for (const x of table) { if ((r -= w(x)) < 0) return x; } return table[table.length - 1]; };
  const BY_KEY = Object.fromEntries([...TIERS, FULL, SHOP].map((t) => [t.key, t]));
  // takes an offer or card; plain numbers are shop or face-value cards
  const tierOf = (x) => (x && typeof x === 'object' ? BY_KEY[x.tier] || (x.off ? SHOP : FULL) : x ? SHOP : FULL);
  const round2 = (v) => Math.round(v * 100) / 100;
  // shop discount grows with the card: the bracket is the card's face value (a refill uses its card's)
  const offAt = (kind, value) => KIND[kind].ladder.reduce((off, [v, o]) => (value >= v ? o : off), KIND[kind].ladder[0][1]);
  const maxOff = (kind) => Math.max(...KIND[kind].ladder.map((x) => x[1]));
  const shopPrice = (kind, value, bracket = value) => round2(value * (1 - offAt(kind, bracket) / 100));
  // the Ultimate: one $100 card at 0.01折 ($0.10) for every 10,000 cards sold sitewide.
  // Anyone can turn it over; only an account with $20+ of purchases can claim it.
  const ULTIMATE = { every: 10000, value: 100, price: 0.1, off: 99.9, need: 20, odds: 1000, holdMs: 86400e3 };
  const FLIP_FLOOR = 0.6;   // a flip never goes below cost; only the capped jackpots do
  // gold within five: if four flips in a row miss gold, the fifth is a Lucky card at 7折.
  // Daily flips and invite flips both count, and the count carries over to the next day.
  const PITY = { every: 5, price: 0.7 };
  const flipPrice = (kind, value, t) => (t.ultimate ? ULTIMATE.price : t.half ? round2(value / 2) : t.lucky ? round2(value * PITY.price) : Math.max(round2(shopPrice(kind, value) * (1 - t.extra / 100)), round2(value * FLIP_FLOOR)));
  const offOf = (value, price) => Math.round((1 - price / value) * 100);
  // a flipped card under 7.5折 (75% of face value) turns gold: gold light, gold foil, the big reveal
  const GOLD = '#F2B51C', GOLD_BELOW = 0.75;
  const isUltimate = (o) => !!o && o.tier === 'ultimate';
  const isGold = (o) => !!o && TIERS.some((t) => t.key === o.tier) && (o.tier === 'jackpot' || o.tier === 'ultimate' || o.price < o.value * GOLD_BELOW - 1e-9);
  const glowOf = (o) => (isGold(o) ? GOLD : tierOf(o).color);
  const fmt = (v) => '$' + (Number.isInteger(+v) ? +v : (+v).toFixed(2));
  const left = (t) => { const ms = Math.max(0, t - Date.now()); const h = Math.floor(ms / 3600e3), m = Math.floor(ms / 60e3) % 60, s = Math.floor(ms / 1e3) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
  const fakeKey = () => 'sk-' + Array.from(crypto.getRandomValues(new Uint8Array(40)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[b % 57]).join('');
  const serial = () => String(Math.floor(Math.random() * 9000) + 1000);

  // ---------- pixel art (24 × 14 windows: one scene per deck and card size) ----------
  // $5, $20, $100 each get their own scene; anything from $50 up uses the big one
  const ART = {
    text: [{ pal: { '.': '#E8EDFF', w: '#FFFFFF', g: '#C3CBE6', b: '#4D6BFE', l: '#FFFFFF', c: '#0B0D12' }, rows: [
      '........................',
      '...........bbbbbbbbbbbb.',
      '...........bllllllllllb.',
      '...........bbbbbbbbbbbb.',
      '...........bllllllbbbbb.',
      '...........bbbbbbbbbbbb.',
      '....................bb..',
      '........................',
      '.wwwwwwwwwww............',
      '.wwgwwgwwcww............',
      '.wwwwwwwwwww............',
      '..ww....................',
      '........................',
      '........................'], blink: 'c' }, { pal: { '.': '#E8EDFF', w: '#FFFFFF', b: '#4D6BFE', l: '#FFFFFF', k: '#161B33', v: '#8EA2FF', y: '#7EE2B8', o: '#FFB86B', i: '#FFFFFF' }, rows: [
      '........................',
      '.............bbbbbbbbbb.',
      '.............bllllllbbb.',
      '.............bbbbbbbbbb.',
      '....................bb..',
      '.wwwwwwwwwwwwwwwwwww....',
      '.wkkkkkkkkkkkkkkkkkw....',
      '.wkvvvvkyyyyyykkkkkw....',
      '.wkkkoooookvvvvvkkkw....',
      '.wkkkyyyyyyyykkkkkkw....',
      '.wkvvvikkkkkkkkkkkkw....',
      '.wkkkkkkkkkkkkkkkkkw....',
      '.wwwwwwwwwwwwwwwwwww....',
      '..ww....................'], blink: 'i' }, { pal: { '.': '#E8EDFF', w: '#FFFFFF', g: '#C3CBE6', b: '#4D6BFE', l: '#FFFFFF', c: '#0B0D12' }, rows: [
      '........................',
      '.wwwwwwwwwwwww..........',
      '.wgggggggggggw..........',
      '.wwwwwwwwwwwww..........',
      '.wggggggwwwwww..........',
      '.wwwwwwwwwwwww..........',
      '..ww....................',
      '.........bbbbbbbbbbbbbb.',
      '.........bllllllllllllb.',
      '.........bbbbbbbbbbbbbb.',
      '.........bllllllllcbbbb.',
      '.........bbbbbbbbbbbbbb.',
      '....................bb..',
      '........................'], blink: 'c' }],
    image: [{ pal: { '.': '#FFEBD6', p: '#FF8A3D', q: '#FFC08A', k: '#3A2A1F', w: '#FFFFFF', e: '#F6DEC6', d: '#E2C3A4' }, rows: [
      '........................',
      '...w.......kk...........',
      '..www......kk...........',
      '...w......pppp..........',
      '.........pqpppp.........',
      '.........pqpppp.........',
      '.........pqwwpp.........',
      '.........pqwwpp.........',
      '.........pqpppp.........',
      '.........pppppp......w..',
      '.....eeeeeeeeeeeeee.www.',
      '.....dddddddddddddd..w..',
      '.....dddddddddddddd.....',
      '.....dddddddddddddd.....'], blink: 'w' }, { pal: { '.': '#ECE8FF', f: '#FFFFFF', r: '#1D7BFF', s: '#FFC83D', w: '#FFFFFF', n: '#B9B0E8' }, rows: [
      '........................',
      '......ffffffffffff......',
      '......frrrrrrrrrrfn.....',
      '......frrrrssrrrrfn.....',
      '......frrrssssrrrfn.....',
      '......frrssssssrrfn.....',
      '......frrssssssrrfn.....',
      '......frrrssssrrrfn.....',
      '......frrrrssrrrrfn.....',
      '......frrrrrrrrrrfn.....',
      '......frwwwwwwwwrfn.....',
      '......frwwwwrrrrrfn.....',
      '......ffffffffffffn.....',
      '.......nnnnnnnnnnnn.....'] }, { pal: { '.': '#DDF7FF', s: '#FFC83D', m: '#1D7BFF', n: '#0B3A8C', w: '#FFFFFF', g: '#4ED8A0', h: '#34B985' }, rows: [
      '........................',
      '.................sss....',
      '.................sss....',
      '.................sss....',
      '........................',
      '......w.................',
      '.....mwm................',
      '....mmmmm.......w.......',
      '...mmmmmmm.....nwn......',
      '..mmmmmmmmm...nnnnn.....',
      '.mmmmmmmmmmm.nnnnnnn....',
      'mmmmmmmmmmmmnnnnnnnnn...',
      'gggghggggggggghggggggggg',
      'gggggggggghggggggggghggg'] }],
    video: [{ pal: { '.': '#DBF7FA', k: '#0B1F2A', t: '#11B5CF', p: '#FFFFFF', u: '#7FF3FF', d: '#0B5C8A', r: '#FF5A7A' }, rows: [
      '.......kkkkkkkkkk.......',
      '.......kttttttttk.......',
      '.......kttttttttk.......',
      '.......kttttttttk.r.r...',
      '.......ktttpttttk.rrr...',
      '.......ktttpptttk..r....',
      '.......ktttpppttk.......',
      '.......ktttpptttk.......',
      '.......ktttpttttk.......',
      '.......kttttttttk.......',
      '.......kttttttttk.......',
      '.......kuuuuddddk.......',
      '.......kttttttttk.......',
      '.......kkkkkkkkkk.......'], blink: 'r' }, { pal: { '.': '#DBF7FA', k: '#0B1F2A', h: '#FFFFFF', d: '#0B5C8A', t: '#11B5CF', u: '#7FF3FF' }, rows: [
      '........................',
      '....hhhkkkhhhkkkhhhk....',
      '....hhkkkhhhkkkhhhkk....',
      '....hkkkhhhkkkhhhkkk....',
      '....k...................',
      '....kkkkkkkkkkkkkkkk....',
      '....khhkkkhhhkkkhhhk....',
      '....kkkkkkkkkkkkkkkk....',
      '....kddddddddddddddk....',
      '....kduuuuddtttttddk....',
      '....kddddddddddddddk....',
      '....kdhhhhdddhhhdddk....',
      '....kddddddddddddddk....',
      '....kkkkkkkkkkkkkkkk....'] }, { pal: { '.': '#DBF7FA', k: '#0B1F2A', h: '#FFFFFF', t: '#11B5CF', d: '#0B5C8A', p: '#FFFFFF', u: '#7FF3FF' }, rows: [
      'kkkkkkkkkkkkkkkkkkkkkkkk',
      'khkkhkkhkkhkkhkkhkkhkkhk',
      'kkkkkkkkkkkkkkkkkkkkkkkk',
      'tttttttkddddddddkttttttt',
      'tttttttkddpdddddkttttttt',
      'tuuutttkddppddddkttuuutt',
      'tuuutttkddpppdddkttuuutt',
      'tuuutttkddppddddkttttttt',
      'tttttttkddpdddddkttttttt',
      'tttttttkddddddddkttttttt',
      'tttttttkddddddddkttttttt',
      'kkkkkkkkkkkkkkkkkkkkkkkk',
      'khkkhkkhkkhkkhkkhkkhkkhk',
      'kkkkkkkkkkkkkkkkkkkkkkkk'] }],
  };
  const artFor = (value) => (value >= 50 ? 2 : value >= 20 ? 1 : 0);
  const artCache = {};
  function pixelArt(kind, value = 100) {
    const n = artFor(value), id = kind + n;
    if (artCache[id]) return artCache[id];
    const a = ART[kind][n]; let rects = '';
    a.rows.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const ch = row[x]; let n = 1;
        while (x + n < row.length && row[x + n] === ch) n++;
        if (ch !== '.') rects += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${a.pal[ch]}"${a.blink === ch ? ' class="blink"' : ''}/>`;
        x += n;
      }
    });
    return (artCache[id] = `<svg viewBox="0 0 24 14" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true"><rect width="24" height="14" fill="${a.pal['.']}"/>${rects}</svg>`);
  }
  // tiled pixel marks for the card back
  // card-back field: the logo's spark, small and faint, staggered
  const SPARK = (x, y, c) => `<path fill='${c}' transform='translate(${x} ${y})' d='M2 0h1v2h1v1h1v1h-1v1h-1v2h-1v-2h-1v-1h-1v-1h1v-1h1z'/>`;
  document.documentElement.style.setProperty('--mark-tile', `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28' shape-rendering='crispEdges' fill-opacity='.13'>${SPARK(4, 3, '#FFFFFF')}${SPARK(18, 17, '#FFFFFF')}</svg>`)}")`);
  const MARK_URL = 'assets/brand/tokard-mark.svg';

  // ---------- demo state (this browser only; the live site keeps this on the server) ----------
  const STORE = 'tokard.demo.v4';
  const seedWallet = () => {
    const now = Date.now();
    return [
      { id: 'seed1', kind: 'text', value: 100, paid: 67.5, off: 33, tier: 'good', key: fakeKey(), serial: '2041', label: 'Support bot', left: 61.2, boughtAt: now - 9 * DAY, seed: true, offerId: 'h1' },
      { id: 'seed2', kind: 'image', value: 100, paid: 100, off: 0, tier: 'full', key: fakeKey(), serial: '3317', label: 'Product shots', left: 38.7, boughtAt: now - 5 * DAY, seed: true },
      { id: 'seed3', kind: 'video', value: 20, paid: 14.62, off: 27, tier: 'great', key: fakeKey(), serial: '0786', label: 'Launch teaser', left: 4.6, boughtAt: now - 2 * DAY, seed: true, offerId: 'h4' },
    ];
  };
  // past flips for the demo history (expires = flipped + 24 h)
  const seedOffers = () => {
    const now = Date.now(), o = (id, d, kind, value, tier) => { const price = flipPrice(kind, value, BY_KEY[tier]); return { id, kind, value, tier, off: offOf(value, price), price, expires: now - d * DAY + DAY, serial: serial(), seed: true }; };
    return [o('h5', 1.4, 'text', 20, 'nice'), o('h4', 2.1, 'video', 20, 'great'), o('h3', 4.2, 'image', 100, 'rare'), o('h2', 6.3, 'image', 20, 'nice'), o('h1', 9.1, 'text', 100, 'good')];
  };
  // today's hand: one face-down card per deck, new every day at 00:00 UTC
  const DECKS = ['text', 'image', 'video'];
  const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
  const nextDay = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); };
  // extra flips come only from friends who sign up and flip; at most 3 earned a day, 10 held
  const TICKETS_PER_DAY = 3, TICKETS_MAX = 10;
  const blank = () => ({ day: dayKey(), hand: {}, offers: seedOffers(), cards: seedWallet(), jackpotsLeft: 14, tickets: 0, earned: {}, invite: '', spent: 0, lastUltimate: 0, pity: 0 });
  let S = Object.assign(blank(), CA.store.get(STORE, {}));
  function roll() { if (S.day !== dayKey()) { S.day = dayKey(); S.hand = {}; S.jackpotsLeft = 17; CA.store.set(STORE, S); } }
  const state = {
    get: () => { roll(); return S; },
    save: () => CA.store.set(STORE, S),
    reset() { S = blank(); CA.store.set(STORE, S); return S; },
    day: () => { roll(); return S.day; },
    canFlip: (kind) => { roll(); return kind ? !S.hand[kind] : DECKS.some((k) => !S.hand[k]); },
    nextFlipAt: () => nextDay(),
    handOf: (kind) => { roll(); const id = S.hand[kind]; return id ? S.offers.find((o) => o.id === id) || null : null; },
    hand: () => DECKS.map((kind) => ({ kind, offer: state.handOf(kind) })),
    cardFor: (o) => (o ? S.cards.find((c) => c.offerId === o.id) || null : null),
    isOpen: (o) => !!o && o.status !== 'void' && !state.cardFor(o) && o.expires > Date.now(),
    todaysOffer: () => state.hand().map((h) => h.offer).find((o) => state.isOpen(o)) || null,
    todaysCard: () => state.hand().map((h) => state.cardFor(h.offer)).find(Boolean) || null,
    deal(kind) {
      roll();
      kind = kind || DECKS.find((k) => !S.hand[k]) || weighted(KINDS)[0];
      if (S.hand[kind]) return state.handOf(kind);
      return draw(kind);
    },
    tickets: () => S.tickets || 0,
    // flips since the last gold card; at every - 1 the next flip is gold
    pity: () => { const since = Math.min(PITY.every - 1, S.pity || 0); return { since, every: PITY.every, left: PITY.every - since }; },
    // demo only: put today's unclaimed cards back face down (used by the Ultimate preview)
    redeal() { roll(); for (const k of DECKS) { const o = state.handOf(k); if (o && !state.cardFor(o)) { o.status = 'void'; delete S.hand[k]; } } state.save(); },
    // what this account has really paid (the sample cards in the demo wallet don't count)
    spent: () => +(S.spent || 0).toFixed(2),
    addSpent(v) { S.spent = +((S.spent || 0) + v).toFixed(2); state.save(); },
    canClaimUltimate: () => state.spent() >= ULTIMATE.need && !(S.lastUltimate > Date.now() - 30 * DAY),
    // cards sold sitewide (demo: a steady stream), and how many until the next Ultimate is released
    sold: () => 3184000 + Math.floor((Date.now() - Date.UTC(2026, 9, 1)) / 9000),
    nextUltimateIn: () => ULTIMATE.every - (state.sold() % ULTIMATE.every),
    inviteCode() { if (!S.invite) { S.invite = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join(''); state.save(); } return S.invite; },
    // demo stand-in for "a friend you invited signed up and flipped their first card"
    grantTicket() {
      roll(); const d = S.day; S.earned = S.earned || {};
      if ((S.earned[d] || 0) >= TICKETS_PER_DAY) return { ok: false, why: 'day' };
      if ((S.tickets || 0) >= TICKETS_MAX) return { ok: false, why: 'max' };
      S.earned = { [d]: (S.earned[d] || 0) + 1 }; S.tickets = (S.tickets || 0) + 1; state.save(); return { ok: true };
    },
    // spend a ticket: the unclaimed card for this deck goes back face down and is drawn again
    reflip(kind) {
      roll();
      const old = state.handOf(kind);
      if (!old || state.cardFor(old) || !(S.tickets > 0) || isUltimate(old)) return null;
      old.status = 'void'; S.tickets--;
      delete S.hand[kind];
      return draw(kind);
    },
  };
  // demo: add #ultimate to the address to make the next flip the Ultimate
  const forceUltimate = () => { if (location.hash !== '#ultimate') return false; history.replaceState(null, '', location.pathname + location.search); return true; };
  function draw(kind) {
    let o;
    if (forceUltimate() || Math.random() * ULTIMATE.odds < 1) {
      o = { id: Math.random().toString(36).slice(2, 10), kind, value: ULTIMATE.value, tier: 'ultimate', off: ULTIMATE.off, price: ULTIMATE.price, expires: Date.now() + ULTIMATE.holdMs, serial: serial() };
    } else {
      const value = weighted(VALUES)[0];
      let tier = weighted(TIERS, (t) => t.w);
      if (tier.half && S.jackpotsLeft <= 0) tier = BY_KEY.rare;
      if (tier.half) S.jackpotsLeft--;
      const price = flipPrice(kind, value, tier);
      o = { id: Math.random().toString(36).slice(2, 10), kind, value, tier: tier.key, off: offOf(value, price), price, expires: Date.now() + DAY, serial: serial() };
      // the fifth flip in a row without gold turns gold
      if (!isGold(o) && (S.pity || 0) >= PITY.every - 1) { const p = flipPrice(kind, value, BY_KEY.lucky); Object.assign(o, { tier: 'lucky', price: p, off: offOf(value, p) }); }
    }
    S.pity = isGold(o) ? 0 : (S.pity || 0) + 1;
    S.hand[kind] = o.id; S.offers.unshift(o); state.save();
    return o;
  }
  Object.assign(state, {
    buy(o, label) {
      const card = { id: 'c' + Math.random().toString(36).slice(2, 9), offerId: o.id, kind: o.kind, value: o.value, paid: o.price, off: o.off, tier: o.tier || tierOf(o).key, key: fakeKey(), serial: o.serial || serial(), label: label || '', left: o.value, boughtAt: Date.now(), fresh: true, fromFlip: !!o.off };
      S.cards.unshift(card);
      state.save();
      return card;
    },
    // the shop's everyday price: fixed per deck
    shopOffer: (kind, value) => ({ id: 'fv' + Math.random().toString(36).slice(2, 8), kind, value, tier: offAt(kind, value) ? 'shop' : 'full', off: offAt(kind, value), price: shopPrice(kind, value), expires: Date.now() + DAY, serial: serial() }),

  });

  // ---------- springs (same model as Svelte's spring) ----------
  class Spring {
    constructor(v, o) { this.v = { ...v }; this.l = { ...v }; this.t = { ...v }; this.k = o.k; this.d = o.d; this.p = o.p || 0.01; }
    set(t, hard) { Object.assign(this.t, t); if (hard || reduced) { Object.assign(this.v, t); Object.assign(this.l, t); } }
    step(dt) {
      let moving = false;
      for (const key in this.t) {
        const cur = this.v[key], last = this.l[key], tgt = this.t[key];
        const vel = (cur - last) / (dt || 1), acc = this.k * (tgt - cur) - this.d * vel, delta = (vel + acc) * dt;
        if (Math.abs(delta) < this.p && Math.abs(tgt - cur) < this.p) { this.v[key] = tgt; this.l[key] = tgt; }
        else { moving = true; this.l[key] = cur; this.v[key] = cur + delta; }
      }
      return moving;
    }
  }
  const S_TILT = { k: 0.066, d: 0.25 }, S_POS = { k: 0.045, d: 0.36 }, S_FLIP = { k: 0.038, d: 0.27, p: 0.05 };

  const engine = { cards: new Set(), raf: 0, last: 0, visible: true };
  function kick() { if (!engine.raf) { engine.last = performance.now(); engine.raf = requestAnimationFrame(frame); } }
  function frame(now) {
    const dt = Math.min(3, (now - engine.last) / 16.667); engine.last = now;
    let active = false;
    for (const c of engine.cards) if (c.update(dt, now)) active = true;
    engine.raf = active ? requestAnimationFrame(frame) : 0;
  }
  document.addEventListener('visibilitychange', () => { engine.visible = !document.hidden; if (engine.visible) kick(); });

  // ---------- faces ----------
  const corners = '<span class="pxc tl"></span><span class="pxc tr"></span><span class="pxc bl"></span><span class="pxc br"></span>';
  const backFace = (deck) => `<div class="pc-face pc-back"><div class="tile"></div><div class="pix"></div><div class="frame"></div>${corners}
    <div class="mark"></div>${deck ? `<div class="deck">${esc(KIND[deck].deck)}</div>` : ''}<div class="pc-beam"></div><div class="pc-shine"></div><div class="pc-glare"></div></div>`;
  function frontFace(o, opts = {}) {
    const m = CA.MODELS[o.kind], k = KIND[o.kind], t = tierOf(o);
    const showPrice = opts.priceShown ?? opts.static;
    const segs = opts.budget ? Math.round(clamp(opts.budget.left / o.value, 0, 1) * 20) : 0;
    // no captions on the card: a struck number is the old price, a bar is what's left
    const priceRow = opts.budget
      ? `<div class="r2"><span class="fv left">${fmt(+opts.budget.left.toFixed(2))}<small> / $${o.value}</small></span></div>
         <div class="budget"><div class="bar">${Array.from({ length: 20 }, (_, i) => `<i${i < segs ? ' class="on"' : ''}></i>`).join('')}</div></div>`
      : o.off
        ? `<div class="r2"><span class="fv cut">$${o.value}</span><span class="price"><span class="odo">${showPrice ? fmt(o.price) : '$' + o.value}</span></span></div>`
        : `<div class="r2"><span class="fv">$${o.value}</span></div>`;
    return `<div class="pc-face pc-front">
      <div class="win">${pixelArt(o.kind, o.value)}</div>
      <div class="badge"><img src="${m.logo}" alt=""></div>
      <div class="who"><span class="mname">${esc(m.name)}</span>${opts.budget ? '' : opts.label ? `<span class="label">${esc(opts.label)}</span>` : `<span class="units">${esc(k.units(o.value))}</span>`}</div>
      <div class="panel">
        <div class="r1">${opts.budget && opts.label ? `<span class="label">${esc(opts.label)}</span>` : '<span></span>'}${o.off ? `<span class="chip">${t.name ? t.name.toUpperCase() + ' ' : ''}−${o.off}%</span>` : ''}</div>
        ${priceRow}
        <div class="r3"><span class="official"><svg viewBox="0 0 12 12" aria-hidden="true" shape-rendering="crispEdges"><path fill="#13A35A" d="M0 0h12v12h-12z"/><path fill="#fff" d="M2 6h2v1h-2zM3 7h2v1h-2zM4 8h2v1h-2zM6 7h1v1h-1zM7 6h1v1h-1zM8 5h1v1h-1zM9 4h1v1h-1z"/></svg>${esc(k.via)}</span><span class="brand"><img src="${MARK_URL}" alt="Tokard"></span></div>
      </div>
      <div class="unlock">UNLOCKED</div><div class="sweep"></div><div class="pc-shine"></div><div class="pc-glare"></div></div>`;
  }
  function tag(el, o) { const t = tierOf(o); el.dataset.kind = o.kind; el.dataset.tier = t.key; el.toggleAttribute('data-gold', isGold(o)); el.toggleAttribute('data-ultimate', isUltimate(o)); el.style.setProperty('--tc', glowOf(o)); }
  // a static face-up card scaled to `width` px (wallet, shop, offers, share)
  function mini(o, { width = 180, label = '', budget = null, lift = true, extra = '' } = {}) {
    const t = tierOf(o);
    return `<div class="cmini${lift ? ' lift' : ''}" style="--mw:${width}px;--mw-n:${width}"><div class="scale"><div class="pc static revealed quiet" data-kind="${o.kind}" data-tier="${t.key}"${isGold(o) ? ' data-gold' : ''}${isUltimate(o) ? ' data-ultimate' : ''} style="--tc:${glowOf(o)}">${frontFace(o, { static: true, label, budget })}</div></div>${extra}</div>`;
  }

  // ---------- interactive card ----------
  class Card {
    constructor({ label = 'Card', deck = '', onClick = null, onEnter = null, onLeave = null } = {}) {
      this.el = document.createElement('div');
      this.el.className = 'pc';
      this.el.innerHTML = `<div class="pc-rays"></div><div class="pc-aura"></div><div class="pc-shadow"></div><button class="pc-rot" type="button" aria-label="${esc(label)}">${backFace(deck)}</button>`;
      this.rot = this.el.querySelector('.pc-rot');
      this.tilt = new Spring({ x: 0, y: 0 }, S_TILT);
      this.glare = new Spring({ x: 50, y: 50, o: 0 }, S_TILT);
      this.bg = new Spring({ x: 50, y: 50 }, S_TILT);
      this.pos = new Spring({ x: 0, y: 0, s: 0.4, rz: 0, op: 0 }, S_POS);
      this.flip = new Spring({ f: 0 }, S_FLIP);
      this.fw = new Spring({ w: 0 }, { k: 0.02, d: 0.3, p: 0.001 }); this.float = 0; this.hover = false; this.fy = 0; this.frz = 0;
      this.showcase = false; this.interacting = false; this.idleSince = 0; this.locked = false;
      this.onClick = onClick; this.onEnter = onEnter; this.onLeave = onLeave;
      engine.cards.add(this);
      this.bind();
    }
    destroy() { engine.cards.delete(this); this.el.remove(); }
    update(dt, now) {
      const show = this.showcase && engine.visible && this.inView !== false;
      if (show && !this.interacting && now - this.idleSince > 1400) {
        const t = now / 1000 + (this.phase || 0);
        this.tilt.set({ x: Math.sin(t * 0.8) * 9, y: Math.cos(t * 0.55) * 5 });
        this.glare.set({ x: 50 + Math.sin(t * 0.8) * 32, y: 45 + Math.cos(t * 0.55) * 26, o: 0.72 });
        this.bg.set({ x: 50 + Math.sin(t * 0.8) * 12, y: 50 + Math.cos(t * 0.55) * 12 });
      }
      // floating: each card bobs on its own phase; hovering settles it, a pick stops it
      const floatOn = this.float && !reduced && engine.visible && this.inView !== false;
      this.fw.set({ w: floatOn ? this.float * (this.hover ? 0.15 : 1) : 0 });
      const w = this.fw.v.w;
      if (w > 0.002) {
        const t = now / 1000 + (this.phase || 0);
        this.fy = Math.sin(t * 1.1) * 9 * w; this.frz = Math.sin(t * 0.62 + 1.3) * 1.1 * w;
        if (!this.interacting && !show) {
          this.tilt.set({ x: Math.sin(t * 0.7) * 4 * w, y: Math.cos(t * 0.55) * 3 * w });
          this.glare.set({ x: 50 + Math.sin(t * 0.6) * 34, y: 42 + Math.cos(t * 0.45) * 28, o: 0.32 * w });
          this.bg.set({ x: 50 + Math.sin(t * 0.6) * 14, y: 50 + Math.cos(t * 0.45) * 14 });
        }
      } else { this.fy = 0; this.frz = 0; }
      let a = false;
      for (const s of [this.tilt, this.glare, this.bg, this.pos, this.flip, this.fw]) a = s.step(dt) || a;
      this.apply();
      return a || show || w > 0.002;
    }
    apply() {
      const st = this.el.style, p = this.pos.v, g = this.glare.v, b = this.bg.v, r = this.tilt.v;
      st.setProperty('--tx', p.x.toFixed(2) + 'px'); st.setProperty('--ty', (p.y + this.fy).toFixed(2) + 'px'); st.setProperty('--s', p.s.toFixed(4));
      st.setProperty('--rz', (p.rz + this.frz).toFixed(2) + 'deg'); st.setProperty('--lift', (-this.fy).toFixed(2)); st.setProperty('--op', clamp(p.op, 0, 1).toFixed(3));
      st.setProperty('--ry', r.x.toFixed(2) + 'deg'); st.setProperty('--rx', r.y.toFixed(2) + 'deg');
      st.setProperty('--ry-n', r.x.toFixed(2)); st.setProperty('--rx-n', r.y.toFixed(2));
      st.setProperty('--flip', this.flip.v.f.toFixed(2) + 'deg');
      st.setProperty('--px', g.x.toFixed(1) + '%'); st.setProperty('--py', g.y.toFixed(1) + '%'); st.setProperty('--o', clamp(g.o, 0, 1).toFixed(3));
      st.setProperty('--bx', b.x.toFixed(1) + '%'); st.setProperty('--by', b.y.toFixed(1) + '%');
      st.setProperty('--pfc', clamp(Math.hypot(g.x - 50, g.y - 50) / 50, 0, 1).toFixed(3));
      st.setProperty('--pfl', (g.x / 100).toFixed(3));
    }
    place(p, hard) { this.pos.set(p, hard); if (hard) this.apply(); kick(); }
    bind() {
      const move = (e) => {
        const pt = e.touches ? e.touches[0] : e;
        const r = this.rot.getBoundingClientRect();
        const px = clamp((pt.clientX - r.left) / r.width * 100), py = clamp((pt.clientY - r.top) / r.height * 100);
        this.interacting = true; this.idleSince = performance.now();
        const k = this.tiltScale || 1;
        this.tilt.set({ x: -(px - 50) / 3.2 * k, y: (py - 50) / 3.2 * k });
        this.glare.set({ x: px, y: py, o: 1 });
        this.bg.set({ x: 37 + px * 0.26, y: 33 + py * 0.34 });
        kick();
      };
      const leave = () => {
        this.interacting = false; this.idleSince = performance.now();
        this.tilt.set({ x: 0, y: 0 }); this.glare.set({ x: 50, y: 50, o: this.showcase ? 0.72 : 0 }); this.bg.set({ x: 50, y: 50 });
        if (this.onLeave) this.onLeave(this);
        kick();
      };
      if (!reduced) {
        this.rot.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') move(e); });
        this.rot.addEventListener('pointerleave', leave);
        this.rot.addEventListener('touchmove', (e) => { if (this.touchTilt) { e.preventDefault(); move(e); } }, { passive: false });
        this.rot.addEventListener('touchend', leave);
      }
      this.rot.addEventListener('pointerenter', () => { if (this.onEnter) this.onEnter(this); kick(); });
      this.rot.addEventListener('focus', () => { if (this.onEnter) this.onEnter(this); kick(); });
      this.rot.addEventListener('blur', () => { if (this.onLeave) this.onLeave(this); kick(); });
      this.rot.addEventListener('click', () => { if (this.onClick) this.onClick(this); });
    }
    setFront(o, opts) {
      const old = this.rot.querySelector('.pc-front'); if (old) old.remove();
      tag(this.el, o);
      this.rot.insertAdjacentHTML('beforeend', frontFace(o, opts));
    }
    // anticipation → flip → reveal; resolves once the face is showing
    async flipReveal(o, fx) {
      const t = tierOf(o), gold = isGold(o);
      if (gold && !reduced) {
        // the gold summon: the card heats from cobalt to gold, light pulls in, it shakes harder, then bursts
        const ult = isUltimate(o), n = ult ? 28 : 15;
        this.el.classList.add('summon', 'hot'); if (ult) this.el.classList.add('ult');
        if (fx) fx.gather(this, ult ? 2600 : 1500, ult);
        for (let i = 0; i < n; i++) { const k = 1 + i / 5; this.tilt.set({ x: (Math.random() - 0.5) * 5 * Math.min(k, 4), y: (Math.random() - 0.5) * 3.4 * Math.min(k, 4) }); kick(); await sleep(ult ? Math.max(60, 100 - i * 2.5) : 100 - i * 3); }
        this.tilt.set({ x: 0, y: 0 }); kick(); await sleep(ult ? 420 : 170);
        if (fx) fx.ignite(this, ult);
        this.el.classList.remove('summon');
        this.flip.set({ f: ult ? 900 : 540 }); kick();
      } else {
        this.el.classList.remove('hot');
        this.el.classList.add('charging');
        if (!reduced) { for (let i = 0; i < 7; i++) { this.tilt.set({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 4 }); kick(); await sleep(110); } this.tilt.set({ x: 0, y: 0 }); }
        this.el.classList.remove('charging');
        this.flip.set({ f: t.half ? 540 : 180 }); kick();
      }
      if (!reduced) await new Promise((res) => { const chk = () => (this.flip.v.f > this.flip.t.f - 8 ? res() : requestAnimationFrame(chk)); chk(); });
      this.el.classList.add('revealed');
      odometer(this.el.querySelector('.odo'), fmt(o.price), !reduced);
      if (fx) fx.celebrate(this, t, gold);
      if (gold && !reduced) { this.el.classList.add('glint'); setTimeout(() => this.el.classList.remove('glint'), 1600); }
      if (!isUltimate(o)) this.el.classList.remove('ult');
      this.showcase = !reduced; this.idleSince = performance.now(); kick();
      document.dispatchEvent(new CustomEvent('tokard:reveal', { detail: { offer: o, el: this.el } }));
    }
  }

  // odometer: each digit column rolls through 0–9 at least once
  function odometer(el, text, animate) {
    if (!el) return;
    if (!animate) { el.textContent = text; return; }
    el.innerHTML = [...text].map((ch) => /\d/.test(ch) ? `<span class="col">${'01234567890123456789'.split('').map((d) => `<i>${d}</i>`).join('')}</span>` : `<i>${ch}</i>`).join('');
    const cols = [...el.querySelectorAll('.col')], digits = [...text].filter((c) => /\d/.test(c));
    requestAnimationFrame(() => requestAnimationFrame(() => cols.forEach((c, i) => { c.style.transitionDuration = (1.2 + i * 0.22) + 's'; c.style.transform = `translateY(-${10 + +digits[i]}em)`; })));
  }
  function decode(el, text, ms) {
    const glyphs = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    if (!ms || reduced) { el.textContent = text; return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms), n = Math.floor(text.length * (1 - Math.pow(1 - p, 2)));
      let html = esc(text.slice(0, n));
      for (let i = n; i < text.length; i++) html += `<span class="scr">${glyphs[(Math.random() * glyphs.length) | 0]}</span>`;
      el.innerHTML = html;
      if (p < 1) requestAnimationFrame(step); else el.textContent = text;
    };
    requestAnimationFrame(step);
  }

  // ---------- particles (wobble + tilt + decay, after canvas-confetti) ----------
  function makeFx(stage) {
    const canvas = document.createElement('canvas'); canvas.className = 'fx'; canvas.setAttribute('aria-hidden', 'true');
    const flash = document.createElement('div'); flash.className = 'flash';
    stage.append(flash, canvas);
    const ctx = canvas.getContext('2d');
    let parts = [], raf = 0;
    const size = () => { const d = devicePixelRatio || 1; canvas.width = stage.clientWidth * d; canvas.height = stage.clientHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    const center = (card) => { const r = card.rot.getBoundingClientRect(), v = stage.getBoundingClientRect(); return { x: r.left - v.left + r.width / 2, y: r.top - v.top + r.height / 2 }; };
    function star(x, y, r) { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.32 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
    function draw() {
      ctx.clearRect(0, 0, stage.clientWidth, stage.clientHeight);
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        if (p.mote) {
          // drawn in towards the card, faster as it gets close
          p.k += p.dk; const e = p.k * p.k * p.k;
          p.x = p.sx + (p.tx - p.sx) * e; p.y = p.sy + (p.ty - p.sy) * e; p.life = p.k >= 1 ? 0 : 1; p.tw += 0.3;
          ctx.globalAlpha = Math.min(1, p.k * 4) * (1 - e * 0.6); ctx.fillStyle = p.c;
          const z = p.size * (1 - e * 0.5); ctx.fillRect(p.x - z / 2, p.y - z / 2, z, z);
          continue;
        }
        p.vx *= 0.975; p.vy = p.vy * 0.975 + (p.g ?? 0.32); p.wob += p.wobS; p.x += p.vx + Math.cos(p.wob) * 0.9; p.y += p.vy; p.tilt += 0.09; p.life -= p.decay; p.tw += 0.25;
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5)) * (p.star ? 0.6 + 0.4 * Math.sin(p.tw) : 1);
        ctx.fillStyle = p.c;
        if (p.star) { star(p.x, p.y, p.size * 0.9); }
        else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.wob); ctx.scale(1, Math.abs(Math.cos(p.tilt)) * 0.8 + 0.2); ctx.fillRect(-p.size / 2, -p.size * 0.32, p.size, p.size * 0.64); ctx.restore(); }
      }
      ctx.globalAlpha = 1;
      raf = parts.length ? requestAnimationFrame(draw) : 0;
    }
    function burst(x, y, n, colors, { spread = 1, power = 11, stars = false } = {}) {
      if (reduced) return;
      size();
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.9 * spread, v = power * (0.45 + Math.random() * 0.75);
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: colors[(Math.random() * colors.length) | 0], size: 4 + Math.random() * 5, wob: Math.random() * 10, wobS: 0.06 + Math.random() * 0.08, tilt: Math.random() * Math.PI, life: 1, decay: 0.006 + Math.random() * 0.006, star: stars && Math.random() < 0.55, tw: Math.random() * 6 });
      }
      if (!raf) raf = requestAnimationFrame(draw);
    }
    const GOLDS = ['#F2B51C', '#FFD866', '#FFF1B8', '#E9A912', '#C88A00'];
    const PRISM = ['#FFD866', '#FFFFFF', '#FF7AC6', '#6CF0FF', '#9A7BFF', '#7EE2B8', '#F2B51C'];
    // pixel motes pulled in from all around the card
    function gather(card, ms, ult) {
      if (reduced) return;
      size();
      const p = center(card), R = Math.max(stage.clientWidth, stage.clientHeight) * 0.42;
      const spawn = (n) => { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = R * (0.55 + Math.random() * 0.6); parts.push({ mote: true, sx: p.x + Math.cos(a) * r, sy: p.y + Math.sin(a) * r * 0.8, tx: p.x + (Math.random() - 0.5) * 40, ty: p.y + (Math.random() - 0.5) * 60, k: 0, dk: 1 / (38 + Math.random() * 30), c: (ult ? PRISM : GOLDS)[(Math.random() * (ult ? PRISM : GOLDS).length) | 0], size: 3 + Math.random() * 4, life: 1, tw: 0 }); } };
      const waves = Math.round(ms / 120);
      for (let w = 0; w < waves; w++) setTimeout(() => spawn(7 + w), w * 120);
      if (!raf) raf = requestAnimationFrame(draw);
    }
    // the moment it turns: a hot flash and a shockwave
    function ignite(card, ult) {
      if (reduced) return;
      const p = center(card);
      flash.style.setProperty('--fx-x', (p.x / stage.clientWidth * 100) + '%'); flash.style.setProperty('--fx-y', (p.y / stage.clientHeight * 100) + '%');
      flash.classList.remove('go', 'white'); void flash.offsetWidth; flash.classList.add('go', 'white');
      for (const d of ult ? [0, 120, 260, 420] : [0, 140]) setTimeout(() => {
        const ring = document.createElement('div'); ring.className = 'ring' + (ult ? ' prism' : ''); ring.style.left = p.x + 'px'; ring.style.top = p.y + 'px';
        stage.appendChild(ring); ring.addEventListener('animationend', () => ring.remove());
      }, d);
    }
    // gold dust that drifts up around a gold card for a while
    function shimmer(card, ms) {
      if (reduced) return;
      const t0 = performance.now();
      const tick = () => {
        if (performance.now() - t0 > ms || !card.el.isConnected) return;
        size(); const r = card.rot.getBoundingClientRect(), v = stage.getBoundingClientRect();
        for (let i = 0; i < 2; i++) parts.push({ x: r.left - v.left + Math.random() * r.width, y: r.top - v.top + r.height * (0.2 + Math.random() * 0.8), vx: (Math.random() - 0.5) * 0.6, vy: -0.4 - Math.random() * 0.9, g: -0.012, c: GOLDS[(Math.random() * 3) | 0], size: 2.5 + Math.random() * 3, wob: Math.random() * 10, wobS: 0.04, tilt: 0, life: 1, decay: 0.012 + Math.random() * 0.01, star: Math.random() < 0.5, tw: Math.random() * 6 });
        if (!raf) raf = requestAnimationFrame(draw);
        setTimeout(tick, 90);
      };
      tick();
    }
    function celebrate(card, t, gold) {
      if (reduced) return;
      const p = center(card);
      if (t.key === 'ultimate') {
        burst(p.x, p.y, 180, PRISM, { stars: true, power: 15 });
        const W = stage.clientWidth, H = stage.clientHeight;
        setTimeout(() => { burst(20, H - 30, 90, PRISM, { stars: true, power: 17, spread: 0.32 }); burst(W - 20, H - 30, 90, PRISM, { stars: true, power: 17, spread: 0.32 }); }, 220);
        setTimeout(() => { for (let i = 0; i < 6; i++) burst(W * (0.1 + i * 0.16), -10, 22, [...GOLDS, '#FFFFFF'], { stars: true, power: 3, spread: 2 }); }, 520);
        shimmer(card, 5200);
      } else if (gold && t.key !== 'jackpot') {
        burst(p.x, p.y, 110, [...GOLDS, '#FFFFFF'], { stars: true, power: 12 });
        setTimeout(() => burst(p.x, p.y - 30, 40, GOLDS, { stars: true, power: 7, spread: 0.6 }), 180);
        shimmer(card, 2600);
      } else if (t.key === 'jackpot') {
        shimmer(card, 3200);
        flash.style.setProperty('--fx-x', (p.x / stage.clientWidth * 100) + '%'); flash.style.setProperty('--fx-y', (p.y / stage.clientHeight * 100) + '%');
        flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
        burst(p.x, p.y, 120, ['#F2B51C', '#FFD866', '#E9A912', '#2340FF', '#C88A00'], { stars: true, power: 13 });
        setTimeout(() => { burst(30, stage.clientHeight - 40, 60, ['#F2B51C', '#FFD866', '#E9A912'], { stars: true, power: 15, spread: 0.35 }); burst(stage.clientWidth - 30, stage.clientHeight - 40, 60, ['#F2B51C', '#FFD866', '#E9A912'], { stars: true, power: 15, spread: 0.35 }); }, 250);
      } else if (t.key === 'rare') burst(p.x, p.y, 70, ['#7A5CFF', '#A78BFF', '#2340FF', '#11B5CF'], { stars: true, power: 10 });
      else if (t.key === 'great') burst(p.x, p.y, 26, ['#2340FF', '#5B8CFF', '#AFC6FF'], { stars: true, power: 7 });
    }
    function paid(card) { const p = center(card); burst(p.x, p.y + 60, 70, ['#13A35A', '#2BD67B', '#0B0D12'], { spread: 1.2, power: 8 }); }
    return { burst, celebrate, paid, center, gather, ignite, shimmer };
  }

  // ---------- checkout (demo) ----------
  let sheet = null, paying = null, onPaid = null;
  // ---------- sign in / sign up: one centered dialog, email + one-time code ----------
  // A new email (or a new device) gets a pixel slide puzzle before any code is sent.
  // Demo: everything runs in the browser and any 6 digits sign in. Live: the server
  // draws the puzzle, checks the drag, sends the code, and opens the session (see SECURITY.md).
  const AUTH = 'tokard.user.v1', KNOWN = 'tokard.known.v1';
  const auth = {
    user: () => CA.store.get(AUTH, null),
    signOut() { CA.store.del(AUTH); document.dispatchEvent(new CustomEvent('tokard:auth')); },
    require(next) { const u = auth.user(); if (u) next(u); else signIn(next); },
  };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const known = (email) => CA.store.get(KNOWN, []).includes(email.toLowerCase());
  const remember = (email) => { const k = CA.store.get(KNOWN, []); if (!k.includes(email.toLowerCase())) CA.store.set(KNOWN, [...k, email.toLowerCase()].slice(-20)); };
  const icon = (name) => (window.Morph ? window.Morph.svg(name) : '');

  // pixel slide puzzle: a 48 × 24 pixel scene with a jigsaw-shaped gap; drag the piece into it
  function pixelPuzzle(host, onPass) {
    const GW = 48, GH = 24, C = 6, W = GW * C, H = GH * C;
    const MASK = ['....##....', '...####...', '.########.', '.########.', '..########', '..########', '.########.', '.########.', '.########.', '.########.'];
    const PW = MASK[0].length, PH = MASK.length, inMask = (i, j) => j >= 0 && j < PH && i >= 0 && i < PW && MASK[j][i] === '#';
    let gx, gy, grid, attempts = 0, trail = [], t0 = 0, cell = 1, done = false;
    function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    function scene(r) {
      const g = Array.from({ length: GH }, (_, y) => Array.from({ length: GW }, () => ['#D2ECFF', '#DCF1FF', '#E6F6FF', '#EFFAFF'][Math.min(3, y >> 2)]));
      const put = (x, y, c) => { if (x >= 0 && x < GW && y >= 0 && y < GH) g[y][x] = c; };
      const sx = 4 + Math.floor(r() * 36); for (let y = 2; y < 6; y++) for (let x = sx; x < sx + 4; x++) put(x, y, (x + y) % 3 ? '#FFC83D' : '#FFD866');
      for (let k = 0; k < 3; k++) { const cx = Math.floor(r() * 44), cy = 1 + Math.floor(r() * 6); for (let x = cx; x < cx + 6; x++) put(x, cy, '#FFFFFF'); for (let x = cx + 1; x < cx + 4; x++) put(x, cy - 1, '#FFFFFF'); }
      const range = (base, amp, col, cap) => { let h = base; for (let x = 0; x < GW; x++) { h = Math.max(base - amp, Math.min(base + 1, h + (r() < .5 ? -1 : 1) * (r() < .6 ? 1 : 0))); for (let y = GH - 1; y >= h; y--) put(x, y, col); if (h < base - amp + 2) put(x, h, cap); } };
      range(12, 6, '#1D7BFF', '#FFFFFF'); range(16, 5, '#0B3A8C', '#C9D8FF');
      for (let y = 20; y < GH; y++) for (let x = 0; x < GW; x++) put(x, y, r() < .12 ? '#34B985' : '#4ED8A0');
      return g;
    }
    function paint(ctx, from, ox, oy, w, h, maskOnly) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        if (maskOnly && !inMask(i, j)) continue;
        ctx.fillStyle = from[oy + j][ox + i]; ctx.fillRect(i * C, j * C, C, C);
      }
    }
    function edges(ctx, ox, oy, color) {
      ctx.fillStyle = color;
      for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
        if (!inMask(i, j)) continue;
        const x = (ox + i) * C, y = (oy + j) * C;
        if (!inMask(i, j - 1)) ctx.fillRect(x, y, C, 2); if (!inMask(i, j + 1)) ctx.fillRect(x, y + C - 2, C, 2);
        if (!inMask(i - 1, j)) ctx.fillRect(x, y, 2, C); if (!inMask(i + 1, j)) ctx.fillRect(x + C - 2, y, 2, C);
      }
    }
    host.innerHTML = `<div class="pz" style="--pw:${W}px">
      <div class="pz-stage" style="width:${W}px;height:${H}px"><canvas class="pz-bg" aria-hidden="true"></canvas><canvas class="pz-piece" aria-hidden="true"></canvas></div>
      <div class="pz-track"><span class="pz-fill"></span><button class="pz-knob" type="button" role="slider" aria-label="Slide the piece into the gap" aria-valuemin="0" aria-valuemax="${GW - PW}" aria-valuenow="1">${icon('arrow')}</button></div>
      <button class="pz-redo icon-btn" type="button" aria-label="New puzzle"><svg class="mi" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/></svg></button>
    </div>`;
    const stage = host.querySelector('.pz-stage'), bg = host.querySelector('.pz-bg'), pc = host.querySelector('.pz-piece');
    const track = host.querySelector('.pz-track'), knob = host.querySelector('.pz-knob'), fill = host.querySelector('.pz-fill');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    [[bg, W, H], [pc, PW * C, PH * C]].forEach(([cv, w, h]) => { cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px'; const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.imageSmoothingEnabled = false; });
    function deal() {
      const r = rng(crypto.getRandomValues(new Uint32Array(1))[0]);
      grid = scene(r); gx = 18 + Math.floor(r() * (GW - PW - 20)); gy = 2 + Math.floor(r() * (GH - PH - 4));
      const b = bg.getContext('2d'), p = pc.getContext('2d');
      paint(b, grid, 0, 0, GW, GH, false);
      for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) if (inMask(i, j)) { b.fillStyle = 'rgba(11,13,18,.42)'; b.fillRect((gx + i) * C, (gy + j) * C, C, C); }
      edges(b, gx, gy, 'rgba(255,255,255,.75)');
      p.clearRect(0, 0, PW * C, PH * C); paint(p, grid, gx, gy, PW, PH, true); edges(p, 0, 0, '#FFFFFF');
      pc.style.top = gy * C + 'px'; place(0, false); trail = []; host.querySelector('.pz').classList.remove('ok', 'no');
    }
    const maxK = () => track.clientWidth - knob.offsetWidth;
    function place(k, live) {
      k = Math.max(0, Math.min(maxK(), k));
      cell = Math.round(k / maxK() * (GW - PW));
      knob.style.transform = `translateX(${k}px)`; fill.style.width = k + knob.offsetWidth / 2 + 'px';
      pc.style.transform = `translateX(${cell * C}px)`; knob.setAttribute('aria-valuenow', cell);
      if (live) trail.push([Math.round(performance.now() - t0), cell]);
    }
    function release() {
      if (done) return;
      const dur = trail.length ? trail[trail.length - 1][0] : 0, moves = new Set(trail.map((p) => p[1])).size;
      const pass = Math.abs(cell - gx) <= 1 && dur >= 250 && moves >= 4;
      const box = host.querySelector('.pz');
      if (pass) {
        done = true; box.classList.add('ok'); pc.style.transform = `translateX(${gx * C}px)`;
        if (window.Morph) window.Morph.to(knob.querySelector('path'), 'check');
        setTimeout(() => onPass({ trail, ms: dur }), 650);
        return;
      }
      attempts++; box.classList.remove('no'); void box.offsetWidth; box.classList.add('no');
      setTimeout(() => { place(0, false); trail = []; if (attempts >= 3) { attempts = 0; deal(); } }, 420);
    }
    let dragging = false, startX = 0, startK = 0;
    knob.addEventListener('pointerdown', (e) => { if (done) return; dragging = true; knob.setPointerCapture(e.pointerId); startX = e.clientX; startK = cell / (GW - PW) * maxK(); t0 = performance.now(); trail = [[0, cell]]; box().classList.remove('no'); });
    knob.addEventListener('pointermove', (e) => { if (dragging) place(startK + e.clientX - startX, true); });
    knob.addEventListener('pointerup', () => { if (!dragging) return; dragging = false; release(); });
    knob.addEventListener('pointercancel', () => { dragging = false; place(0, false); });
    knob.addEventListener('keydown', (e) => {
      if (done) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); if (!trail.length) { t0 = performance.now(); trail = [[0, cell]]; } place((cell + (e.key === 'ArrowRight' ? 1 : -1)) / (GW - PW) * maxK(), true); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); release(); }
    });
    const box = () => host.querySelector('.pz');
    host.querySelector('.pz-redo').addEventListener('click', () => { if (!done) { attempts = 0; deal(); } });
    deal();
  }

  // the flow, rendered into any host: email → (puzzle, first time) → code → signed in
  function authFlow(host, done) {
    let email = '';
    const step = (html) => { host.innerHTML = `<div class="auth">${html}</div>`; return host.querySelector('.auth'); };
    const stepEmail = () => {
      const el = step(`<form novalidate><h2>Sign in or sign up</h2>
        <label class="sr" for="authEmail">Email</label><input id="authEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@company.com" value="${esc(email)}" required>
        <p class="err" role="alert" hidden></p>
        <button class="vbtn primary wide" type="submit"><span class="spinner" aria-hidden="true"></span><span>Continue with email</span></button></form>`);
      const f = el.querySelector('form'), inp = f.querySelector('input'), err = f.querySelector('.err');
      setTimeout(() => inp.focus(), 80);
      f.addEventListener('submit', (e) => {
        e.preventDefault(); email = inp.value.trim();
        if (!EMAIL_RE.test(email)) { err.textContent = "That doesn't look like an email address."; err.hidden = false; inp.focus(); return; }
        if (known(email)) send(f.querySelector('button')); else stepPuzzle();
      });
    };
    const stepPuzzle = () => {
      const el = step(`<h2>Fit the piece</h2><div class="pz-host"></div><button class="linkbtn back" type="button">${esc(email)}</button>`);
      el.querySelector('.back').addEventListener('click', stepEmail);
      pixelPuzzle(el.querySelector('.pz-host'), () => send(null));
    };
    const send = async (btn) => {
      if (btn) { btn.classList.add('busy'); btn.disabled = true; }
      await sleep(600);
      stepCode();
    };
    const stepCode = () => {
      const el = step(`<form novalidate><h2>Check your inbox</h2>
        <p class="sub">A 6-digit code is on its way to <b>${esc(email)}</b>.</p>
        <div class="otp"><input id="authCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="6-digit code">${'<i></i>'.repeat(6)}</div>
        <p class="err" role="alert" hidden></p>
        <p class="alt"><button class="linkbtn" type="button" data-back>Use another email</button><button class="linkbtn" type="button" data-resend>Resend</button></p>
        <p class="sub demo">Demo: no email is sent. Any 6 digits sign you in.</p></form>`);
      const f = el.querySelector('form'), inp = f.querySelector('input'), cells = [...f.querySelectorAll('.otp i')];
      const paint = () => { const v = inp.value; cells.forEach((c, i) => { c.textContent = v[i] || ''; c.classList.toggle('on', document.activeElement === inp && i === Math.min(v.length, 5)); }); };
      inp.addEventListener('input', async () => {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 6); paint();
        if (inp.value.length < 6) return;
        inp.disabled = true; el.classList.add('checking');
        await sleep(600);
        const user = { email, since: Date.now() };
        CA.store.set(AUTH, user); remember(email); el.classList.add('ok');
        await sleep(500);
        document.dispatchEvent(new CustomEvent('tokard:auth'));
        done(user);
      });
      inp.addEventListener('focus', paint); inp.addEventListener('blur', paint);
      f.querySelector('.otp').addEventListener('click', () => inp.focus());
      f.querySelector('[data-back]').addEventListener('click', stepEmail);
      const rs = f.querySelector('[data-resend]');
      let wait = 30; rs.disabled = true; rs.textContent = `Resend in ${wait}s`;
      const t = setInterval(() => { if (!rs.isConnected) return clearInterval(t); wait--; if (wait <= 0) { clearInterval(t); rs.disabled = false; rs.textContent = 'Resend'; } else rs.textContent = `Resend in ${wait}s`; }, 1000);
      rs.addEventListener('click', () => { toast(`New code sent to ${esc(email)}.`); stepCode(); });
      setTimeout(() => inp.focus(), 80); paint();
    };
    stepEmail();
  }
  let inviteSheet = null;
  function invite(after) {
    auth.require(() => {
      if (!inviteSheet) {
        document.body.insertAdjacentHTML('beforeend', `<dialog class="auth-sheet" id="inviteSheet" aria-labelledby="invH"><button class="auth-x icon-btn" type="button" aria-label="Close">${icon('x')}</button><div class="auth inv"></div></dialog>`);
        inviteSheet = document.getElementById('inviteSheet');
        inviteSheet.addEventListener('click', (e) => { if (e.target === inviteSheet) inviteSheet.close(); });
        inviteSheet.querySelector('.auth-x').addEventListener('click', () => inviteSheet.close());
      }
      const link = `https://tokard.ai/?ref=${state.inviteCode()}`;
      const host = inviteSheet.querySelector('.inv');
      host.innerHTML = `<h2 id="invH">Flip again</h2>
        <p class="sub">When a friend signs up and flips their first card, you get one more flip.</p>
        <div class="invlink"><code>${esc(link)}</code><button class="vbtn primary sm icon-btn" type="button" data-copy aria-label="Copy invite link">${icon('copy')}</button></div>
        <p class="tixrow" aria-label="Extra flips"></p>
        <button class="linkbtn demo" type="button" data-sim>Demo: a friend just flipped</button>`;
      const pips = host.querySelector('.tixrow'); pips.innerHTML = Array.from({ length: 3 }, (_, i) => `<i class="${i < state.tickets() ? 'on' : ''}"></i>`).join('') + `<span>${state.tickets()} extra flip${state.tickets() === 1 ? '' : 's'}</span>`;
      host.querySelector('[data-copy]').addEventListener('click', (e) => CA.copy(link, e.currentTarget, 'Copy invite link'));
      host.querySelector('[data-sim]').addEventListener('click', () => {
        const r = state.grantTicket();
        if (!r.ok) { toast(r.why === 'day' ? 'Friends can give you 3 extra flips a day.' : 'You can hold 10 extra flips at most.'); return; }
        inviteSheet.close(); toast('A friend flipped. You have an extra flip.'); if (after) after();
      });
      inviteSheet.showModal();
    });
  }
  let authSheet = null;
  function signIn(next) {
    if (!authSheet) {
      document.body.insertAdjacentHTML('beforeend', `<dialog class="auth-sheet" id="authSheet" aria-label="Sign in"><button class="auth-x icon-btn" type="button" aria-label="Close">${icon('x')}</button><div class="auth-host"></div></dialog>`);
      authSheet = document.getElementById('authSheet');
      authSheet.addEventListener('click', (e) => { if (e.target === authSheet) authSheet.close(); });
      authSheet.querySelector('.auth-x').addEventListener('click', () => authSheet.close());
      authSheet.addEventListener('close', () => document.documentElement.classList.remove('modal-open'));
    }
    authFlow(authSheet.querySelector('.auth-host'), (u) => { authSheet.close(); if (next) next(u); });
    document.documentElement.classList.add('modal-open');
    authSheet.showModal();
  }

  function checkout(o, done0) {
    if (!auth.user()) { signIn(() => checkout(o, done0)); return; }
    if (isUltimate(o) && !state.canClaimUltimate()) { location.href = 'shop.html'; return; }
    const done = (paidO) => { if (isUltimate(paidO)) { S.lastUltimate = Date.now(); state.save(); } else state.addSpent(paidO.price); if (done0) done0(paidO); };
    if (!sheet) {
      document.body.insertAdjacentHTML('beforeend', `<dialog class="sheet" id="paySheet" aria-labelledby="payH"><form method="dialog">
        <div class="head"><div class="thumb" id="payThumb"></div><div><h2 id="payH">Checkout</h2><p class="sub" id="paySub"></p></div></div>
        <div class="lines" id="payLines"></div>
        <p class="sub">Demo: on the live site this opens Stripe. Here it completes so you can see the card unlock.</p>
        <div class="acts"><button class="vbtn ghost" value="cancel" type="submit" formnovalidate>Cancel</button><button class="vbtn primary" type="button" id="payOk"><span class="spinner" aria-hidden="true"></span><span id="payOkLabel">Pay</span></button></div>
      </form></dialog>`);
      sheet = document.getElementById('paySheet');
      document.getElementById('payOk').addEventListener('click', async () => {
        const b = document.getElementById('payOk'); if (!paying) return;
        b.classList.add('busy'); b.disabled = true; document.getElementById('payOkLabel').textContent = 'Paying…';
        await sleep(1000);
        const o2 = paying, cb = onPaid; paying = null; sheet.close('ok');
        if (cb) cb(o2);
      });
    }
    paying = o; onPaid = done;
    const m = CA.MODELS[o.kind];
    const thumb = document.getElementById('payThumb'); thumb.dataset.kind = o.kind; thumb.innerHTML = `<img src="${m.logo}" alt="">`;
    document.getElementById('paySub').textContent = `${m.name} · ${KIND[o.kind].via}`;
    document.getElementById('payLines').innerHTML = `<span>Card face value</span><span>${fmt(o.value)}</span>`
      + (o.off ? `<span>${tierOf(o).name || 'Everyday'} discount (${isUltimate(o) ? '99.9' : o.off}%)</span><span style="color:#13A35A">−${fmt(+(o.value - o.price).toFixed(2))}</span>` : '')
      + `<span class="tot">Total</span><span class="tot">${fmt(o.price)}</span>`;
    document.getElementById('payOkLabel').textContent = `Pay ${fmt(o.price)}`;
    const b = document.getElementById('payOk'); b.classList.remove('busy'); b.disabled = false;
    sheet.showModal();
  }

  // ---------- chrome: top bar, reveals, toast ----------
  document.documentElement.classList.add('js');
  // invite links: remember who sent this visitor (the live server keeps it in a cookie)
  try { const ref = new URLSearchParams(location.search).get('ref'); if (ref && /^[a-z0-9]{4,16}$/.test(ref)) CA.store.set('tokard.ref', ref); } catch { /* ignore */ }
  function chrome() {
    const cta = document.querySelector('.topcta [data-page="console"]');
    const syncCta = () => { if (cta) cta.textContent = auth.user() ? 'Wallet' : 'Sign in'; };
    syncCta(); document.addEventListener('tokard:auth', syncCta);
    if (cta) cta.addEventListener('click', (e) => { if (auth.user()) return; e.preventDefault(); signIn(() => { location.href = 'console.html'; }); });
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }) : null;
    document.querySelectorAll('.rv').forEach((el) => (io && !reduced ? io.observe(el) : el.classList.add('in')));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', chrome); else chrome();
  let toastT = 0;
  function toast(html) {
    let t = document.getElementById('toast');
    if (!t) { document.body.insertAdjacentHTML('beforeend', '<div class="toast" id="toast" role="status"></div>'); t = document.getElementById('toast'); }
    t.innerHTML = html; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
  }


  // ---------- delivery: a bought card turns over and its key is scratched free ----------
  // Where each card's key is used. The key on the card is an official provider key.
  const CONN = {
    text: { base: 'https://api.deepseek.com', model: 'deepseek-flash' },
    image: { base: 'https://ark.ap-southeast.bytepluses.com/api/v3', model: 'seedream-5-0-pro-260628' },
    video: { base: 'https://ark.ap-southeast.bytepluses.com/api/v3', model: 'dreamina-seedance-2-5-260628' },
  };
  // The flip and the scratch cover the time it takes to cut the key (live: poll until it exists).
  function mintKey(card) { return sleep(1400 + Math.random() * 1800).then(() => card.key); }
  let dsheet = null;
  function deliver(card) {
    if (!dsheet) {
      document.body.insertAdjacentHTML('beforeend', '<dialog class="dsheet" id="dsheet" aria-label="Your new card"><div class="dwrap"></div></dialog>');
      dsheet = document.getElementById('dsheet');
      dsheet.addEventListener('click', (e) => { if (e.target === dsheet) dsheet.close(); });
    }
    const m = CA.MODELS[card.kind], conn = CONN[card.kind], o = { kind: card.kind, value: card.value, off: card.off, tier: card.tier, price: card.paid, serial: card.serial };
    const copyIcon = '<svg class="mi" viewBox="0 0 24 24" aria-hidden="true"><path data-icon="copy" d="M9 9h11v11H9zM15 5V4H4v11h1"/></svg>';
    dsheet.querySelector('.dwrap').innerHTML = `
      <div class="dcard${reduced ? ' turned' : ''}">
        <div class="dface dfront"><div class="pc static revealed quiet" data-kind="${card.kind}" data-tier="${tierOf(o).key}"${isGold(o) ? ' data-gold' : ''} style="--tc:${glowOf(o)}">${frontFace(o, { static: true })}</div></div>
        <div class="dface dback" data-kind="${card.kind}">
          <div class="dtop"><img src="${m.logo}" alt=""><span>${esc(m.name)}</span><b>${fmt(card.value)}</b></div>
          <div class="dkey">
            <code class="dk" id="dk"><span class="mint"><i></i><i></i><i></i><i></i><i></i></span></code>
            <canvas class="foil" id="foil" tabindex="0" aria-label="Scratch to reveal the key, or press Enter"></canvas>
          </div>
          <dl class="dconn"><dt>Base URL</dt><dd>${esc(conn.base)}</dd><dt>Model ID</dt><dd>${esc(conn.model)}</dd></dl>
          <div class="dacts"><button class="vbtn primary sm" type="button" id="dkCopy" disabled>${copyIcon}Copy key</button><a class="vbtn ghost sm" href="console.html">Open wallet</a></div>
        </div>
      </div>`;
    dsheet.showModal();
    const wrap = dsheet.querySelector('.dcard'), foil = dsheet.querySelector('#foil'), dk = dsheet.querySelector('#dk'), copyBtn = dsheet.querySelector('#dkCopy');
    let key = null, open = false;
    const showKey = () => { if (!key || !open) return; dk.classList.add('ready'); decode(dk, key, reduced ? 0 : 700); copyBtn.disabled = false; };
    mintKey(card).then((k) => { key = k; showKey(); });
    copyBtn.addEventListener('click', () => CA.copy(key, copyBtn, 'Copy key'));
    // turn the card over after a beat
    if (!reduced) setTimeout(() => wrap.classList.add('turned'), 650);
    // the foil: silver pixels with faint sparks; scratching clears it
    requestAnimationFrame(() => {
      const d = Math.min(2, devicePixelRatio || 1), ctx = foil.getContext('2d'), W = foil.offsetWidth, H = foil.offsetHeight;   // layout size: the card may still be mid-turn
      foil.width = Math.round(W * d); foil.height = Math.round(H * d); ctx.scale(d, d);
      const P = 4;
      for (let y = 0; y < H; y += P) for (let x = 0; x < W; x += P) { const v = 196 + ((Math.sin(x * 0.7) + Math.cos(y * 1.3)) * 6 | 0) + (Math.random() * 18 | 0); ctx.fillStyle = `rgb(${v},${v + 2},${v + 8})`; ctx.fillRect(x, y, P, P); }
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      for (let i = 0; i < 9; i++) { const x = 12 + Math.random() * (W - 24), y = 8 + Math.random() * (H - 16); ctx.fillRect(x, y - P, P, P * 3); ctx.fillRect(x - P, y, P * 3, P); }
      ctx.globalCompositeOperation = 'destination-out';
      let down = false, last = null, cleared = 0;
      const brush = (x, y) => { ctx.fillRect(Math.floor((x - 12) / P) * P, Math.floor((y - 12) / P) * P, 24, 24); };
      const line = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6)); for (let i = 0; i <= n; i++) brush(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n); };
      const at = (e) => { const b = foil.getBoundingClientRect(); return { x: (e.clientX - b.left) * (W / b.width), y: (e.clientY - b.top) * (H / b.height) }; };
      const check = () => {
        const img = ctx.getImageData(0, 0, foil.width, foil.height).data; let clear = 0, n = 0;
        for (let i = 3; i < img.length; i += 4 * 37) { n++; if (img[i] < 40) clear++; }
        cleared = clear / n;
        if (cleared > 0.5) finish();
      };
      const finish = () => { if (open) return; open = true; foil.classList.add('gone'); showKey(); };
      foil.addEventListener('pointerdown', (e) => { down = true; foil.setPointerCapture(e.pointerId); last = at(e); brush(last.x, last.y); });
      foil.addEventListener('pointermove', (e) => { if (!down) return; const p = at(e); line(last, p); last = p; });
      const up = () => { if (!down) return; down = false; check(); };
      foil.addEventListener('pointerup', up); foil.addEventListener('pointercancel', up);
      foil.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish(); } });
      if (reduced) finish();
    });
  }

  // ---------- the flip stage: today's three cards, one per deck ----------
  // Tap a face-down card: it comes forward and turns over. Tap a face-up card to look at it again,
  // tap it once more (or the empty stage, or Esc) to put it back in the row. Used by Home and Flip.
  // keepGold: a gold card in today's hand stays in the opened state (centre, the others at the sides);
  // stepping back from any other card returns to it instead of to the row
  function mountFlip({ root, stage, offer, onChange = () => {}, keepGold = false }) {
    const fx = makeFx(stage);
    let cards = [], focus = -1, busy = false, day = state.day();
    // gold within five: five little card backs; one turns blue per flip since the last gold card, the fifth is gold
    const meter = document.createElement('div'); meter.className = 'pity pmini away'; meter.setAttribute('role', 'img'); stage.appendChild(meter);
    let shown = -1;
    function paintPity() {
      const p = state.pity(), due = p.left === 1, fresh = shown >= 0 && p.since === shown + 1 ? p.since - 1 : -1;
      meter.innerHTML = Array.from({ length: p.every }, (_, i) => `<i class="${i < p.since ? 'on' : ''}${i === p.every - 1 ? ' g' : ''}${i === fresh ? ' new' : ''}"></i>`).join('');
      const say = due ? 'Your next flip is gold' : `Gold within ${p.left} flips`;
      meter.setAttribute('aria-label', say); meter.title = say;
      meter.classList.toggle('due', due); shown = p.since;
      cards.forEach((c) => c.el.classList.toggle('due', due && !state.handOf(c.kind)));
    }
    // after a reveal: a gold card turns the whole row gold, then it starts again
    function pityAfter(o) {
      if (!isGold(o) || reduced) { paintPity(); return; }
      meter.classList.add('hit'); meter.querySelectorAll('i').forEach((i) => i.classList.add('on'));
      setTimeout(() => { meter.classList.remove('hit'); shown = -1; paintPity(); }, 1700);
    }
    function L() {
      const W = stage.clientWidth, H = stage.clientHeight, phone = W < 560;
      const s = phone ? 0.36 : 0.6, gap = phone ? Math.min(118, (W - 30) / 3) : Math.min(212, W / 3.1), cy = H * (phone ? 0.46 : 0.47);
      const rs = phone ? 0.58 : 0.9, ss = phone ? 0.3 : 0.48, cy2 = H * (phone ? 0.35 : 0.44) - 210;
      const side = 150 * rs + (phone ? 6 : 28) + 150 * ss;
      return {
        row: [-1, 0, 1].map((d) => ({ x: d * gap, y: cy - 210 + Math.abs(d) * (phone ? 6 : 14), s, rz: d * (phone ? 4 : 6) })),
        center: { x: 0, y: cy2, s: rs, rz: 0 },
        sides: [-1, 1].map((d) => ({ x: d * side, y: cy2 + (phone ? 10 : 26), s: ss, rz: d * 5 })),
      };
    }
    function target(c) {
      const l = L();
      if (focus < 0) return l.row[c.i];
      if (c.i === focus) return l.center;
      return l.sides[[0, 1, 2].filter((i) => i !== focus).indexOf(c.i)];
    }
    function goldIndex() {
      let best = -1, q = 2;
      cards.forEach((c) => { const o = state.handOf(c.kind); if (o && o.status !== 'void' && isGold(o) && o.price / o.value < q) { q = o.price / o.value; best = c.i; } });
      return best;
    }
    const rest = () => (keepGold ? goldIndex() : -1);
    // the five little cards sit just above the row; when a card is opened they move to the top of the stage (on a phone they step aside)
    function placeMeter(lifted = false) {
      const l = L(), phone = stage.clientWidth < 560, top = (p) => p.y + 210 - 210 * p.s;
      if (focus < 0) { meter.classList.remove('away'); meter.style.top = Math.max(4, top(l.row[1]) - (phone ? 44 : 64) - (lifted ? 48 : 0)) + 'px'; }
      else if (phone) meter.classList.add('away');
      else { meter.classList.remove('away'); meter.style.top = Math.max(4, top(l.center) - 58) + 'px'; }
    }
    function placeAll() {
      placeMeter();
      cards.forEach((c) => {
        c.hover = false; c.el.classList.remove('hovering');
        c.el.classList.toggle('front-most', c.i === focus); c.el.classList.toggle('focus', c.i === focus);
        c.place({ ...target(c), op: 1 });
      });
    }
    // hover: in the row a card rises and its neighbours lean away; at the sides it just lifts a little
    function lift(c) {
      if (busy || c.i === focus) return;
      const p = target(c);
      c.hover = true; c.el.classList.add('hovering');
      if (focus >= 0) { c.place({ x: p.x, y: p.y - 14, s: p.s * 1.06, rz: p.rz * 0.5, op: 1 }); return; }
      c.place({ x: p.x, y: p.y - 34, s: p.s * 1.09, rz: p.rz * 0.15, op: 1 }); c.el.classList.add('front-most'); placeMeter(c.i === 1);
      cards.forEach((x) => { if (x === c) return; const q = target(x), away = Math.sign(x.i - c.i); x.hover = false; x.el.classList.remove('front-most', 'hovering'); x.place({ x: q.x + away * 16, y: q.y + 8, s: q.s * 0.97, rz: q.rz + away * 2, op: 1 }); });
    }
    const unlift = () => { if (!busy) placeAll(); };
    const name = (c, o) => `${KIND[c.kind].deck} card${o ? `, ${fmt(o.value)} for ${fmt(o.price)}` : ', face down'}`;
    function faceUp(c, o) {
      c.setFront(o, { priceShown: true }); c.flip.set({ f: 180 }, true); c.apply();
      c.el.classList.add('revealed'); if (state.cardFor(o)) c.el.classList.add('paid', 'static-paid');
      c.rot.setAttribute('aria-label', name(c, o));
    }
    function hideBar() { offer.classList.remove('in'); offer.hidden = true; }
    function bar(c, o) {
      const card = state.cardFor(o);
      offer.style.setProperty('--tc', glowOf(o));
      offer.innerHTML = card
        ? `<code class="what">${esc(card.key.slice(0, 7))}…${esc(card.key.slice(-4))}</code><span class="acts"><a class="vbtn primary sm" href="console.html">Open wallet</a></span>`
        : o.expires > Date.now() && isUltimate(o)
          // the Ultimate: claim it, or see how much more to spend before it can be claimed
          ? `<span class="what">Ends in <b class="num" data-ends="${o.expires}">${left(o.expires)}</b></span><span class="acts">${state.canClaimUltimate()
            ? `<button class="vbtn ult sm" type="button" data-claim>Claim for ${fmt(o.price)}</button>`
            : `<span class="need"><span class="needbar"><i style="width:${Math.min(100, state.spent() / ULTIMATE.need * 100)}%"></i></span>${fmt(state.spent())} / ${fmt(ULTIMATE.need)}</span><a class="vbtn ult sm" href="shop.html">Spend ${fmt(+(ULTIMATE.need - state.spent()).toFixed(2))} to claim</a>`}</span>`
        : o.expires > Date.now()
          ? `<span class="what">Ends in <b class="num" data-ends="${o.expires}">${left(o.expires)}</b></span><span class="acts"><button class="vbtn ghost sm${state.pity().left === 1 ? ' due' : ''}" type="button" data-again>Flip again${state.tickets() ? ` <b class="tix">${state.tickets()}</b>` : ''}</button><button class="vbtn ${isGold(o) ? 'gold' : 'primary'} sm" type="button" data-claim>Claim for ${fmt(o.price)}</button></span>`
          : `<span class="what">This offer has ended.</span>`;
      offer.hidden = false; requestAnimationFrame(() => offer.classList.add('in'));
      const again = offer.querySelector('[data-again]');
      if (again) again.addEventListener('click', () => (state.tickets() ? reflip(c) : invite(() => bar(c, state.handOf(c.kind)))));
      const claim = offer.querySelector('[data-claim]');
      if (claim) claim.addEventListener('click', () => checkout(o, (paidO) => {
        const card = state.buy(paidO);
        c.el.classList.add('paid'); fx.paid(c);
        bar(c, paidO); onChange('buy', paidO);
        setTimeout(() => deliver(card), reduced ? 0 : 500);
      }));
    }
    function syncDone() {
      const d = stage.querySelector('.hero-done'), show = focus < 0 && !state.canFlip();
      if (show && !d) stage.insertAdjacentHTML('beforeend', `<p class="hero-done meta">New cards in <b class="num" data-next>${left(state.nextFlipAt())}</b></p>`);
      else if (!show && d) d.remove();
    }
    function setFocus(i) {
      if (focus === i) return;
      if (focus >= 0) { const f = cards[focus]; f.showcase = false; f.tilt.set({ x: 0, y: 0 }); }
      focus = i;
      cards.forEach((c) => { c.float = c.i === focus ? 0.45 : focus < 0 ? 1 : 0.6; });
      const c = cards[i], o = c && state.handOf(c.kind);
      if (o) { c.showcase = !reduced; c.idleSince = performance.now(); bar(c, o); root.style.setProperty('--spot', glowOf(o)); }
      else { hideBar(); root.style.removeProperty('--spot'); }
      placeAll(); syncDone(); kick();
    }
    async function onCard(c) {
      if (busy) return;
      if (c.i === focus) { setFocus(rest()); return; }
      if (state.handOf(c.kind)) { setFocus(c.i); return; }
      busy = true;
      setFocus(c.i);
      await sleep(560);
      const o = state.deal(c.kind); onChange('deal', o);
      c.setFront(o); root.style.setProperty('--spot', glowOf(o));
      await c.flipReveal(o, fx);
      c.touchTilt = true; c.rot.setAttribute('aria-label', name(c, o));
      busy = false;
      bar(c, o); syncDone(); pityAfter(o);
    }
    async function reflip(c) {
      if (busy) return;
      busy = true; hideBar();
      c.showcase = false; c.tilt.set({ x: 0, y: 0 }); c.glare.set({ o: 0 });
      c.el.classList.remove('revealed', 'paid', 'static-paid', 'hot');
      c.flip.set({ f: 0 }); kick();
      await sleep(reduced ? 0 : 750);
      const o = state.reflip(c.kind);
      if (!o) { busy = false; const cur = state.handOf(c.kind); if (cur) faceUp(c, cur); return; }
      onChange('deal', o);
      c.setFront(o); root.style.setProperty('--spot', glowOf(o));
      await c.flipReveal(o, fx);
      c.rot.setAttribute('aria-label', name(c, o));
      busy = false; bar(c, o); pityAfter(o);
    }
    async function boot() {
      cards.forEach((c) => c.destroy()); focus = -1; hideBar(); root.style.removeProperty('--spot');
      cards = DECKS.map((kind, i) => {
        const c = new Card({ label: '', deck: kind, onEnter: lift, onLeave: unlift, onClick: onCard });
        c.i = i; c.kind = kind; c.phase = i * 2.1; c.float = 1; stage.appendChild(c.el);
        const o = state.handOf(kind); if (o) faceUp(c, o); else c.rot.setAttribute('aria-label', name(c, null));
        return c;
      });
      const l = L(); cards.forEach((c) => c.place({ x: 0, y: l.row[1].y - 50, s: l.row[0].s * 0.7, rz: 0, op: 0 }, true));
      busy = true;
      for (const c of cards) { await sleep(140); c.place({ ...target(c), op: 1 }); }
      busy = false; syncDone(); paintPity(); placeMeter();
      const g = rest(); if (g >= 0) setFocus(g);
    }
    stage.addEventListener('click', (e) => { if (!busy && focus >= 0 && !e.target.closest('.pc-rot') && !e.target.closest('.hero-offer')) setFocus(rest()); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && focus >= 0 && !busy) setFocus(rest()); });
    new ResizeObserver(() => { if (!busy) placeAll(); }).observe(stage);
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { cards.forEach((c) => { c.inView = es[0].isIntersecting; }); kick(); }).observe(stage);
    setInterval(() => {
      const n = stage.querySelector('[data-next]'); if (n) n.textContent = left(state.nextFlipAt());
      const e = offer.querySelector('[data-ends]'); if (e) e.textContent = left(+e.dataset.ends);
      if (!busy && state.day() !== day) { day = state.day(); boot(); onChange('day'); }
    }, 1000);
    // flip the next face-down card, as if it had been tapped
    function flipNext() { const c = cards.find((x) => !state.handOf(x.kind)); if (c) onCard(c); }
    return { boot, flipNext };
  }

  window.Cards = { TIERS, FULL, VALUES, KINDS, KIND, JACKPOTS_PER_DAY, PITY, GOLD_BELOW, DAY, reduced, sleep, clamp, esc, fmt, left, tierOf, fakeKey, state, Spring, Card, kick, frontFace, backFace, tag, mini, odometer, decode, makeFx, checkout, toast, mountFlip, DECKS, shopPrice, flipPrice, offAt, maxOff, artFor, isGold, glowOf, isUltimate, ULTIMATE, deliver, CONN, auth, signIn, authFlow, invite };
})();
