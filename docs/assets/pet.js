// Kei: the homepage's pixel guide. An original Tokard character — a girl with a card
// hairpin and a glowing gold key. She lives on the page itself: she walks along headlines,
// hops onto cards, taps face-down cards with her key, cheers gold flips, reads the odds,
// can be picked up and dropped, and dozes off when nobody is around. And she is never
// still for long: on her own she waves at your cursor, walks over to sit near it, tosses her
// key and a card, hums, dances, swings her legs, strolls, yawns, sneezes, looks at whatever
// you hover, and startles when you click or scroll hard.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = 16, H = 24;
  const PAL = {
    o: '#1E1A2E', h: '#3A2633', H: '#6B4A5C', s: '#FFDCC6', S: '#F2B8A0', e: '#1B1530', w: '#FFFFFF', p: '#FF9BB0', m: '#C2456A',
    c: '#2340FF', C: '#5B73FF', j: '#F4F6FB', J: '#D5DAE8', y: '#F2B51C', Y: '#FFE08A', k: '#2A2438', g: 'rgba(255,224,138,.45)',
    T: '#6CCBFF', q: '#7FD6FF', r: '#FF4D6D', x: '#C9CFDC',
  };
  const BASE = [
    '....oooooooo....', '...ohhhhhhhho...', '..ohHHhhhhhhho..', '.ohHhhhhhhhhhho.', '.ohhhhhhhhhhhho.', '.ohhsshhhhsshho.',
    '.ohssssssssssho.', '.ohsewssssewsho.', '.ohseesssseesho.', '.ohpsssmmssspho.', '.ohhsssssssshho.', '..ohhSSSSSShho..',
    '..ohhojjjjohho..', '..ocjjjjjjjjco..', '..ocjjjyyjjjco..', '..ocjjyyyyjjco..', '..osjjjyyjjjso..', '..occcccccccco..',
    '..occCccccCcco..', '..occcccccccco..', '....ossoosso....', '....ossoosso....', '....okkookko....', '...okkkookkko...',
  ];
  const LEGS = {
    stand: BASE.slice(20),
    step: ['...osso..osso...', '...osso..osso...', '...okko..okko...', '..okkko..okkko..'],
    tuck: ['....ossoosso....', '....okkookko....', '................', '................'],
    wide: ['..osso....osso..', '..osso....osso..', '..okko....okko..', '.okkko....okkko.'],
  };
  // build one frame from parts of a pose.
  //   eyes:  open blink sleep happy wide dizzy wink love star cry angry
  //   mouth: smile open o grin laugh frown tongue
  //   arms:  down up forward waveL waveL2 waveR waveR2 hips out shrug clap cover
  //   legs:  stand step tuck wide
  //   acc:   shades partyhat crown headphones flower specs blush sweat
  function frame({ eyes = 'open', mouth = 'smile', arms = 'down', legs = 'stand', key = true, glint = false, acc = [] }) {
    const g = BASE.map((r) => r.split(''));
    const set = (x, y, ch) => { if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = ch; };
    const run = (y, x0, x1, ch) => { for (let x = x0; x <= x1; x++) set(x, y, ch); };
    LEGS[legs].forEach((r, i) => { g[20 + i] = r.split(''); });
    // eyes (cols 4–5 and 10–11, rows 7–8)
    const eyeAt = (x0, a, b) => { set(x0, 7, a[0]); set(x0 + 1, 7, a[1]); set(x0, 8, b[0]); set(x0 + 1, 8, b[1]); };
    const eye = (a, b) => { eyeAt(4, a, b); eyeAt(10, a, b); };
    if (eyes === 'blink' || eyes === 'sleep') eye('ss', 'ee');
    if (eyes === 'happy') eye('ee', 'ss');
    if (eyes === 'wide') { eye('ew', 'ee'); for (const x0 of [4, 10]) { set(x0, 6, 'e'); set(x0 + 1, 6, 'e'); } }
    if (eyes === 'dizzy') { set(4, 7, 'e'); set(5, 7, 's'); set(4, 8, 's'); set(5, 8, 'e'); set(10, 7, 's'); set(11, 7, 'e'); set(10, 8, 'e'); set(11, 8, 's'); }
    if (eyes === 'wink') eyeAt(10, 'ss', 'ee');
    if (eyes === 'star') eye('Yw', 'wY');
    if (eyes === 'love') {
      eye('ss', 'ss');
      for (const x0 of [3, 10]) { set(x0, 7, 'r'); set(x0 + 2, 7, 'r'); set(x0 + 1, 8, 'r'); }
    }
    if (eyes === 'cry') { eye('ss', 'ee'); for (const x of [4, 11]) { set(x, 9, 'T'); set(x, 10, 'T'); } }
    if (eyes === 'angry') { set(4, 5, 'e'); set(5, 6, 'e'); set(11, 5, 'e'); set(10, 6, 'e'); }
    // mouths
    if (mouth === 'open') { set(7, 10, 'm'); set(8, 10, 'm'); }
    if (mouth === 'o') { set(7, 9, 's'); set(8, 9, 's'); set(7, 10, 'm'); set(8, 10, 'm'); }
    if (mouth === 'grin') { set(6, 9, 'm'); set(7, 9, 'w'); set(8, 9, 'w'); set(9, 9, 'm'); }
    if (mouth === 'laugh') { run(9, 6, 9, 'm'); set(6, 10, 'm'); set(7, 10, 'p'); set(8, 10, 'p'); set(9, 10, 'm'); }
    if (mouth === 'frown') { set(6, 10, 'm'); set(9, 10, 'm'); }
    if (mouth === 'tongue') { set(7, 10, 'p'); set(8, 10, 'p'); }
    // card hairpin, right side of the head
    [[12, 2, 'c'], [13, 2, 'c'], [14, 2, 'c'], [12, 3, 'c'], [13, 3, 'w'], [14, 3, 'c'], [12, 4, 'c'], [13, 4, 'C'], [14, 4, 'c'], [12, 5, 'c'], [13, 5, 'c'], [14, 5, 'c']].forEach(([x, y, ch]) => set(x, y, ch));
    // arms
    const bare = (xs) => { for (const x of xs) for (const y of [13, 14, 15, 16]) set(x, y, 'j'); };
    let hand = [12, 16], keyUp = false, keyShown = key;
    if (arms === 'up') {
      bare([3, 12]);
      for (const x of [1, 14]) { set(x, 13, 'c'); set(x, 12, 'c'); set(x, 11, 's'); set(x, 10, 's'); }
      hand = [14, 10]; keyUp = true;
    } else if (arms === 'forward') {
      set(12, 16, 'j'); set(12, 15, 'j'); set(13, 14, 'c'); set(14, 14, 'c'); set(15, 14, 's');
      hand = [15, 14];
    } else if (arms === 'waveL' || arms === 'waveL2') {
      // left arm up and waving; the key stays down on the right
      bare([3]);
      const x = arms === 'waveL2' ? 0 : 1; set(1, 13, 'c'); set(1, 12, 'c'); set(x, 11, 's'); set(x, 10, 's');
    } else if (arms === 'waveR' || arms === 'waveR2') {
      // key arm up: she waves the key itself
      bare([12]);
      const x = arms === 'waveR2' ? 15 : 14; set(14, 13, 'c'); set(14, 12, 'c'); set(x, 11, 's'); set(x, 10, 's');
      hand = [x, 10]; keyUp = true;
    } else if (arms === 'hips') {
      bare([3, 12]);
      set(1, 13, 'c'); set(1, 14, 'c'); set(2, 15, 's'); set(14, 13, 'c'); set(14, 14, 'c'); set(13, 15, 's');
    } else if (arms === 'out') {
      bare([3, 12]);
      set(1, 13, 'c'); set(0, 13, 's'); set(14, 13, 'c'); set(15, 13, 's');
      hand = [15, 13]; keyUp = true;
    } else if (arms === 'shrug') {
      bare([3, 12]);
      set(1, 15, 'c'); set(1, 14, 'c'); set(0, 13, 's'); set(14, 15, 'c'); set(14, 14, 'c'); set(15, 13, 's');
      hand = [15, 13]; keyUp = true;
    } else if (arms === 'clap') {
      bare([3, 12]); keyShown = false;
      set(4, 14, 'c'); set(5, 14, 'c'); set(6, 14, 's'); set(7, 14, 's'); set(11, 14, 'c'); set(10, 14, 'c'); set(9, 14, 's'); set(8, 14, 's');
    } else if (arms === 'cover') {
      bare([3, 12]); keyShown = false;
      for (let y = 7; y <= 9; y++) { run(y, 3, 5, 'S'); run(y, 10, 12, 'S'); }
      run(10, 3, 5, 'o'); run(10, 10, 12, 'o'); set(3, 9, 'o'); set(12, 9, 'o');
    }
    // the key, in the right hand
    if (keyShown) {
      const [hx, hy] = hand;
      const K = keyUp
        ? [[hx, hy - 1, 'y'], [hx, hy - 2, 'Y'], [hx, hy - 3, 'y'], [hx - 1, hy - 3, 'y'], [hx + 1, hy - 3, 'y'], [hx, hy - 4, 'y']]
        : arms === 'forward'
          ? [[hx, hy - 1, 'y'], [hx, hy - 2, 'y'], [hx, hy - 3, 'Y'], [hx - 1, hy - 3, 'y'], [hx, hy - 4, 'y']]
          : [[hx + 1, hy, 'y'], [hx + 2, hy, 'Y'], [hx + 1, hy - 1, 'y'], [hx + 2, hy + 1, 'y'], [hx + 2, hy + 2, 'y'], [hx + 3, hy + 2, 'y'], [hx + 2, hy + 3, 'y']];
      K.forEach(([x, y, ch]) => set(x, y, ch));
      if (glint) { const [x, y] = K[1]; set(x, y, 'w'); }
    }
    // things she can wear
    for (const a of acc) {
      if (a === 'shades') { run(7, 3, 12, 'e'); for (const x of [4, 5, 10, 11]) set(x, 8, 'e'); set(4, 7, 'w'); set(10, 7, 'w'); }
      else if (a === 'partyhat') {
        run(0, 7, 8, 'y'); run(1, 6, 9, 'c'); set(7, 1, 'w'); set(9, 1, 'w'); run(2, 5, 10, 'c'); set(6, 2, 'w'); set(8, 2, 'w'); set(10, 2, 'C');
        run(3, 4, 11, 'c'); set(5, 3, 'w'); set(7, 3, 'w'); set(9, 3, 'w'); set(11, 3, 'C'); run(4, 3, 12, 'y');
      } else if (a === 'crown') {
        for (const x of [5, 8, 11]) set(x, 0, 'y');
        run(1, 4, 12, 'y'); run(2, 4, 12, 'Y'); set(8, 2, 'm'); set(5, 2, 'c'); set(11, 2, 'c'); set(4, 2, 'y'); set(12, 2, 'y');
      } else if (a === 'headphones') {
        run(1, 3, 12, 'k'); set(2, 2, 'k'); set(1, 3, 'k'); set(1, 4, 'k'); set(1, 5, 'k'); set(13, 2, 'k'); set(14, 3, 'k'); set(14, 4, 'k'); set(14, 5, 'k');
        for (let y = 6; y <= 9; y++) { set(0, y, 'c'); set(1, y, 'C'); set(14, y, 'C'); set(15, y, 'c'); }
      } else if (a === 'flower') {
        set(4, 1, 'p'); set(3, 2, 'p'); set(5, 2, 'p'); set(4, 3, 'p'); set(4, 2, 'y');
      } else if (a === 'specs') {
        run(6, 3, 6, 'k'); run(6, 9, 12, 'k'); for (const y of [7, 8]) { set(3, y, 'k'); set(6, y, 'k'); set(9, y, 'k'); set(12, y, 'k'); }
        set(4, 9, 'k'); set(5, 9, 'k'); set(10, 9, 'k'); set(11, 9, 'k'); set(7, 7, 'k'); set(8, 7, 'k');
      } else if (a === 'blush') { run(9, 3, 4, 'p'); run(9, 11, 12, 'p'); }
      else if (a === 'sweat') { set(12, 6, 'q'); set(12, 7, 'q'); }
    }
    return g;
  }

  // ---------- DOM ----------
  const css = `
.kei { position: absolute; left: 0; top: 0; width: 48px; height: 72px; z-index: 30; pointer-events: none; will-change: transform; }
.kei .body { position: absolute; inset: 0; transform-origin: 50% 100%; transition: transform .12s ease; }
.kei canvas { width: 48px; height: 72px; image-rendering: pixelated; image-rendering: crisp-edges; display: block; pointer-events: auto; cursor: grab; touch-action: none; filter: drop-shadow(0 6px 6px rgba(11,13,18,.18)); }
.kei.flip canvas { transform: scaleX(-1); }
.kei.held canvas { cursor: grabbing; }
.kei.squash .body { transform: scale(1.18, .8); }
.kei .say { position: absolute; left: 50%; bottom: 80px; transform: translateX(-50%) translateY(4px); white-space: nowrap; pointer-events: none; opacity: 0;
  font: 600 12px/1 'Geist Mono', ui-monospace, monospace; letter-spacing: .02em; color: #0B0D12; background: #FFFFFF; padding: 8px 10px 7px;
  box-shadow: 0 -2px 0 #0B0D12, 0 2px 0 #0B0D12, -2px 0 0 #0B0D12, 2px 0 0 #0B0D12, 0 8px 18px -6px rgba(11,13,18,.3); transition: opacity .18s ease, transform .18s ease; }
.kei .say::after { content: ""; position: absolute; left: 50%; bottom: -6px; width: 6px; height: 8px; margin-left: -3px; background: #FFFFFF; box-shadow: -2px 0 0 #0B0D12, 2px 0 0 #0B0D12, 0 2px 0 #0B0D12; }
.kei .say.on { opacity: 1; transform: translateX(-50%) translateY(0); }
.kei .say.gold { background: #FFF3C4; } .kei .say.gold::after { background: #FFF3C4; }
.kei .z, .kei .heart, .kei .dust { position: absolute; pointer-events: none; font: 700 12px 'Geist Mono', monospace; color: #8A93A8; animation: keiFloat 1.6s ease-out forwards; }
.kei .heart { color: #FF6B8E; font-size: 14px; }
.kei .dust { width: 4px; height: 4px; background: #C9CFDC; animation: keiDust .5s ease-out forwards; }
.kei .note { position: absolute; pointer-events: none; font: 700 14px 'Geist Mono', ui-monospace, monospace; color: #2340FF; animation: keiFloat 1.5s ease-out forwards; }
.kei .note.p { color: #FF6B8E; }
.kei .mark { position: absolute; margin-left: -5px; pointer-events: none; font: 800 17px 'Geist Mono', ui-monospace, monospace; color: #0B0D12; animation: keiPop 1.1s ease-out forwards; }
.kei .prop { position: absolute; display: block; pointer-events: none; image-rendering: pixelated; background-size: 100% 100%; background-repeat: no-repeat; z-index: 2; }
@keyframes keiPop { 0% { opacity: 0; transform: translateY(6px) scale(.5); } 25% { opacity: 1; transform: translateY(-4px) scale(1.25); } 70% { opacity: 1; transform: translateY(-6px) scale(1); } 100% { opacity: 0; transform: translateY(-12px); } }
@keyframes keiFloat { from { opacity: 0; transform: translate(0, 0); } 20% { opacity: 1; } to { opacity: 0; transform: translate(10px, -34px); } }
@keyframes keiDust { from { opacity: .9; } to { opacity: 0; transform: translate(var(--dx), -6px); } }
.kei-fx { position: fixed; inset: 0; z-index: 29; pointer-events: none; overflow: hidden; }
.kei-fx i { position: absolute; display: block; will-change: transform, opacity; }
.kei-fx .prop { image-rendering: pixelated; background-size: 100% 100%; background-repeat: no-repeat; }
.kei .sign { position: absolute; bottom: 82px; white-space: nowrap; pointer-events: none; font: 700 11px/1 'Geist Mono', ui-monospace, monospace; color: #0B0D12; background: #FFE08A; padding: 6px 8px 5px; transform: translateX(-50%) rotate(-3deg);
  box-shadow: 0 -2px 0 #0B0D12, 0 2px 0 #0B0D12, -2px 0 0 #0B0D12, 2px 0 0 #0B0D12; }
.kei .sign::after { content: ""; position: absolute; left: 50%; top: 100%; width: 3px; height: 40px; margin-left: -1px; background: #8B5A3C; box-shadow: 0 0 0 1px #0B0D12; z-index: -1; }
.kei-boing { animation: keiBoing .45s cubic-bezier(.3,1.6,.5,1); }
@keyframes keiBoing { 30% { transform: translateY(3px) scaleY(.96); } 60% { transform: translateY(-3px); } }
.pc.kei-tap .pc-beam { opacity: 1 !important; animation: cbeam .6s linear infinite !important; }
.kei-flash { position: relative; } .kei-flash::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: #FFFFFF; animation: keiFlash .6s ease-out forwards; pointer-events: none; }
@keyframes keiFlash { from { opacity: .9; } to { opacity: 0; } }
@media (max-width: 600px) { .kei, .kei canvas { width: 40px; height: 60px; } .kei .say { bottom: 66px; font-size: 11px; } }
`;
  document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
  const el = document.createElement('div'); el.className = 'kei'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="body"><canvas width="16" height="24"></canvas></div><div class="say"></div>';
  document.body.appendChild(el);
  const cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), sayEl = el.querySelector('.say');
  const PW = () => el.offsetWidth, PH = () => el.offsetHeight, S = () => el.offsetWidth / W;

  let lastFrameKey = '';
  function draw(pose) {
    const worn = (me.acc && me.acc.length) || pose.acc ? { ...pose, acc: [...(pose.acc || []), ...(me.acc || [])] } : pose;   // what she is wearing is part of every frame
    const key = JSON.stringify(worn); if (key === lastFrameKey) return; lastFrameKey = key;
    const g = frame(worn); ctx.clearRect(0, 0, W, H);
    // a soft glow around the key
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === 'y' || g[y][x] === 'Y') for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X >= 0 && X < W && Y >= 0 && Y < H && g[Y][X] === '.') g[Y][X] = 'g'; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ch = g[y][x]; if (ch === '.') continue; ctx.fillStyle = PAL[ch]; ctx.fillRect(x, y, 1, 1); }
  }

  // ---------- where she can stand: the tops of real elements on the page ----------
  const SPOTS = [
    { sel: '#hero-h .l:first-child > span', kind: 'title', w: 3 },
    { sel: '#heroStage .pc .pc-rot', kind: 'card', w: 4 },
    { sel: '.hero .facts .tlink', kind: 'shoplink', w: 1 },
    { sel: '#plate .cmini, #plate .pc', kind: 'plate', w: 1 },
    { sel: '#says li', kind: 'says', w: 2 },
    { sel: '#anat-h, #decks-h, #code-h, #odds-h, #travel-h', kind: 'heading', w: 1 },
    { sel: '.deck-row .off', kind: 'chip', w: 2 },
    { sel: '.deck-row h3', kind: 'deck', w: 1 },
    { sel: '.codewrap .term', kind: 'term', w: 2 },
    { sel: '#oddsRow .odd', kind: 'odd', w: 2 },
    { sel: '#pips', kind: 'pips', w: 1 },
    { sel: '#ubar', kind: 'ubar', w: 1 },
    { sel: '#shareimg', kind: 'share', w: 2 },
    { sel: '#lastH', kind: 'last', w: 1 },
  ];
  const topbarH = () => (document.querySelector('.topbar')?.getBoundingClientRect().bottom || 64);
  function surfaces() {
    const out = [], vh = innerHeight, vw = document.documentElement.clientWidth, tb = topbarH();
    for (const s of SPOTS) for (const node of document.querySelectorAll(s.sel)) {
      const r = node.getBoundingClientRect();
      if (r.width < 44 || r.height < 6) continue;
      if (r.top < tb + PH() + 16 || r.top > vh - 24 || r.right < 30 || r.left > vw - 30) continue;
      out.push({ node, kind: s.kind, w: s.w, r });
    }
    return out;
  }
  const pageX = (r) => r.left + scrollX, pageY = (r) => r.top + scrollY;

  // ---------- state ----------
  const me = { x: 0, y: 0, vy: 0, dir: 1, mode: 'idle', on: null, ox: 0, pose: {}, seated: false, busyUntil: 0, actId: 0, lastInput: performance.now(), visited: new Set(), pokes: 0, pokeAt: 0, whimming: false, whimAct: 0, recent: [], lastHop: performance.now(), acc: [], curAct: '' };
  function place() {
    const sit = me.seated ? 4 * S() : 0;
    el.style.transform = `translate3d(${Math.round(me.x)}px, ${Math.round(me.y - PH() + sit)}px, 0)`;
    el.classList.toggle('flip', me.dir < 0);
  }
  function setPose(p) { me.pose = p; draw(p); }
  let sayT = 0;
  function say(text, ms = 2200, cls = '') {
    clearTimeout(sayT); sayEl.textContent = text; sayEl.className = 'say on ' + cls;
    sayT = setTimeout(() => { sayEl.className = 'say'; }, ms);
  }
  function puff(cls, txt, dx = 0, dy = 0) {
    const n = document.createElement('span'); n.className = cls; if (txt) n.textContent = txt;
    n.style.left = (PW() / 2 + dx) + 'px'; n.style.top = (dy) + 'px'; if (cls === 'dust') n.style.setProperty('--dx', (dx > 0 ? 8 : -8) + 'px');
    el.appendChild(n); n.addEventListener('animationend', () => n.remove());
  }
  function squash() { el.classList.add('squash'); setTimeout(() => el.classList.remove('squash'), 130); for (const d of [-14, -6, 6, 14]) puff('dust', '', d, PH() - 4); }
  function boing(node) { if (!node || reduced) return; const t = node.closest('.odd, .off, li, h2, h3, .tlink, #pips, #ubar') || node; if (getComputedStyle(t).display === 'inline') return; t.classList.remove('kei-boing'); void t.offsetWidth; t.classList.add('kei-boing'); setTimeout(() => t.classList.remove('kei-boing'), 500); }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = (a) => a[(Math.random() * a.length) | 0];

  // stand on a surface (x clamped to it); used every frame while idle so moving cards carry her
  function stickTo(s, ox) {
    const r = s.node.getBoundingClientRect();
    me.on = s; me.ox = Math.min(Math.max(ox, 6), Math.max(6, r.width - PW() - 6));
    me.x = pageX(r) + me.ox; me.y = pageY(r);
  }

  // ---------- movement ----------
  let anim = null;   // { kind: 'walk' | 'jump' | 'fall', ... }
  // opts.quiet: just a stroll, no arrival routine; opts.after: do this on arrival instead
  function walkTo(s, ox, opts = {}) {
    const r = s.node.getBoundingClientRect(); const tx = pageX(r) + Math.min(Math.max(ox, 6), Math.max(6, r.width - PW() - 6));
    me.dir = tx >= me.x ? 1 : -1; me.mode = 'walk'; me.seated = false;
    anim = { kind: 'walk', s, ox: tx - pageX(r), t0: performance.now(), ...opts };
  }
  function jumpTo(s, ox, after) {
    const r = s.node.getBoundingClientRect(); const tx = pageX(r) + Math.min(Math.max(ox, 6), Math.max(6, r.width - PW() - 6)), ty = pageY(r);
    const dist = Math.hypot(tx - me.x, ty - me.y);
    me.dir = tx >= me.x ? 1 : -1; me.mode = 'jump'; me.seated = false; me.on = null;
    anim = { kind: 'jump', s, after, ox: tx - pageX(r), x0: me.x, y0: me.y, t0: performance.now(), dur: Math.min(1100, Math.max(420, dist * 1.3)), peak: Math.max(46, Math.abs(tx - me.x) * 0.22) + Math.max(0, me.y - ty) };
  }
  function dropInto(s, ox, after) {
    // she falls in from the top of the screen, above the spot
    const r = s.node.getBoundingClientRect();
    me.x = pageX(r) + Math.min(Math.max(ox, 6), Math.max(6, r.width - PW() - 6)); me.y = scrollY + topbarH() - 10; me.vy = 0;
    me.mode = 'fall'; me.seated = false; me.on = null; anim = { kind: 'fall', s, after };
  }
  function travel(s, ox, after) {
    if (me.on && me.on.node === s.node) { walkTo(s, ox, { after }); return; }
    const r = s.node.getBoundingClientRect();
    const myScreenY = me.y - scrollY, far = Math.hypot(pageX(r) - me.x, r.top - myScreenY) > 900 || myScreenY < topbarH() || myScreenY > innerHeight + 40;
    if (reduced) { stickTo(s, ox); land(s, false, after); return; }
    if (far) dropInto(s, ox, after); else jumpTo(s, ox, after);
  }
  function land(s, hard = false, after) {
    me.mode = 'idle'; anim = null; stickTo(s, me.x - pageX(s.node.getBoundingClientRect()));
    if (!reduced) squash(); boing(s.node);
    if (hard) { say(pick(['Oof!', 'Ow…', 'Safe!']), 1200); }
    me.busyUntil = performance.now() + 500;
    nextThink = Math.max(nextThink, performance.now() + 2600);   // let the arrival routine play out first
    if (after) after(); else arrive(s);
  }

  // ---------- what she does where she lands ----------
  const LINES = {
    poke: ['Hi! I\'m Kei.', 'What\'s on the card is what you get.', 'Flip one. Go on.', 'I keep the keys.', 'No hidden fees. I checked.', 'Budgets: safe.', 'Psst. Gold is shiny.'],
    says: { 0: 'The real one!', 1: 'Name it, know it.', 2: 'Not a cent more.' },
  };
  async function arrive(s) {
    const id = ++me.actId, live = () => id === me.actId && me.mode === 'idle';
    const t = s.node, k = s.kind;
    if (k === 'card') {
      const pc = t.closest('.pc'); const o = pc && pc.classList.contains('revealed');
      if (!o) {
        // a face-down card: she tries her key on it
        setPose({ arms: 'forward', mouth: 'o' }); await sleep(250); if (!live()) return;
        for (let i = 0; i < 3; i++) { pc && pc.classList.add('kei-tap'); setPose({ arms: 'forward', mouth: 'o', glint: true }); await sleep(180); setPose({ arms: 'forward', mouth: 'o' }); await sleep(160); if (!live()) { pc && pc.classList.remove('kei-tap'); return; } }
        pc && pc.classList.remove('kei-tap');
        say(pick(['Locked. Tap it!', 'What\'s under here?', 'Psst… flip this one.', 'My key won\'t fit. Yours will.']));
        setPose({ eyes: 'open' }); me.seated = false;
      } else {
        const gold = pc.hasAttribute('data-gold'), ult = pc.hasAttribute('data-ultimate');
        if (ult) cheer('ULTIMATE?!', true); else if (gold) cheer(pick(['GOLD!!', 'So shiny…', 'That\'s a steal!']), true);
        else { say(pick(['Nice one.', 'Not bad!', 'Claim it?'])); setPose({ eyes: 'happy' }); }
      }
      return;
    }
    if (k === 'title') { me.seated = true; setPose({ legs: 'stand' }); place(); if (Math.random() < 0.5) say(pick(['At face value!', 'Nice view up here.', 'This word is mine.'])); return; }
    if (k === 'shoplink') { setPose({ arms: 'forward' }); say('Or… flip first!'); await sleep(1600); if (live()) setPose({}); return; }
    if (k === 'says') { const i = [...t.parentNode.children].indexOf(t); say(LINES.says[i] || 'Rules on keys!'); t.dispatchEvent(new MouseEvent('mouseenter')); await sleep(2200); t.dispatchEvent(new MouseEvent('mouseleave')); return; }
    if (k === 'chip') { cheer(t.textContent.replace('Up to ', '') + '!'); return; }
    if (k === 'deck') { me.seated = true; place(); say(pick(['Good deck.', 'I\'d pick this one.', 'Comfy.'])); return; }
    if (k === 'plate') { say('Read the card. All of it.'); return; }
    if (k === 'term') {
      say('>_ typing…', 1800);
      for (let i = 0; i < 8; i++) { setPose({ arms: i % 2 ? 'forward' : 'down', eyes: 'open' }); await sleep(140); if (!live()) return; }
      setPose({}); say(pick(['It compiled!', 'Ship it.', 'model="text". Easy.'])); return;
    }
    if (k === 'odd') {
      const kk = t.dataset.k;
      if (kk === 'jackpot') { setPose({ arms: 'up', eyes: 'wide' }); say('2%… I believe.', 2000, 'gold'); await sleep(1300); if (live()) setPose({}); }
      else if (Math.random() < 0.5) say(t.querySelector('.p')?.textContent.replace(/\s+/g, '') + ' — ' + (t.querySelector('.t')?.textContent.split('·')[0].trim() || ''));
      return;
    }
    if (k === 'pips') { const n = document.getElementById('jpLeft')?.textContent || ''; setPose({ arms: 'forward' }); say(`${n} jackpots left!`, 2000, 'gold'); await sleep(1500); if (live()) setPose({}); return; }
    if (k === 'ubar') {
      for (let i = 0; i < 4; i++) { setPose({ arms: 'forward', eyes: 'blink', mouth: 'open' }); boing(t); await sleep(220); if (!live()) return; }
      setPose({}); say(`${document.getElementById('ultIn')?.textContent || 'Some'} cards to go…`); return;
    }
    if (k === 'share') {
      setPose({ arms: 'up', eyes: 'happy', mouth: 'open' }); say('Cheese!', 1400);
      await sleep(700); if (!live()) return;
      t.classList.remove('kei-flash'); void t.offsetWidth; t.classList.add('kei-flash'); setTimeout(() => t.classList.remove('kei-flash'), 700);
      await sleep(700); if (live()) setPose({}); return;
    }
    if (k === 'last') { me.seated = true; place(); say(/New cards/.test(t.textContent) ? 'See you tomorrow!' : 'Flip them! I\'ll watch.'); return; }
    if (k === 'heading' && Math.random() < 0.4) { me.seated = true; place(); }
  }
  async function cheer(text, gold = false) {
    const id = ++me.actId;
    say(text, 2400, gold ? 'gold' : '');
    for (let i = 0; i < (gold ? 3 : 2); i++) {
      if (id !== me.actId) return;
      setPose({ arms: 'up', eyes: 'happy', mouth: 'open', legs: 'tuck', glint: true });
      el.style.transition = 'none';
      for (let f = 0; f <= 10; f++) { if (id !== me.actId) return; const lift = Math.sin((f / 10) * Math.PI) * 22; el.style.marginTop = (-lift) + 'px'; await sleep(26); }
      el.style.marginTop = '0px';
      if (gold) puff('heart', '✦', (Math.random() - 0.5) * 30, 0);
    }
    if (id === me.actId) setPose({ eyes: 'happy' });
  }

  // ---------- choosing what to do next ----------
  function choose() {
    const list = surfaces();
    if (!list.length) return null;
    const here = me.on && me.on.node;
    const scored = list.filter((s) => s.node !== here).map((s) => {
      const d = Math.hypot(pageX(s.r) - me.x, pageY(s.r) - me.y);
      return { s, score: s.w * (me.visited.has(s.node) ? 0.35 : 1) * (d < 600 ? 1.6 : 0.8) * (0.6 + Math.random()) };
    }).sort((a, b) => b.score - a.score);
    return scored[0] ? scored[0].s : null;
  }
  function goSomewhere() {
    const s = choose(); if (!s) return false;
    me.visited.add(s.node); if (me.visited.size > 8) me.visited.delete(me.visited.values().next().value);
    me.lastHop = performance.now();
    travel(s, s.r.width * (0.2 + Math.random() * 0.6) - PW() / 2);
    return true;
  }

  // ==== ACTS BEGIN ====
  // ---------- little things she does on her own ----------
  const ptr = { x: -1, y: -1, t: 0 };                        // where the visitor's pointer last was
  const cool = {};                                           // name -> earliest time it may happen again
  const ready = (k, now = performance.now()) => !(cool[k] > now);
  const hold = (k, ms) => { cool[k] = performance.now() + ms; };
  const whimBusy = () => me.whimming && me.whimAct === me.actId;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const bodyEl = el.querySelector('.body');
  const fxLayer = document.createElement('div'); fxLayer.className = 'kei-fx'; fxLayer.setAttribute('aria-hidden', 'true'); document.body.appendChild(fxLayer);

  // wait ms, but give up the moment something else takes over; resolves false when interrupted
  async function wait(ms, live) {
    const end = performance.now() + ms;
    while (performance.now() < end) { if (!live()) return false; await sleep(Math.min(60, Math.max(1, end - performance.now()))); }
    return live();
  }
  function bounce(h = 18, ms = 380) {
    if (reduced || !el.animate) return Promise.resolve();
    const a = el.animate([{ marginTop: '0px', easing: 'cubic-bezier(.2,.7,.4,1)' }, { marginTop: `${-h}px`, easing: 'cubic-bezier(.6,0,.8,.4)' }, { marginTop: '0px' }], { duration: ms });
    return a.finished.catch(() => {});
  }
  // animate her whole body (rotate, scale, slide); stops cleanly if something interrupts
  async function playBody(frames, dur, live, o = {}) {
    if (reduced || !bodyEl.animate) return wait(dur, live);
    const a = bodyEl.animate(frames, { duration: dur, easing: 'ease-in-out', ...o }); onEnd(() => { try { a.cancel(); } catch (e) { /* already gone */ } });
    const ok = await wait(dur, live); if (!ok) a.cancel(); return ok;
  }
  // a list of beats: [pose, ms, fn?]; false when interrupted
  async function beats(live, list) {
    for (const [p, ms = 300, f] of list) { if (p) setPose(p); if (f) f(); if (!await wait(ms, live)) return false; }
    return true;
  }
  // everything an act puts on the page is swept when it ends, however it ends
  let junk = new Set(), undo = [];
  const track = (n) => { junk.add(n); return n; };
  const onEnd = (f) => { undo.push(f); };
  function sweep(j, u) { for (const n of j) { clearInterval(n._iv); n.remove(); } for (const f of u) { try { f(); } catch (e) { /* nothing to undo */ } } }

  // screen positions (feet, head, middle)
  const feetAt = () => ({ x: me.x - scrollX + PW() / 2, y: me.y - scrollY });
  const headAt = () => { const f = feetAt(); return { x: f.x, y: f.y - PH() + 6 }; };
  const midAt = () => { const f = feetAt(); return { x: f.x, y: f.y - PH() / 2 }; };
  const sees = () => ptr.x >= 0 && performance.now() - ptr.t < 6000;     // the visitor's pointer is around

  // ---------- pixel props (drawn once from her own palette) ----------
  const PPAL = { ...PAL, q: '#B8ECFF', r: '#FF4D6D', x: '#C9CFDC', a: '#8A93A8', n: '#8B5A3C', N: '#C98B5E', t: '#37C871', v: '#7A5CFF', b: '#6CF0FF', P: '#FF7AC6', l: '#FFD866', z: '#0B0D12', O: '#FF9A3C' };
  const SPR = {
    key: ['.yyy.', 'y...y', 'y...y', '.yyy.', '..Y..', '..yy.', '..Y..', '..yy.'],
    card: ['cccccc', 'cCCCCc', 'cCwwCc', 'cCwwCc', 'cCCCCc', 'cCCCCc', 'cccccc'],
    gold: ['yyyyyy', 'yYYYYy', 'yYwwYy', 'yYwwYy', 'yYYYYy', 'yYYYYy', 'yyyyyy'],
    heart: ['.rr.rr.', 'rprrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
    spark: ['..y..', '.yYy.', 'yYwYy', '.yYy.', '..y..'],
    twinkle: ['..b..', '.bwb.', 'bwwwb', '.bwb.', '..b..'],
    anger: ['rr.rr', 'rr.rr', '.....', 'rr.rr', 'rr.rr'],
    umbrella: ['...ccccc...', '.ccwcccwcc.', 'cccwcccwccc', 'c.cwc.cwc.c', '.....n.....', '.....n.....', '.....n.....', '.....n.....', '.....n.....', '.....n.....', '.....n.....', '.....n.....', '.....n.....', '.....n.....', '....nn.....'],
    balloon: ['..rrr..', '.rrrrr.', 'rprrrrr', 'rprrrrr', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...', '...a...', '...a...'],
    plane: ['......w..', '....wwwx.', '..wwwwxxw', 'wwwwxxwww', '.wwwwwx..', '...xx....'],
    flutA: ['PP.....PP', 'PPP.k.PPP', '.PPPkPPP.', '..PPkPP..', '...bkb...', '....k....'],
    flutB: ['.........', '...P.P...', '..PPkPP..', '..PPkPP..', '...PkP...', '....k....'],
    glass: ['..aaaa...', '.aqqqqa..', 'aqwqqqqa.', 'aqqqqqqa.', 'aqqqqqqa.', '.aqqqqa..', '..aaaan..', '......nn.', '.......nn'],
    binos: ['.aa..aa.', 'aqqaaqqa', 'aqqaaqqa', 'aaaaaaaa', '.aa..aa.'],
    mug: ['wwwwww..', 'wnnnnwww', 'wwwwww.w', 'wwwwwwww', 'wwwwww..', '.wwww...'],
    book: ['cccccccccccc', 'cwwwwwxwwwwc', 'cwxxxwxwxxwc', 'cwwwwwxwwwwc', 'cwxxxwxwxxwc', 'cccccccccccc'],
    laptop: ['aaaaaaaaaaaa', 'azzzzzzzzzza', 'azbbbzzzzzza', 'azzzzbbbbzza', 'azbbzzzzzzza', 'aaaaaaaaaaaa', '.xxxxxxxxxx.'],
    camera: ['..zz.....', 'zzzzzzzzz', 'zxzzzzzzz', 'zzzaaazzz', 'zzaqqqazz', 'zzaqwqazz', 'zzzaaazzz', 'zzzzzzzzz'],
    flag: ['acccccc', 'acCcccc', 'accccc.', 'acccc..', 'accc...', 'a......', 'a......', 'a......', 'a......', 'a......'],
    wand: ['.....y.', '....yYy', '....zy.', '...z...', '..z....', '.z.....', 'z......'],
    shovel: ['.nnn.', '..n..', '..a..', '..a..', '.aaa.', 'aaaaa', 'aaaaa', '.aaa.'],
    coin: ['.yyy.', 'yYYyy', 'yYyyy', 'yyyyy', '.yyy.'],
    dumbbell: ['zz.....zz', 'zzzaaazzz', 'zzzaaazzz', 'zz.....zz'],
    catA: ['O....O', 'OO..OO', 'OOOOOO', 'OzOOzO', 'OOOOOO', '.OOOO.', '.O..O.'],
    catB: ['O....O', 'OO..OO', 'OOOOOO', 'OzzOOO', 'OOOOOO', '.OOOO.', '.O..O.'],
    kite: ['...r...', '..rrr..', '.rrwrr.', 'rrrwrrr', '.rrwrr.', '..rrr..', '...r...'],
    cloud: ['..xx.xx..', '.xxxxxxx.', 'xxxxxxxxx', '.xxxxxxx.'],
    snow: ['www', 'www', 'www'],
    bubble: ['..qqq..', '.q...q.', 'q.w...q', 'q.....q', 'q.....q', '.q...q.', '..qqq..'],
    rocket: ['..r..', '.rrr.', '.rwr.', '.rrr.', '.rrr.', 'rrrrr', 'r.l.r', '..l..', '..y..'],
    pola: ['wwwwww', 'wttttw', 'wtbbtw', 'wttttw', 'wwwwww', 'wwwwww'],
    fish: ['...bbb....', '.bbbbbbb.b', 'bbwbbbbbbb', '.bbbbbbb.b', '...bbb....'],
    yo: ['.rr.', 'rwrr', 'rrrr', '.rr.'],
    ball: ['.www.', 'wwwxw', 'wwwww', 'wxxxw', '.www.'],
    star: ['...y...', '...y...', 'yyyyyyy', '.yyYyy.', '..yyy..', '.yy.yy.', '.y...y.'],
  };
  const FLAT = new Set(['spark', 'twinkle', 'anger', 'bubble', 'snow']);     // no dark outline
  const propCache = {};
  function propURL(kind, tint) {
    const ck = kind + (tint ? JSON.stringify(tint) : ''); if (propCache[ck]) return propCache[ck];
    const rows = SPR[kind], h = rows.length, w = rows[0].length, flat = FLAT.has(kind);
    const c = document.createElement('canvas'); c.width = w + 2; c.height = h + 2; const x = c.getContext('2d');
    const at = (X, Y) => (X >= 0 && Y >= 0 && X < w && Y < h ? rows[Y][X] : '.');
    for (let Y = -1; Y <= h; Y++) for (let X = -1; X <= w; X++) {
      let ch = at(X, Y);
      if (ch !== '.') { if (tint && tint[ch]) ch = tint[ch]; x.fillStyle = PPAL[ch]; x.fillRect(X + 1, Y + 1, 1, 1); }
      else if (!flat && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(X + dx, Y + dy) !== '.')) { x.fillStyle = PPAL.o; x.fillRect(X + 1, Y + 1, 1, 1); }
    }
    return (propCache[ck] = { url: c.toDataURL(), w: w + 2, h: h + 2 });
  }
  // a sprite element, `s` screen px per pixel
  function sprite(kind, { tint, s = S() } = {}) {
    const p = propURL(kind, tint), n = document.createElement('i'); n.className = 'prop';
    n.style.cssText = `width:${p.w * s}px;height:${p.h * s}px;background-image:url(${p.url});`; n._w = p.w * s; n._h = p.h * s; n._kind = kind; n._tint = tint; n._s = s;
    return n;
  }
  const reskin = (n, kind, tint) => { n.style.backgroundImage = `url(${propURL(kind, tint || n._tint).url})`; };
  // two-frame sprites (wings, blinking eyes): swap every `ms`
  function flip2(n, a, b, ms = 140) { let i = 0; n._iv = setInterval(() => { reskin(n, i++ % 2 ? a : b); }, ms); return n; }
  const put = (n, left, top, parent = el) => { n.style.left = left + 'px'; n.style.top = top + 'px'; parent.appendChild(n); return track(n); };
  // where the key hand is for each arm pose (sprite pixels)
  const HANDS = { down: [12, 16], forward: [15, 14], up: [14, 10], waveR: [14, 10], waveR2: [15, 10], out: [15, 13], shrug: [15, 13], hips: [13, 15], clap: [7, 14] };
  function inHand(kind, arms = 'forward', o = {}) {
    const [hx, hy] = HANDS[arms] || HANDS.forward, n = sprite(kind, o), s = S();
    const x = (me.dir < 0 ? W - 1 - hx : hx) * s + s / 2 - n._w / 2 + (o.dx || 0) * (me.dir < 0 ? -1 : 1);
    return put(n, x, hy * s - n._h + s + (o.dy || 0));
  }
  // in front of the face (binoculars, camera, glasses)
  function atFace(kind, o = {}) { const n = sprite(kind, o); return put(n, PW() / 2 - n._w / 2 + (o.dx || 0) * me.dir, 7 * S() - n._h / 2 + (o.dy || 0)); }

  // ---------- particles and page-wide effects ----------
  const CONFETTI = ['#2340FF', '#5B73FF', '#F2B51C', '#FFE08A', '#FF7AC6', '#6CF0FF', '#9A7BFF'];
  const play = (n, frames, ms, o = {}) => {
    const a = n.animate(frames, { duration: ms, easing: 'linear', fill: 'forwards', ...o });
    a.finished.then(() => { if (!o.keep) n.remove(); }, () => n.remove()); return a;
  };
  // a sprite in the page layer at screen x, y (centred)
  function fxSprite(kind, x, y, o = {}) {
    const n = sprite(kind, o); n.style.left = (x - n._w / 2) + 'px'; n.style.top = (y - n._h / 2) + 'px'; fxLayer.appendChild(n); return n;
  }
  // a sprite that flies from (x, y) by (dx, dy) and fades
  function flyer(kind, x, y, dx, dy, { ms = 1000, rot = 0, o = {}, ease = 'ease-out' } = {}) {
    const n = fxSprite(kind, x, y, o);
    play(n, [{ transform: 'translate(0,0) scale(.6) rotate(0deg)', opacity: 0 }, { transform: `translate(${dx * 0.15}px, ${dy * 0.15}px) scale(1) rotate(${rot * 0.15}deg)`, opacity: 1, offset: 0.15 }, { transform: `translate(${dx}px, ${dy}px) scale(1) rotate(${rot}deg)`, opacity: 1, offset: 0.8 }, { transform: `translate(${dx * 1.05}px, ${dy * 1.05}px) scale(1) rotate(${rot}deg)`, opacity: 0 }], ms, { easing: ease });
    return n;
  }
  // pixel squares thrown out of a point
  function burst(x, y, { n = 16, colors = CONFETTI, size = 6, speed = 170, g = 520, life = 1100, spread = 360, dir = -90 } = {}) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const a = (dir + (Math.random() - 0.5) * spread) * Math.PI / 180, v = speed * (0.45 + Math.random() * 0.75), vx = Math.cos(a) * v, vy = Math.sin(a) * v;
      const sz = size * (Math.random() < 0.3 ? 1.6 : 1), b = document.createElement('i');
      b.style.cssText = `left:${x}px;top:${y}px;width:${sz}px;height:${sz}px;background:${pick(colors)};`; fxLayer.appendChild(b);
      const T = life / 1000, k = [];
      for (let f = 0; f <= 6; f++) { const t = (f / 6) * T; k.push({ transform: `translate(${vx * t}px, ${vy * t + 0.5 * g * t * t}px) rotate(${f * 90}deg)`, opacity: f === 6 ? 0 : 1 }); }
      play(b, k, life);
    }
  }
  // a ring of things circling above her head (dizzy stars)
  function orbit(kind, n, r, ms) {
    const w = document.createElement('div'); w.style.cssText = `position:absolute;left:${PW() / 2}px;top:${S() * 2}px;width:0;height:0;`;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, c = sprite(kind, { s: 2 }); c.style.left = (Math.cos(a) * r - c._w / 2) + 'px'; c.style.top = (Math.sin(a) * r * 0.45 - c._h / 2) + 'px'; w.appendChild(c); }
    el.appendChild(w); track(w);
    if (!reduced) w.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: ms, iterations: Infinity });
    return w;
  }
  // a sweep of light across a real element on the page
  function shine(node) {
    if (!node || reduced) return; const r = node.getBoundingClientRect(); if (r.width < 8) return;
    const box = document.createElement('div'), bar = document.createElement('i');
    box.style.cssText = `position:absolute;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;overflow:hidden;`;
    bar.style.cssText = 'position:absolute;top:-20%;left:0;width:28%;height:140%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.9),transparent);transform:translateX(-120%) skewX(-18deg);';
    box.appendChild(bar); fxLayer.appendChild(box);
    play(bar, [{ transform: 'translateX(-120%) skewX(-18deg)' }, { transform: 'translateX(420%) skewX(-18deg)' }], 800, { easing: 'ease-in-out' }).finished.then(() => box.remove(), () => box.remove());
  }
  // a shove: the element jolts sideways
  function shake(node) { if (!node || reduced || !node.animate || getComputedStyle(node).display === 'inline') return; node.animate([{ translate: '0 0' }, { translate: '-5px 0' }, { translate: '5px 0' }, { translate: '-3px 0' }, { translate: '3px 0' }, { translate: '0 0' }], { duration: 460 }); }
  // raindrops / snowflakes across the viewport for a while
  function weather(kind, ms) {
    if (reduced) return; const end = performance.now() + ms, vw = document.documentElement.clientWidth;
    const iv = setInterval(() => {
      if (performance.now() > end) { clearInterval(iv); return; }
      for (let i = 0; i < 3; i++) {
        const d = document.createElement('i'), x = Math.random() * vw, rain = kind === 'rain', sz = rain ? 3 : 4 + (Math.random() * 3 | 0);
        d.style.cssText = `left:${x}px;top:-12px;width:${rain ? 2 : sz}px;height:${rain ? 10 : sz}px;background:${rain ? '#6CCBFF' : '#FFFFFF'};box-shadow:${rain ? 'none' : '0 0 0 1px rgba(11,13,18,.12)'};`; fxLayer.appendChild(d);
        play(d, [{ transform: 'translate(0,0)' }, { transform: `translate(${rain ? -18 : (Math.random() - 0.5) * 80}px, ${innerHeight + 20}px)` }], rain ? rnd(650, 900) : rnd(2200, 3200));
      }
    }, 90);
    onEnd(() => clearInterval(iv));
  }
  // what she is wearing (costumes last a while, then come off)
  let wearT = 0;
  function wear(list, ms) { me.acc = list; clearTimeout(wearT); wearT = setTimeout(() => { me.acc = []; setPose(me.pose); }, ms); setPose(me.pose); }
  const onSurface = () => (me.on && me.on.node && me.on.node.isConnected ? me.on.node : null);

  // ---------- the acts ----------
  // act(id, weight, fn, { sit: needs to be seated, keepSeat: may stay seated, need(ctx): when it makes sense, bias(ctx): likelier when... })
  const A = [];
  const act = (id, w, fn, o = {}) => { A.push({ id, w, fn, ...o }); };
  const IDLE_LINES = ['Hard caps. I love them.', 'One key, one model.', 'Still face value.', 'I count the cards.', 'Keys: polished.', 'Nobody flips? Fine.', 'Budgets: safe.', 'Gold is never a surprise.'];
  const hourLines = () => { const h = new Date().getHours(); return h < 5 ? ['Still up?', 'Night shift.'] : h < 11 ? ['Good morning.', 'Coffee first.'] : h < 17 ? ['Good afternoon.', 'Flip before lunch.'] : h < 22 ? ['Good evening.', 'Evening flips hit different.'] : ['Late flip?', 'Night owl.']; };

  // --- the first set: looking around, waving, hopping, humming, tossing things ---
  async function wave(live, dx = 0, quiet = false) {
    if (dx) me.dir = dx > 0 ? 1 : -1;
    if (!quiet && Math.random() < 0.5) say(pick(['Hi!', 'Hello!', 'Over here!', 'Hey you.']), 1700);
    for (let i = 0; i < 7; i++) { setPose({ arms: i % 2 ? 'waveR2' : 'waveR', eyes: 'happy', mouth: 'open', glint: i % 2 === 0 }); if (!await wait(170, live)) return; }
    setPose({ eyes: 'happy' }); await wait(450, live);
  }
  act('look', 3, async (live) => {
    const n = 2 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) { me.dir *= -1; setPose({ eyes: i % 2 ? 'open' : 'wide' }); if (!await wait(650 + Math.random() * 600, live)) return; }
  }, { keepSeat: true });
  act('wave', 0.7, (live) => wave(live));
  act('hop', 2, async (live) => {
    const n = 1 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) {
      setPose({ legs: 'tuck', arms: 'up', eyes: 'happy', mouth: 'open' }); await bounce(20, 420); if (!live()) return;
      squash(); setPose({ eyes: 'happy' }); if (!await wait(160, live)) return;
    }
    if (Math.random() < 0.3) say(pick(['Boing!', 'Hup!', 'Wheee.']), 1100);
  });
  act('hum', 2.2, async (live) => {
    for (let i = 0; i < 4; i++) {
      setPose({ eyes: 'happy', mouth: i % 2 ? 'o' : 'smile' });
      puff(i % 2 ? 'note p' : 'note', i % 2 ? '♪' : '♫', 8 + Math.random() * 12, 4);
      if (!await wait(430, live)) return;
    }
  }, { keepSeat: true });
  act('keyToss', 2.6, async (live) => {
    setPose({ arms: 'up', mouth: 'o' }); if (!await wait(280, live)) return;
    const miss = Math.random() < 0.22, rise = 62 + Math.random() * 16, turns = 360 * (2 + ((Math.random() * 2) | 0)), dur = miss ? 1050 : 900;
    setPose({ arms: 'up', key: false, mouth: 'o' });
    const k = inHand('key', 'up');
    k.animate([
      { transform: 'translateY(0) rotate(0deg)', easing: 'cubic-bezier(.2,.7,.4,1)' },
      { transform: `translateY(${-rise}px) rotate(${turns / 2}deg)`, easing: 'cubic-bezier(.6,0,.8,.4)' },
      { transform: `translateY(${miss ? PH() * 0.55 : 0}px) rotate(${turns}deg)` },
    ], { duration: dur, fill: 'forwards' });
    if (!await wait(dur, live)) return;
    if (miss) {
      setPose({ arms: 'down', key: false, mouth: 'o', eyes: 'wide' }); say(pick(['Oops!', 'Clink.', 'Butterfingers.']), 1300);
      if (!await wait(900, live)) return;
      setPose({ legs: 'tuck', arms: 'forward', key: false }); if (!await wait(350, live)) return;
      k.remove(); squash(); setPose({ eyes: 'happy' }); await wait(500, live);
    } else {
      k.remove(); setPose({ arms: 'up', eyes: 'happy', mouth: 'open', glint: true });
      if (Math.random() < 0.5) say(pick(['Got it.', 'Smooth.', 'Nailed it.']), 1400);
      await bounce(8, 260); await wait(500, live);
    }
  });
  act('cardToss', 2.4, async (live) => {
    const gold = Math.random() < 0.3;
    setPose({ arms: 'up', mouth: 'o' }); if (!await wait(260, live)) return;
    setPose({ arms: 'up', key: false, mouth: 'o' });
    const c = inHand('card', 'up'), rise = 66 + Math.random() * 14;
    c.animate([
      { transform: 'translateY(0) rotateX(0deg)', easing: 'cubic-bezier(.2,.7,.4,1)' },
      { transform: `translateY(${-rise}px) rotateX(540deg)`, easing: 'cubic-bezier(.6,0,.8,.4)' },
      { transform: 'translateY(0) rotateX(1080deg)' },
    ], { duration: 1000, fill: 'forwards' });
    setTimeout(() => { if (gold && c.isConnected) reskin(c, 'gold'); }, 520);
    if (!await wait(1000, live)) return;
    setPose({ arms: 'up', key: false, mouth: gold ? 'open' : 'smile', eyes: gold ? 'happy' : 'open', glint: gold });
    if (gold) { say(pick(['GOLD!', 'Shiny!', 'Told you.']), 1800, 'gold'); puff('heart', '✦', (Math.random() - 0.5) * 30, 0); await bounce(16, 360); }
    else if (Math.random() < 0.5) say(pick(['Next one.', 'Not this time.', 'Almost!']), 1400);
    await wait(700, live);
  });
  act('think', 1.2, async (live) => {
    setPose({ arms: 'forward', mouth: 'o', eyes: 'open' }); puff('mark', '?', 4, -6); if (!await wait(900, live)) return;
    me.dir *= -1; setPose({ arms: 'forward', mouth: 'smile' }); if (!await wait(800, live)) return;
    if (Math.random() < 0.55) { puff('mark', '!', 4, -6); setPose({ arms: 'up', eyes: 'wide', mouth: 'open', glint: true }); say(pick(['Idea!', 'Oh!', 'Got it.']), 1300); await bounce(14, 340); await wait(600, live); }
  }, { keepSeat: true });
  act('spin', 1, async (live) => {
    for (let i = 0; i < 7; i++) {
      me.dir *= -1; setPose({ legs: i % 2 ? 'step' : 'tuck', arms: 'up', eyes: 'happy', mouth: 'open' });
      if (i === 1) bounce(18, 560);
      if (!await wait(100, live)) return;
    }
    squash(); say(pick(['Ta-da!', 'Wheee!']), 1200); await wait(500, live);
  });
  act('dance', 1.4, async (live) => {
    say(pick(['♪ ♫ ♪', 'Dance break!', 'Ssh. Music.']), 1700);
    for (let i = 0; i < 10; i++) {
      me.dir = i % 4 < 2 ? 1 : -1;
      setPose({ arms: i % 2 ? 'waveL' : 'waveR', legs: i % 2 ? 'step' : 'stand', eyes: 'happy', mouth: 'open' });
      bounce(10, 230);
      if (i % 2 === 0) puff(i % 4 ? 'note p' : 'note', i % 4 ? '♪' : '♫', (Math.random() - 0.5) * 28, 4);
      if (!await wait(250, live)) return;
    }
  });
  act('mutter', 1.3, async (live) => {
    setPose({ arms: 'forward', mouth: 'open', glint: true }); say(pick([...IDLE_LINES, ...hourLines()]), 2200); await wait(2000, live);
  }, { keepSeat: true });
  act('sneeze', 0.5, async (live) => {
    setPose({ eyes: 'blink', mouth: 'o', arms: 'forward' }); say('Ah… ah…', 1000); if (!await wait(1000, live)) return;
    setPose({ eyes: 'blink', mouth: 'open', arms: 'down' }); say('Achoo!', 1300); squash();
    for (const d of [-18, -10, 10, 18]) puff('dust', '', d, PH() * 0.4);
    await wait(900, live);
  });
  act('yawn', (c) => (c.bored ? 3 : 0.4), async (live) => {
    setPose({ arms: 'up', eyes: 'blink', mouth: 'open' }); say(pick(['Haaah…', 'So quiet.']), 1600); puff('z', 'z', 12, 0);
    if (!await wait(1500, live)) return;
    setPose({ eyes: 'blink', mouth: 'smile' }); await wait(500, live);
  }, { keepSeat: true });
  act('doze', (c) => (c.bored ? 2 : 0), async (live) => {
    for (let i = 0; i < 3; i++) { setPose({ eyes: 'sleep' }); puff('z', i % 2 ? 'Z' : 'z', 10, 0); if (!await wait(800, live)) return; }
    setPose({ eyes: 'wide', mouth: 'o' }); puff('mark', '!', 4, -6); say(pick(['Zz— huh?', 'Not sleeping!']), 1300);
    await bounce(10, 300); await wait(500, live);
  }, { sit: true, keepSeat: true });
  act('stomp', 1.4, async (live) => {
    const t = onSurface(); if (!t) return;
    for (let i = 0; i < 2; i++) { setPose({ legs: 'tuck', mouth: 'o' }); await bounce(12, 280); if (!live()) return; squash(); boing(t); if (!await wait(200, live)) return; }
    if (Math.random() < 0.5) say(pick(['Sturdy.', 'Solid.', 'Good spot.']), 1200);
  }, { need: (c) => !!c.node });
  act('swing', 4.5, async (live) => {   // sitting: legs dangle and swing
    const n = 7 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) {
      setPose({ legs: i % 2 ? 'step' : 'stand', eyes: i % 5 === 4 ? 'blink' : 'open', mouth: 'smile' });
      if (i % 3 === 1) puff(i % 2 ? 'note p' : 'note', i % 2 ? '♪' : '♫', 8 + Math.random() * 12, 4);
      if (i === 4 && Math.random() < 0.6) me.dir *= -1;
      if (!await wait(320, live)) return;
    }
  }, { sit: true, keepSeat: true });
  // walk a few steps along whatever she is standing on
  function stroll() {
    const s = me.on; if (!s || !s.node.isConnected) return false;
    const room = s.node.getBoundingClientRect().width - PW() - 12; if (room < 70) return false;
    let ox = 6; for (let i = 0; i < 6; i++) { ox = 6 + Math.random() * room; if (Math.abs(ox - me.ox) > 50) break; }
    walkTo(s, ox, { quiet: true }); return true;
  }
  act('stroll', 3.5, async () => { stroll(); }, { need: (c) => c.room > 70 });

  // ---------- helpers for the bigger acts ----------
  const D = () => (me.dir < 0 ? -1 : 1);
  const faceAt = () => { const f = feetAt(); return { x: f.x, y: f.y - PH() + 8 * S() + (me.seated ? 4 * S() : 0) }; };
  const handAt = (arms = 'up') => {
    const [hx, hy] = HANDS[arms] || HANDS.forward, f = feetAt(), s = S();
    return { x: f.x - PW() / 2 + (D() < 0 ? W - 1 - hx : hx) * s + s / 2, y: f.y - PH() + hy * s + (me.seated ? 4 * s : 0) };
  };
  const facePtr = () => { if (ptr.x < 0) return; const f = feetAt(); if (Math.abs(ptr.x - f.x) > 30) me.dir = ptr.x > f.x ? 1 : -1; };
  // run fn(t, progress) every frame for ms; false when interrupted
  async function loopFx(ms, live, fn) {
    const t0 = performance.now();
    for (;;) {
      const t = performance.now() - t0;
      if (t >= ms) { fn(ms, 1); return live(); }
      if (!live()) return false;
      fn(t, t / ms); await sleep(16);
    }
  }
  // slide along whatever she is standing on (ox = pixels from the surface's left edge)
  async function glide(toOx, ms, live, { steps = false, face = true, ease = (p) => p } = {}) {
    const s = me.on; if (!s || !s.node.isConnected) return wait(ms, live);
    const hi = Math.max(6, s.node.getBoundingClientRect().width - PW() - 6), from = me.ox, to = clamp(toOx, 6, hi), t0 = performance.now();
    if (face && Math.abs(to - from) > 2) me.dir = to > from ? 1 : -1;
    for (;;) {
      const p = Math.min(1, (performance.now() - t0) / ms);
      me.ox = from + (to - from) * ease(p);
      if (steps) setPose({ ...me.pose, legs: Math.floor((performance.now() - t0) / 130) % 2 ? 'step' : 'stand' });
      if (p >= 1) return live();
      if (!live()) return false;
      await sleep(16);
    }
  }
  // which side of her surface has more room, and how much
  function sideRoom() {
    const s = me.on, w = s && s.node.isConnected ? s.node.getBoundingClientRect().width : 0, hi = Math.max(6, w - PW() - 6), r = hi - me.ox, l = me.ox - 6;
    return r >= l ? { dir: 1, room: r } : { dir: -1, room: l };
  }
  const wobble = (live, deg, n, ms) => {
    const f = [{ transform: 'rotate(0deg)' }];
    for (let i = 0; i < n; i++) f.push({ transform: `rotate(${(i % 2 ? -1 : 1) * deg * D() * (1 - i / (n + 1))}deg)` });
    f.push({ transform: 'rotate(0deg)' }); return playBody(f, ms, live);
  };
  const jitter = (live, px, n, ms) => {
    const f = [{ transform: 'translateX(0)' }];
    for (let i = 0; i < n; i++) f.push({ transform: `translateX(${i % 2 ? -px : px}px)` });
    f.push({ transform: 'translateX(0)' }); return playBody(f, ms, live, { easing: 'linear' });
  };
  const pulse = (live, sx, sy, ms) => playBody([{ transform: 'scale(1,1)' }, { transform: `scale(${sx},${sy})` }, { transform: 'scale(1,1)' }], ms, live);
  const tilt = (live, deg, ms, hold = 0.4) => playBody([{ transform: 'rotate(0deg)' }, { transform: `rotate(${deg * D()}deg)`, offset: (1 - hold) / 2 }, { transform: `rotate(${deg * D()}deg)`, offset: 1 - (1 - hold) / 2 }, { transform: 'rotate(0deg)' }], ms, live);
  // the bubble sits higher when she is bigger
  function bubbleAt(px) { sayEl.style.bottom = px + 'px'; onEnd(() => { sayEl.style.bottom = ''; }); }
  const sparkleAt = (x, y, n = 5, r = 30, kind = 'twinkle') => { for (let i = 0; i < n; i++) flyer(kind, x + rnd(-r, r), y + rnd(-r, r * 0.4), 0, rnd(-26, -8), { ms: rnd(600, 900), o: { s: 2 + ((Math.random() * 2) | 0) } }); };

  // ---------- feelings ----------
  act('wink', 1.6, async (live) => {
    facePtr(); setPose({ eyes: 'wink', mouth: 'grin', glint: true });
    const f = faceAt(); flyer('twinkle', f.x + D() * 20, f.y - 4, D() * 6, -16, { ms: 800, o: { s: 3 } });
    say(pick(['Psst.', 'Between us.', 'Wink.']), 1500);
    if (!await wait(950, live)) return; setPose({ eyes: 'happy' }); await wait(350, live);
  }, { keepSeat: true });
  act('laugh', 1.4, async (live) => {
    setPose({ eyes: 'happy', mouth: 'laugh', arms: 'hips' }); say(pick(['Ha ha ha!', 'Hehehe!', 'LOL.']), 1700); bounce(8, 240);
    await wobble(live, 7, 8, 1200);
    if (live()) { setPose({ eyes: 'happy', mouth: 'smile' }); await wait(300, live); }
  }, { keepSeat: true });
  act('cry', 0.8, async (live) => {
    setPose({ eyes: 'cry', mouth: 'frown' }); say(pick(['Sniff…', 'Wrong card…', 'Out of gold.']), 1900);
    for (let i = 0; i < 5; i++) {
      const f = faceAt(); burst(f.x + (i % 2 ? -9 : 9), f.y + 10, { n: 2, colors: ['#6CCBFF'], size: 4, speed: 30, g: 520, life: 650, dir: i % 2 ? 150 : 30, spread: 30 });
      if (i % 2) jitter(live, 1.2, 6, 360); if (!await wait(380, live)) return;
    }
    setPose({ eyes: 'blink', arms: 'cover', mouth: 'frown' }); if (!await wait(700, live)) return;
    setPose({ eyes: 'open', mouth: 'smile' }); say('Okay. Okay.', 1200); await wait(700, live);
  }, { keepSeat: true });
  act('angry', 0.9, async (live) => {
    setPose({ eyes: 'angry', mouth: 'frown', arms: 'hips' });
    const h = headAt(); flyer('anger', h.x + D() * 20, h.y + 2, 0, -22, { ms: 1000, o: { s: 3 } });
    say(pick(['Grr!', 'Hmph.', 'Who touched my card?']), 1700);
    for (let i = 0; i < 3; i++) { await bounce(7, 200); if (!live()) return; squash(); }
    await jitter(live, 1.5, 12, 600);
  });
  act('shy', 1, async (live) => {
    me.dir *= -1; setPose({ eyes: 'happy', mouth: 'smile', arms: 'cover', acc: ['blush'] }); say('Hehe…', 1200);
    if (!await wait(1000, live)) return;
    setPose({ eyes: 'open', mouth: 'smile', arms: 'down', acc: ['blush'] }); me.dir *= -1; if (!await wait(700, live)) return;
    setPose({ eyes: 'blink', mouth: 'smile', arms: 'cover', acc: ['blush'] }); await wait(800, live);
  }, { keepSeat: true });
  act('nervous', 0.9, async (live) => {
    setPose({ eyes: 'wide', mouth: 'frown', acc: ['sweat'] }); say(pick(['Uh… the budget?', 'Is that… gold?', 'I\'m fine.']), 1800);
    await jitter(live, 1.6, 16, 1000); if (!live()) return;
    setPose({ eyes: 'open', mouth: 'o', acc: ['sweat'] }); await wait(600, live);
  }, { keepSeat: true });
  act('starstruck', 1, async (live) => {
    setPose({ eyes: 'star', mouth: 'open', arms: 'up' }); say(pick(['Wow…', 'So shiny!', 'Ooooh.']), 1700);
    for (let i = 0; i < 7; i++) { const f = faceAt(); flyer('twinkle', f.x + rnd(-34, 34), f.y + rnd(-34, 10), 0, rnd(-18, -4), { ms: 700, o: { s: 2 + (i % 2) } }); if (!await wait(170, live)) return; }
    await wait(300, live);
  });
  act('love', 1, async (live) => {
    setPose({ eyes: 'love', mouth: 'smile', arms: 'forward', key: false });
    const h = inHand('heart', 'forward'); if (h.animate) h.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 520, iterations: 4 });
    say(pick(['♥ hard caps', 'I love this site.', 'Aww.']), 1900);
    for (let i = 0; i < 4; i++) { const f = faceAt(); flyer('heart', f.x + rnd(-24, 24), f.y - 10, rnd(-10, 10), rnd(-50, -30), { ms: 1100, o: { s: 2 } }); if (!await wait(480, live)) return; }
  }, { keepSeat: true });
  act('shiver', 0.7, async (live) => {
    setPose({ eyes: 'blink', mouth: 'frown', arms: 'clap' }); say(pick(['Brrr.', 'Draft in here.', 'C-c-cold.']), 1500);
    await jitter(live, 1.8, 24, 1500); if (live()) { setPose({ eyes: 'open', mouth: 'smile' }); await wait(300, live); }
  }, { keepSeat: true });
  act('shrug', 1, async (live) => {
    setPose({ eyes: 'open', mouth: 'frown', arms: 'shrug' }); say(pick(['Who knows?', '¯\\_(ツ)_/¯', 'Beats me.']), 1700);
    await tilt(live, 8, 900); if (live()) { me.dir *= -1; await wait(500, live); }
  }, { keepSeat: true });
  act('facepalm', 0.8, async (live) => {
    setPose({ eyes: 'blink', mouth: 'frown', arms: 'cover', acc: ['sweat'] }); say(pick(['Oh no.', 'Why.', 'Seriously?']), 1500);
    await tilt(live, 7, 1300, 0.7);
  }, { keepSeat: true });
  act('clap', 1.2, async (live) => {
    say(pick(['Bravo!', 'Nice flip!', 'Well played.']), 1700);
    for (let i = 0; i < 8; i++) {
      setPose({ eyes: 'happy', mouth: 'open', arms: i % 2 ? 'out' : 'clap' });
      if (i % 2 === 0) puff(i % 4 ? 'note p' : 'note', '♪', rnd(-20, 20), 0);
      if (!await wait(170, live)) return;
    }
    const h = headAt(); burst(h.x, h.y, { n: 10, size: 5, speed: 120, life: 900, spread: 120 });
  }, { keepSeat: true });
  act('bow', 0.9, async (live) => {
    setPose({ eyes: 'happy', mouth: 'smile', arms: 'down' });
    await playBody([{ transform: 'rotate(0deg)' }, { transform: `rotate(${34 * D()}deg) translateY(3px)`, offset: 0.3 }, { transform: `rotate(${34 * D()}deg) translateY(3px)`, offset: 0.7 }, { transform: 'rotate(0deg)' }], 1500, live);
    if (live()) { say(pick(['Thank you.', 'Much obliged.']), 1300); await wait(900, live); }
  }, { keepSeat: true });
  act('hiccup', 0.8, async (live) => {
    for (let i = 0; i < 4; i++) {
      setPose({ eyes: 'wide', mouth: 'o' }); say('hic!', 500); bounce(9, 220); puff('mark', '!', 4, -6);
      if (!await wait(i === 3 ? 400 : 640, live)) return; setPose({ eyes: 'open', mouth: 'smile' }); if (!await wait(260, live)) return;
    }
    say('Excuse me.', 1300); await wait(900, live);
  });
  act('dizzy', 0.7, async (live) => {
    setPose({ eyes: 'dizzy', mouth: 'o' }); orbit('spark', 3, 17, 1100); say('Whoa… @_@', 1800);
    await wobble(live, 12, 8, 1800); if (live()) { squash(); await wait(400, live); }
  }, { keepSeat: true });
  act('flex', 1, async (live) => {
    say(pick(['Strong.', 'Gains.', 'Hard caps. Harder me.']), 1800);
    for (let i = 0; i < 4; i++) {
      setPose({ eyes: 'open', mouth: 'grin', arms: i % 2 ? 'up' : 'out' }); pulse(live, 1.1, 1.1, 360);
      const h = handAt(i % 2 ? 'up' : 'out'); sparkleAt(h.x, h.y, 2, 8);
      if (!await wait(430, live)) return;
    }
  }, { keepSeat: true });

  // ---------- moves: flips, rolls, runs, size changes ----------
  const CENTER = '50% 50%';
  act('cartwheel', 1.3, async (live) => {
    const { dir, room } = sideRoom(), dist = Math.min(170, room); me.dir = dir;
    setPose({ arms: 'up', legs: 'wide', eyes: 'happy', mouth: 'open' }); say('Hup!', 700);
    await Promise.all([
      glide(me.ox + dir * dist, 1200, live, { face: false }),
      playBody([{ transform: 'rotate(0deg)', transformOrigin: CENTER }, { transform: `rotate(${720 * dir}deg)`, transformOrigin: CENTER }], 1200, live, { easing: 'linear' }),
    ]);
    if (live()) { squash(); setPose({ arms: 'up', eyes: 'happy', mouth: 'open' }); say('Ta-da!', 1100); await wait(600, live); }
  }, { need: (c) => c.room > 120 });
  act('backflip', 1.3, async (live) => {
    setPose({ legs: 'tuck', arms: 'up', eyes: 'wide', mouth: 'o' }); await wait(220, live);
    await Promise.all([bounce(52, 820), playBody([{ transform: 'rotate(0deg)', transformOrigin: '50% 55%' }, { transform: `rotate(${-360 * D()}deg)`, transformOrigin: '50% 55%' }], 820, live, { easing: 'ease-in-out' })]);
    if (live()) { squash(); setPose({ arms: 'up', eyes: 'happy', mouth: 'open', glint: true }); say(pick(['Nailed it!', 'Stuck the landing.', 'Ten out of ten.']), 1500); await wait(800, live); }
  });
  act('headstand', 0.9, async (live) => {
    setPose({ arms: 'up', eyes: 'wide', mouth: 'o' }); say('Look, no hands…', 1400);
    const o = { transformOrigin: CENTER }, r = (d) => ({ transform: `rotate(${d * D()}deg)`, ...o });
    const flip = playBody([{ ...r(0) }, { ...r(180), offset: 0.15 }, { ...r(180), offset: 0.8 }, { ...r(360) }], 3100, live, { easing: 'ease-in-out' });
    await wait(700, live);
    for (let i = 0; i < 7; i++) { setPose({ arms: 'down', legs: i % 2 ? 'wide' : 'stand', eyes: 'happy', mouth: 'o' }); if (!await wait(260, live)) return; }
    await flip; if (live()) { squash(); setPose({ eyes: 'dizzy', mouth: 'o' }); await wait(600, live); }
  });
  act('roll', 1, async (live) => {
    const { dir, room } = sideRoom(), dist = Math.min(150, room); me.dir = dir; setPose({ legs: 'tuck', arms: 'down', eyes: 'blink', mouth: 'o' });
    await Promise.all([
      glide(me.ox + dir * dist, 1000, live, { face: false }),
      playBody([{ transform: `translateY(${PH() * 0.16}px) rotate(0deg) scale(.7)`, transformOrigin: CENTER }, { transform: `translateY(${PH() * 0.16}px) rotate(${900 * dir}deg) scale(.7)`, transformOrigin: CENTER }], 1000, live, { easing: 'linear' }),
    ]);
    if (live()) { squash(); setPose({ eyes: 'dizzy', mouth: 'o' }); say('Dizzy…', 1000); await wait(700, live); }
  }, { need: (c) => c.room > 110 });
  act('moonwalk', 1, async (live) => {
    const { dir, room } = sideRoom(), dist = Math.min(150, room); me.dir = -dir;
    setPose({ arms: 'hips', eyes: 'open', mouth: 'grin' }); say(pick(['Smooth.', 'Hee-hee!']), 1500);
    for (let i = 0; i < 5; i++) puff('note', '♫', rnd(-18, 18), 0);
    await glide(me.ox + dir * dist, 1800, live, { steps: true, face: false });
    if (live()) { setPose({ arms: 'out', eyes: 'happy', mouth: 'open' }); await wait(500, live); }
  }, { need: (c) => c.room > 110 });
  act('sprint', 1.1, async (live) => {
    const { dir, room } = sideRoom(), dist = Math.min(240, room); me.dir = dir; setPose({ arms: 'forward', eyes: 'wide', mouth: 'open' });
    const leaning = playBody([{ transform: 'rotate(0deg)' }, { transform: `rotate(${12 * dir}deg)`, offset: 0.15 }, { transform: `rotate(${12 * dir}deg)`, offset: 0.85 }, { transform: 'rotate(0deg)' }], 700, live);
    let nextDust = 0;
    await Promise.all([glide(me.ox + dir * dist, 700, live, { steps: true, face: false, ease: (p) => p * p * (3 - 2 * p) }), leaning, loopFx(700, live, (t) => { if (t > nextDust) { nextDust = t + 70; puff('dust', '', -dir * 12, PH() - 4); } })]);
    if (live()) { squash(); say('Zoom!', 1000); await wait(600, live); }
  }, { need: (c) => c.room > 140 });
  act('sneak', 1, async (live) => {
    const { dir, room } = sideRoom(), dist = Math.min(130, room); me.dir = dir; setPose({ arms: 'down', eyes: 'wide', mouth: 'o' }); say('Shh…', 1100);
    const crouch = playBody([{ transform: 'scale(1,1)' }, { transform: 'scale(1.05,.86)', offset: 0.1 }, { transform: 'scale(1.05,.86)', offset: 0.92 }, { transform: 'scale(1,1)' }], 3200, live);
    const walk = (async () => {
      await glide(me.ox + dir * dist * 0.5, 1300, live, { steps: true, face: false }); if (!live()) return false;
      me.dir = -dir; setPose({ ...me.pose, eyes: 'wide', mouth: 'o' }); if (!await wait(600, live)) return false; me.dir = dir;
      return glide(me.ox + dir * dist * 0.5, 1300, live, { steps: true, face: false });
    })();
    await Promise.all([crouch, walk]);
  }, { need: (c) => c.room > 110 });
  act('jumpjacks', 1, async (live) => {
    say(pick(['One, two…', 'Cardio!', 'Burn.']), 1200);
    for (let i = 0; i < 8; i++) {
      const out = i % 2 === 0; setPose({ arms: out ? 'up' : 'down', legs: out ? 'wide' : 'stand', eyes: 'happy', mouth: out ? 'open' : 'smile' });
      if (out) bounce(10, 240); else squash();
      if (!await wait(290, live)) return;
    }
    setPose({ eyes: 'open', mouth: 'o', acc: ['sweat'] }); say('Phew.', 1100); await wait(800, live);
  });
  act('wishStar', (c) => (c.hour >= 18 || c.hour < 6 ? 2 : 0.9), async (live) => {
    const f = feetAt(); setPose({ arms: 'up', eyes: 'wide', mouth: 'o' }); say('Look, a star!', 1400);
    for (let i = 0; i < 5; i++) track(fxSprite('twinkle', f.x + rnd(-130, 130), f.y - PH() - rnd(40, 140), { s: 2 + (i % 2) })).animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 1600, delay: i * 220, fill: 'both' });
    const star = fxSprite('star', f.x - 150, f.y - PH() - 170, { s: 3 });
    play(star, [{ transform: 'translate(0,0) rotate(0deg)', opacity: 0 }, { transform: 'translate(40px,26px) rotate(90deg)', opacity: 1, offset: 0.2 }, { transform: 'translate(300px,110px) rotate(420deg)', opacity: 0 }], 1100, { easing: 'ease-in' });
    if (!await wait(1300, live)) return;
    setPose({ arms: 'clap', eyes: 'sleep', mouth: 'smile' }); say(pick(['Wish: more gold.', 'Wish: free tokens.', 'Wish: no rate limits.']), 2200); await wait(2000, live);
    const h = headAt(); sparkleAt(h.x, h.y, 5, 24, 'spark');
  }, { need: (c) => c.top > 170 });
  act('balance', 1, async (live) => {
    const { dir, room } = sideRoom(), dist = Math.min(150, room); me.dir = dir;
    setPose({ arms: 'out', eyes: 'wide', mouth: 'o' }); say('Tightrope…', 1200);
    const frames = [{ transform: 'rotate(0deg)' }]; for (let i = 0; i < 12; i++) frames.push({ transform: `rotate(${(i % 2 ? -1 : 1) * (i > 8 ? 17 : 6)}deg)` }); frames.push({ transform: 'rotate(0deg)' });
    await Promise.all([glide(me.ox + dir * dist, 3000, live, { steps: true, face: false }), playBody(frames, 3000, live, { easing: 'ease-in-out' })]);
    if (live()) { setPose({ arms: 'up', eyes: 'happy', mouth: 'open' }); say('Phew!', 1000); bounce(10, 300); await wait(600, live); }
  }, { need: (c) => c.room > 110 });
  act('ninja', 0.9, async (live) => {
    setPose({ arms: 'clap', eyes: 'angry', mouth: 'frown' }); say('…', 700); if (!await wait(700, live)) return;
    const smoke = (at) => burst(at.x, at.y, { n: 14, colors: ['#C9CFDC', '#8A93A8', '#FFFFFF'], size: 7, speed: 70, g: -30, life: 700, spread: 360 });
    smoke(midAt()); el.style.opacity = '0'; onEnd(() => { el.style.opacity = ''; });
    const { dir, room } = sideRoom(); me.ox = clamp(me.ox + dir * Math.min(200, room) * rnd(0.6, 1), 6, 9999); me.dir = -dir; await sleep(60);
    if (!await wait(500, live)) return;
    smoke(midAt()); el.style.opacity = ''; setPose({ arms: 'out', eyes: 'angry', mouth: 'grin' }); say('Poof.', 1100); await wait(900, live);
  }, { need: (c) => c.room > 120 });
  act('giant', 0.8, async (live) => {
    bubbleAt(150); const node = onSurface();
    setPose({ arms: 'up', eyes: 'angry', mouth: 'open' });
    const grow = playBody([{ transform: 'scale(1)' }, { transform: 'scale(1.7)', offset: 0.2 }, { transform: 'scale(1.7)', offset: 0.82 }, { transform: 'scale(1)' }], 3000, live);
    await wait(600, live); say('RAWR!', 1500);
    for (let i = 0; i < 2; i++) { if (!live()) return; squash(); shake(node); const f = feetAt(); burst(f.x, f.y, { n: 8, colors: ['#C9CFDC', '#8A93A8'], size: 6, speed: 90, life: 700, spread: 140 }); if (!await wait(650, live)) return; }
    await grow;
  });
  act('tiny', 0.8, async (live) => {
    bubbleAt(50); setPose({ eyes: 'wide', mouth: 'o' });
    const small = playBody([{ transform: 'scale(1)' }, { transform: 'scale(.42)', offset: 0.15 }, { transform: 'scale(.42)', offset: 0.85 }, { transform: 'scale(1)' }], 3200, live);
    await wait(500, live); say('Squeak.', 1300);
    for (let i = 0; i < 3; i++) { setPose({ eyes: 'happy', mouth: 'open', arms: 'up' }); if (!await wait(420, live)) return; setPose({ eyes: 'open', mouth: 'smile' }); if (!await wait(380, live)) return; }
    await small;
  });
  act('jelly', 0.9, async (live) => {
    setPose({ eyes: 'happy', mouth: 'open' }); say('Boing-oing-oing.', 1500);
    await playBody([{ transform: 'scale(1,1)' }, { transform: 'scale(1.3,.7)' }, { transform: 'scale(.8,1.25)' }, { transform: 'scale(1.18,.84)' }, { transform: 'scale(.9,1.12)' }, { transform: 'scale(1.08,.94)' }, { transform: 'scale(1,1)' }], 1500, live);
  }, { keepSeat: true });
  act('pirouette', 1, async (live) => {
    setPose({ arms: 'up', eyes: 'happy', mouth: 'open' });
    const f = []; for (let i = 0; i < 4; i++) f.push({ transform: 'scaleX(1)' }, { transform: 'scaleX(.05)' }, { transform: 'scaleX(-1)' }, { transform: 'scaleX(.05)' }); f.push({ transform: 'scaleX(1)' });
    await Promise.all([bounce(22, 1100), playBody(f, 1100, live, { easing: 'linear' })]);
    if (live()) { squash(); say(pick(['Encore!', 'Ta-da!']), 1100); await wait(500, live); }
  });
  act('stretch', 1.2, async (live) => {
    setPose({ arms: 'up', eyes: 'blink', mouth: 'open' }); say('Aaaah.', 1500);
    await playBody([{ transform: 'scale(1,1) rotate(0deg)' }, { transform: 'scale(.94,1.12) rotate(0deg)', offset: 0.25 }, { transform: `scale(.94,1.1) rotate(${9 * D()}deg)`, offset: 0.5 }, { transform: `scale(.94,1.1) rotate(${-9 * D()}deg)`, offset: 0.75 }, { transform: 'scale(1,1) rotate(0deg)' }], 2200, live);
  }, { keepSeat: true });
  act('skip', 1.1, async (live) => {
    const { dir, room } = sideRoom(), dist = Math.min(140, room); me.dir = dir; say('♪', 900);
    for (let i = 0; i < 4; i++) {
      setPose({ legs: 'tuck', arms: i % 2 ? 'out' : 'up', eyes: 'happy', mouth: 'open' });
      await Promise.all([bounce(12, 320), glide(me.ox + dir * dist / 4, 320, live, { face: false })]); if (!live()) return;
      puff('note', '♪', rnd(-10, 10), 0); setPose({ legs: 'stand', arms: 'down', eyes: 'happy', mouth: 'smile' }); await wait(60, live);
    }
  }, { need: (c) => c.room > 100 });
  act('wiggle', 1.2, async (live) => {
    say(pick(['Wiggle wiggle.', 'Shake it.']), 1500);
    for (let i = 0; i < 6; i++) { setPose({ arms: 'hips', legs: i % 2 ? 'step' : 'wide', eyes: 'happy', mouth: 'grin' }); await tilt(live, i % 2 ? -11 : 11, 280, 0.2); if (!live()) return; }
  }, { keepSeat: true });
  act('airGuitar', 1, async (live) => {
    say(pick(['♫ Rock! ♫', 'Shred!']), 1500);
    for (let i = 0; i < 8; i++) {
      setPose({ arms: i % 2 ? 'forward' : 'waveL', legs: 'wide', eyes: 'blink', mouth: 'open' });
      puff(i % 2 ? 'note p' : 'note', i % 2 ? '♪' : '♫', rnd(-16, 16), 0);
      await playBody([{ transform: 'rotate(0deg)' }, { transform: `rotate(${-12 * D()}deg)` }, { transform: `rotate(${5 * D()}deg)` }, { transform: 'rotate(0deg)' }], 340, live); if (!live()) return;
    }
    setPose({ arms: 'up', legs: 'tuck', eyes: 'happy', mouth: 'open' }); await bounce(28, 500); const h = headAt(); sparkleAt(h.x, h.y, 6, 30, 'spark'); say('Yeah!', 1000); await wait(600, live);
  });
  act('robot', 0.9, async (live) => {
    say('BEEP. BOOP.', 1700);
    const L = [['out', 1], ['up', 1], ['out', -1], ['down', -1], ['forward', 1], ['shrug', -1], ['down', 1]];
    for (const [arms, d] of L) { me.dir = d; setPose({ arms, eyes: 'wide', mouth: 'o' }); if (!await wait(330, live)) return; }
    setPose({ arms: 'hips', eyes: 'open', mouth: 'grin' }); say('Does not compute.', 1400); await wait(900, live);
  });

  // ---------- props: things she pulls out and uses ----------
  // a parabola from (0,0) to (dx,dy) that bulges `peak` px upward, as keyframes
  function arcFrames(dx, dy, peak, spin = 0, extra = '', n = 12) {
    const f = [];
    for (let i = 0; i <= n; i++) { const p = i / n; f.push({ transform: `translate(${dx * p}px, ${dy * p - 4 * peak * p * (1 - p)}px) rotate(${spin * p}deg) ${extra}` }); }
    return f;
  }
  const centerAt = (n, x, y) => { n.style.left = (x - n._w / 2) + 'px'; n.style.top = (y - n._h / 2) + 'px'; };
  const mirror = (n) => { if (D() < 0) n.style.scale = '-1 1'; return n; };           // sprites that point one way
  const elHand = (arms) => { const [hx, hy] = HANDS[arms] || HANDS.forward, s = S(); return { x: (D() > 0 ? hx : W - 1 - hx) * s + s / 2, y: hy * s }; };
  const flashAt = (kind, x, y, s = 5) => play(fxSprite(kind, x, y, { s }), [{ opacity: 1, transform: 'scale(.4)' }, { opacity: 0.9, transform: 'scale(1)', offset: 0.4 }, { opacity: 0, transform: 'scale(1.5)' }], 450);
  const dropAt = (x, y0, y1, ms, color = '#6CCBFF', w = 2, h = 9) => {
    const d = document.createElement('i'); d.style.cssText = `left:${x}px;top:${y0}px;width:${w}px;height:${h}px;background:${color};`; fxLayer.appendChild(d);
    return play(d, [{ transform: 'translateY(0)' }, { transform: `translateY(${y1 - y0}px)` }], ms);
  };

  act('juggle', 1.8, async (live) => {
    setPose({ arms: 'out', key: false, eyes: 'open', mouth: 'smile' }); say('Watch this…', 1100); if (!await wait(300, live)) return;
    const s = S(), ns = ['key', 'card', 'coin'].map((k) => put(sprite(k, { s: 2 }), 0, 0)), A = 7 * s, B = 32, base = 13 * s;
    const ok = await loopFx(3800, live, (t) => ns.forEach((n, i) => {
      const ph = t / 330 + i * 2.094;
      n.style.left = (PW() / 2 + Math.cos(ph) * A - n._w / 2) + 'px'; n.style.top = (base - Math.abs(Math.sin(ph)) * B - n._h) + 'px'; n.style.transform = `rotate(${t * 0.45 + i * 90}deg)`;
    }));
    if (!ok) return; ns.forEach((n) => n.remove());
    setPose({ arms: 'up', eyes: 'happy', mouth: 'open', glint: true }); say(pick(['Ta-da!', 'Did you see that?!']), 1400); await bounce(14, 340); await wait(500, live);
  });
  act('balloon', 1.4, async (live) => {
    setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'smile' });
    const b = inHand('balloon', 'up'); b.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }], { duration: 700, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
    say(pick(['Look what I found!', 'Party balloon.']), 1700);
    if (!await wait(2400, live)) return;
    const r = b.getBoundingClientRect(); b.remove();
    setPose({ arms: 'waveL', eyes: 'wide', mouth: 'o' });
    play(fxSprite('balloon', r.left + r.width / 2, r.top + r.height / 2), [{ transform: 'translate(0,0)' }, { transform: 'translate(14px,-150px)', offset: 0.4 }, { transform: 'translate(-10px,-320px)', offset: 0.8 }, { transform: 'translate(8px,-460px)', opacity: 0 }], 2600);
    say('Bye-bye!', 1500); await wait(2000, live);
  });
  act('umbrella', 1.2, async (live) => {
    say(pick(['Looks like rain.', 'Cloud incoming…']), 1500); setPose({ arms: 'up', key: false, eyes: 'open', mouth: 'o' });
    const u = inHand('umbrella', 'up'), hp = elHand('up'), cloud = put(sprite('cloud', { s: 5 }), hp.x - 28, -92);
    cloud.animate([{ transform: `translateX(${-150 * D()}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 800, easing: 'ease-out' });
    if (!await wait(900, live)) return; setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'smile' }); say('Not a drop.', 1500);
    let nextDrop = 0;
    const ok = await loopFx(3200, live, (t) => {
      if (t < nextDrop) return; nextDrop = t + 55;
      const f = feetAt(), cx = f.x - PW() / 2 + hp.x, topY = f.y - PH() - 60, canopyY = f.y - PH() - 18, x = cx + rnd(-30, 30);
      if (Math.abs(x - cx) < 20) dropAt(x, topY, canopyY, 260).finished.then(() => burst(x, canopyY, { n: 2, colors: ['#6CCBFF'], size: 3, speed: 50, g: 300, life: 280, dir: -90, spread: 110 }), () => {});
      else dropAt(x, topY, f.y, 520);
    });
    if (!ok) return;
    cloud.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${150 * D()}px)`, opacity: 0 }], { duration: 900, fill: 'forwards' });
    setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'open' }); say('Sun\'s back.', 1300); await wait(1100, live);
  }, { need: (c) => c.top > 130 });
  act('paperPlane', 1.4, async (live) => {
    setPose({ arms: 'forward', key: false, eyes: 'open', mouth: 'o' }); const pl = inHand('plane', 'forward'); say('Folding…', 900);
    if (!await wait(1100, live)) return;
    const f = feetAt(); let dist = D() * 380;
    if (sees() && Math.abs(ptr.x - f.x) > 160) dist = clamp(ptr.x - f.x, -560, 560);
    me.dir = dist >= 0 ? 1 : -1; pl.remove(); setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'open' });
    const h = handAt('up'), n = fxSprite('plane', h.x, h.y - 8, { s: 4 }), sx = dist >= 0 ? 1 : -1;
    const fr = arcFrames(dist, 70, 90, 0, `scaleX(${sx})`, 14); fr.forEach((k, i) => { k.opacity = i > 12 ? 0 : 1; });
    play(n, fr, 2300, { easing: 'ease-in-out' }); say('Whoosh!', 1100); await wait(2300, live);
  });
  act('butterfly', 1.2, async (live) => {
    setPose({ eyes: 'wide', mouth: 'o' }); const f0 = faceAt();
    const n = track(fxSprite('flutA', f0.x + 90 * D(), f0.y - 60, { s: 3 })); flip2(n, 'flutA', 'flutB', 150); say('Ooh, a butterfly!', 1600);
    const ok = await loopFx(4200, live, (t) => {
      const f = faceAt(), a = t / 620, x = f.x + Math.cos(a) * 62, y = f.y - 20 + Math.sin(a * 1.7) * 34 - Math.abs(Math.sin(a * 3)) * 10;
      centerAt(n, x, y); me.dir = x > f.x ? 1 : -1;
    });
    if (!ok) return;
    setPose({ arms: 'up', eyes: 'happy', mouth: 'o' }); clearInterval(n._iv); reskin(n, 'flutB');
    const h = handAt('up'); n.style.transition = 'left .5s, top .5s'; centerAt(n, h.x, h.y - 10);
    say('Shhh…', 1300); if (!await wait(1900, live)) return;
    flip2(n, 'flutA', 'flutB', 110); n.style.transition = 'left 1.3s ease-in, top 1.3s ease-in, opacity 1.3s'; centerAt(n, h.x + 80, h.y - 150); n.style.opacity = '0';
    setPose({ arms: 'waveR', eyes: 'happy', mouth: 'open' }); await wait(1300, live);
  }, { need: (c) => c.top > 100 });
  act('bubbles', 1.2, async (live) => {
    setPose({ eyes: 'happy', mouth: 'o' }); say('Blub blub.', 1200);
    for (let i = 0; i < 7; i++) {
      const f = faceAt(), n = fxSprite('bubble', f.x + D() * 14, f.y + 8, { s: pick([2, 3, 3, 4]) }), dx = D() * rnd(30, 110), dy = -rnd(90, 180);
      play(n, [{ transform: 'translate(0,0) scale(.3)', opacity: 0 }, { transform: `translate(${dx * 0.3}px,${dy * 0.3}px) scale(1)`, opacity: 0.9, offset: 0.15 }, { transform: `translate(${dx * 0.7}px,${dy * 0.75}px) scale(1.05)`, opacity: 0.9, offset: 0.85 }, { transform: `translate(${dx}px,${dy}px) scale(1.3)`, opacity: 0 }], rnd(1600, 2400), { easing: 'ease-out' });
      setPose({ eyes: 'happy', mouth: i % 2 ? 'o' : 'smile' }); if (!await wait(420, live)) return;
    }
    await wait(900, live);
  }, { need: (c) => c.top > 100 });
  act('fishing', (c) => (c.seated ? 3 : 1), async (live) => {
    const s = S(), L = 62, ang = D() > 0 ? -42 : -138, rad = ang * Math.PI / 180, hand = elHand('forward');
    setPose({ arms: 'forward', key: false, eyes: 'open', mouth: 'smile' });
    const mk = (css) => { const n = track(document.createElement('i')); n.style.cssText = 'position:absolute;pointer-events:none;z-index:2;' + css; el.appendChild(n); return n; };
    const rod = mk(`left:${hand.x}px;top:${hand.y - 1}px;width:${L}px;height:3px;background:#8B5A3C;transform-origin:0 50%;transform:rotate(${ang}deg);`);
    const tipX = hand.x + Math.cos(rad) * L, tipY = hand.y + Math.sin(rad) * L;
    const line = mk(`left:${tipX}px;top:${tipY}px;width:1px;height:0;background:#0B0D12;`);
    const bob = mk('width:7px;height:7px;margin-left:-3px;background:linear-gradient(#FF4D6D 50%,#fff 50%);box-shadow:0 0 0 1px #0B0D12;');
    const setLine = (len) => { line.style.height = len + 'px'; bob.style.left = tipX + 'px'; bob.style.top = (tipY + len - 2) + 'px'; };
    setLine(0); say('Fishing…', 1300);
    if (!await loopFx(500, live, (t, p) => setLine(70 * p))) return;
    if (!await loopFx(2200, live, (t) => setLine(70 + Math.sin(t / 220) * 2))) return;
    setPose({ arms: 'forward', key: false, eyes: 'wide', mouth: 'o' }); puff('mark', '!', 4, -6);
    if (!await loopFx(650, live, (t) => setLine(70 + Math.abs(Math.sin(t / 90)) * 12))) return;
    const gold = Math.random() < 0.3, tgt = elHand('up');
    const fish = put(sprite(gold ? 'coin' : 'fish', { s: 3, tint: !gold && Math.random() < 0.5 ? { b: 'O' } : null }), tipX - 18, tipY + 70 - 10);
    line.remove(); bob.remove(); tilt(live, -12, 500);
    fish.animate(arcFrames(tgt.x - tipX, tgt.y - 6 - (tipY + 70), 60, D() * 360), { duration: 750, fill: 'forwards', easing: 'ease-in-out' });
    if (!await wait(780, live)) return;
    fish.remove(); rod.remove(); setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'grin', glint: gold }); inHand(gold ? 'coin' : 'fish', 'up');
    say(gold ? 'Gold!' : pick(['Dinner!', 'Catch of the day!', 'It\'s a big one!']), 1900, gold ? 'gold' : ''); await bounce(12, 340);
    if (gold) { const h = handAt('up'); sparkleAt(h.x, h.y, 5, 22, 'spark'); } await wait(1700, live);
  }, { keepSeat: true });
  act('magnifier', 1.1, async (live) => {
    setPose({ arms: 'forward', key: false, eyes: 'wide', mouth: 'o' });
    const g = atFace('glass', { dx: -2, dy: 2 }); g.animate([{ transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }], { duration: 700, direction: 'alternate', iterations: 6, easing: 'ease-in-out' });
    say('Hmm…', 1200); puff('mark', '?', 4, -6);
    for (let i = 0; i < 4; i++) { me.dir *= -1; if (!await wait(700, live)) return; }
    puff('mark', '!', 4, -6); say(pick(['A clue!', 'Found something.', 'Interesting…']), 1500); shine(onSurface()); const m = midAt(); sparkleAt(m.x, m.y - 20, 4, 26); await wait(1300, live);
  }, { keepSeat: true });
  act('binoculars', 1, async (live) => {
    setPose({ arms: 'forward', key: false, eyes: 'wide', mouth: 'o' }); atFace('binos', { dy: 1 }); say('Scanning…', 1100);
    for (const d of [-1, 1, -1, 1]) { me.dir = d; if (!await wait(650, live)) return; }
    if (sees()) { facePtr(); say('Spotted you!', 1600); } else say('All clear.', 1300);
    await wait(1300, live);
  }, { keepSeat: true });
  act('coffee', 1.2, async (live) => {
    setPose({ arms: 'forward', key: false, eyes: 'open', mouth: 'smile' }); const m = inHand('mug', 'forward', { dy: 2 });
    say(new Date().getHours() < 12 ? 'Coffee first.' : 'Tea time.', 1500);
    for (let i = 0; i < 3; i++) { const h = handAt('forward'); flyer('snow', h.x + rnd(-4, 4), h.y - 14, rnd(-3, 3), -26, { ms: 900, o: { s: 2, tint: { w: 'x' } } }); if (!await wait(600, live)) return; }
    setPose({ arms: 'forward', key: false, eyes: 'happy', mouth: 'o' }); m.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${-D() * 10}px,-14px)` }, { transform: 'translate(0,0)' }], { duration: 900 });
    if (!await wait(900, live)) return;
    const hot = Math.random() < 0.3; setPose({ arms: 'forward', key: false, eyes: hot ? 'wide' : 'happy', mouth: hot ? 'tongue' : 'grin' });
    say(hot ? 'Hot!' : pick(['Aaah.', 'Perfect.']), 1300); if (hot) bounce(12, 300); await wait(1200, live);
  }, { keepSeat: true });
  act('book', (c) => (c.seated ? 3 : 1), async (live) => {
    const prev = me.acc; me.acc = [...prev, 'specs']; onEnd(() => { me.acc = prev; });
    setPose({ arms: 'forward', key: false, eyes: 'open', mouth: 'smile' });
    const b = put(sprite('book', { s: 3 }), PW() / 2 - 21, 12 * S()); say(pick(['Chapter 7: Hard Caps.', 'The Art of Face Value.', 'Keys for Beginners.']), 2000);
    for (let i = 0; i < 4; i++) { setPose({ arms: 'forward', key: false, eyes: i % 2 ? 'blink' : 'open', mouth: 'smile' }); if (!await wait(900, live)) return; b.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(.2)' }, { transform: 'scaleX(1)' }], { duration: 300 }); }
    setPose({ arms: 'forward', key: false, eyes: 'wide', mouth: 'o' }); say('Plot twist!', 1300); await wait(1200, live);
  }, { keepSeat: true });
  act('laptop', (c) => (c.seated ? 3 : 1), async (live) => {
    const lp = put(sprite('laptop', { s: 3 }), PW() / 2 - 21, 12 * S());
    setPose({ arms: 'forward', key: false, eyes: 'open', mouth: 'smile' }); say(pick(['npm run ship', 'git push', 'Works on my machine.']), 1800);
    for (let i = 0; i < 11; i++) {
      setPose({ arms: i % 2 ? 'forward' : 'down', key: false, eyes: i % 4 === 3 ? 'blink' : 'open', mouth: i % 3 === 0 ? 'o' : 'smile' });
      reskin(lp, 'laptop', { b: pick(['b', 't', 'P', 'l']) }); if (i % 3 === 0) bounce(3, 140);
      if (!await wait(260, live)) return;
    }
    lp.remove(); setPose({ arms: 'up', eyes: 'happy', mouth: 'open', glint: true }); say('Deployed.', 1500);
    const h = headAt(); burst(h.x, h.y, { n: 14, size: 5, speed: 150, life: 900, spread: 140 }); await bounce(16, 400); await wait(500, live);
  }, { keepSeat: true });
  act('camera', 1.1, async (live) => {
    setPose({ arms: 'forward', key: false, eyes: 'open', mouth: 'smile' }); const cam = atFace('camera', { dy: 2 }); say(pick(['Say cheese!', 'Smile!']), 1300);
    if (!await wait(1300, live)) return;
    const fl = document.createElement('div'); fl.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;'; fxLayer.appendChild(fl); play(fl, [{ opacity: 0 }, { opacity: 0.55 }, { opacity: 0 }], 280);
    const f = faceAt(); flashAt('twinkle', f.x, f.y + 6, 6);
    cam.remove(); setPose({ arms: 'forward', key: false, eyes: 'happy', mouth: 'grin' });
    const pol = inHand('pola', 'forward', { tint: { t: 'w', b: 'w' } }); pol.animate([{ transform: 'translateY(-14px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 400 });
    say('Developing…', 1500); if (!await wait(500, live)) return;
    pol.animate([{ transform: 'rotate(-14deg)' }, { transform: 'rotate(14deg)' }], { duration: 160, direction: 'alternate', iterations: 8 });
    if (!await wait(1400, live)) return; reskin(pol, 'pola', {}); say(pick(['Ooh, nice one.', 'Frame it.']), 1500); await wait(1400, live);
  }, { keepSeat: true });
  act('flag', 1, async (live) => {
    setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'open' }); const fl = mirror(inHand('flag', 'up', { dx: 11 })); fl.style.transformOrigin = D() > 0 ? '0 100%' : '100% 100%';
    fl.animate([{ transform: 'rotate(-5deg)' }, { transform: 'rotate(5deg)' }], { duration: 300, direction: 'alternate', iterations: 8 }); say('Conquered!', 1500);
    if (!await wait(2400, live)) return;
    fl.remove(); setPose({ arms: 'hips', eyes: 'happy', mouth: 'grin' });
    const g = mirror(sprite('flag')); put(g, D() > 0 ? PW() + 4 : -g._w - 4, PH() - g._h); g.animate([{ transform: 'translateY(-26px)' }, { transform: 'translateY(0)' }], { duration: 260, easing: 'ease-in' });
    setTimeout(() => { if (g.isConnected) squash(); }, 260); say('Claimed!', 1500, 'gold'); await wait(2400, live);
  });
  act('yoyo', 1, async (live) => {
    setPose({ arms: 'forward', key: false, eyes: 'open', mouth: 'smile' }); const hand = elHand('forward');
    const str = track(document.createElement('i')); str.style.cssText = `position:absolute;left:${hand.x}px;top:${hand.y}px;width:1px;height:0;background:#0B0D12;pointer-events:none;`; el.appendChild(str);
    const yo = put(sprite('yo', { s: 3 }), hand.x - 9, hand.y); say('Old school.', 1200);
    if (!await loopFx(4000, live, (t) => { const len = 6 + (0.5 - 0.5 * Math.cos(t / 260)) * 22; str.style.height = len + 'px'; yo.style.top = (hand.y + len - 2) + 'px'; })) return;
    setPose({ arms: 'up', eyes: 'happy', mouth: 'open' }); say('Still got it.', 1200); await wait(700, live);
  }, { keepSeat: true });
  act('magic', 1.1, async (live) => {
    setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'grin' }); const w = inHand('wand', 'up', { dx: 6 }); say('Abracadabra!', 1400);
    w.style.transformOrigin = '20% 90%'; w.animate([{ transform: 'rotate(-18deg)' }, { transform: 'rotate(18deg)' }], { duration: 260, direction: 'alternate', iterations: 6 });
    const tip = () => { const r = w.getBoundingClientRect(); return { x: r.right - 4, y: r.top + 4 }; };
    for (let i = 0; i < 7; i++) { const t = tip(); burst(t.x, t.y, { n: 4, colors: ['#F2B51C', '#FFE08A', '#FFFFFF', '#9A7BFF'], size: 4, speed: 80, g: 200, life: 600 }); if (!await wait(150, live)) return; }
    const t = tip(); burst(t.x, t.y - 10, { n: 24, colors: ['#F2B51C', '#FFE08A', '#FFFFFF', '#9A7BFF', '#FF7AC6'], speed: 180, life: 900 });
    w.remove(); const c = inHand('gold', 'up'); c.animate([{ transform: 'scale(.2)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 420 });
    setPose({ arms: 'up', key: false, eyes: 'wide', mouth: 'open', glint: true }); say('A gold card!', 1700, 'gold'); await bounce(14, 360); await wait(1300, live);
  });
  act('spell', 1.2, async (live) => {
    const here = onSurface(), near = surfaces().filter((s) => s.node !== here && Math.hypot(pageX(s.r) - me.x, pageY(s.r) - me.y) < 700);
    const target = near.length ? pick(near).node : here; if (!target) return;
    const tr = () => target.getBoundingClientRect(); me.dir = tr().left + tr().width / 2 > feetAt().x ? 1 : -1;
    setPose({ arms: 'forward', key: false, eyes: 'angry', mouth: 'grin' }); const w = inHand('wand', 'forward', { dx: 4 });
    say(pick(['Shine!', 'Sparklius!', 'Polish charm.']), 1400); w.animate([{ transform: 'rotate(-12deg)' }, { transform: 'rotate(12deg)' }], { duration: 200, direction: 'alternate', iterations: 6 });
    if (!await wait(900, live)) return;
    const r = w.getBoundingClientRect(), T = tr(), tx = T.left + T.width / 2, ty = T.top + T.height / 2;
    for (let i = 0; i < 5; i++) flyer('spark', r.right, r.top, tx - r.right + rnd(-14, 14), ty - r.top + rnd(-14, 14), { ms: 520, o: { s: 2 } });
    await wait(540, live); shine(target); boing(target); sparkleAt(tx, ty, 6, Math.min(40, T.width / 3));
    setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'open' }); await wait(900, live);
  }, { need: (c) => !!c.node });
  act('snowball', 1, async (live) => {
    setPose({ arms: 'up', key: false, eyes: 'angry', mouth: 'grin' }); const b = inHand('ball', 'up'); say(pick(['Snowball!', 'Incoming!']), 1000);
    if (!await wait(700, live)) return;
    const f = feetAt(); let tx, ty;
    if (sees() && Math.hypot(ptr.x - f.x, ptr.y - f.y) > 120) { tx = ptr.x; ty = ptr.y; } else { tx = clamp(f.x + D() * rnd(160, 260), 30, innerWidth - 30); ty = f.y - rnd(20, 140); }
    me.dir = tx >= f.x ? 1 : -1; const h = handAt('up'); b.remove(); setPose({ arms: 'down', eyes: 'happy', mouth: 'open' });
    const n = fxSprite('ball', h.x, h.y - 8, { s: 3 }); play(n, arcFrames(tx - h.x, ty - (h.y - 8), 70, 360), 760, { easing: 'ease-in' });
    if (!await wait(780, live)) return;
    burst(tx, ty, { n: 14, colors: ['#FFFFFF', '#C9CFDC', '#6CF0FF'], size: 6, speed: 130, g: 400, life: 700, spread: 200 });
    say(pick(['Got you!', 'Bullseye.', 'Splat!']), 1300); await bounce(10, 300); await wait(700, live);
  });
  act('fireworks', 0.9, async (live) => {
    const f = feetAt(), rx = clamp(f.x + D() * 54, 20, innerWidth - 20), top = Math.max(90, f.y - 270);
    setPose({ arms: 'forward', key: false, eyes: 'open', mouth: 'o' }); say('Lighting the fuse…', 1300);
    const rk = fxSprite('rocket', rx, f.y - 18, { s: 3 }); track(rk);
    for (let i = 0; i < 4; i++) { flyer('spark', rx, f.y - 40, rnd(-6, 6), -8, { ms: 300, o: { s: 2 } }); if (!await wait(260, live)) return; }
    setPose({ arms: 'cover', eyes: 'blink', mouth: 'o' }); me.dir = rx > f.x ? -1 : 1;
    const up = f.y - 18 - top; rk.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-up}px)` }], { duration: 800, fill: 'forwards', easing: 'cubic-bezier(.3,0,.9,.6)' });
    let nx = 0; await loopFx(800, live, (t, p) => { if (t < nx) return; nx = t + 45; const y = f.y - 18 - up * Math.pow(p, 1.6); flyer('spark', rx, y + 22, 0, 24, { ms: 420, o: { s: 1 } }); });
    if (!live()) return; rk.remove(); const by = top;
    const cols = [['#FF4D6D', '#FFD866', '#FFFFFF'], ['#6CF0FF', '#2340FF', '#FFFFFF'], ['#37C871', '#FFD866', '#9A7BFF']];
    burst(rx, by, { n: 34, colors: cols[0], size: 6, speed: 230, g: 260, life: 1500, spread: 360 }); say('Boom!', 900);
    if (!await wait(380, live)) return; burst(rx - 60, by + 36, { n: 26, colors: cols[1], size: 6, speed: 190, g: 260, life: 1400, spread: 360 });
    if (!await wait(320, live)) return; burst(rx + 56, by + 22, { n: 26, colors: cols[2], size: 6, speed: 190, g: 260, life: 1400, spread: 360 });
    setPose({ arms: 'up', eyes: 'happy', mouth: 'open' }); me.dir = rx > f.x ? 1 : -1; say('Ooooh!', 1400); await bounce(16, 400); await wait(1200, live);
  }, { need: (c) => c.top > 230 });
  act('confetti', 1.2, async (live) => {
    setPose({ arms: 'up', key: false, eyes: 'wide', mouth: 'o' }); say('Pull the string…', 1200);
    if (!await wait(1200, live)) return;
    const h = handAt('up'); squash(); setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'open' }); say('Congrats!', 1500, 'gold');
    burst(h.x, h.y, { n: 46, size: 6, speed: 340, g: 560, life: 1900, spread: 70, dir: -90 }); burst(h.x, h.y, { n: 20, size: 5, speed: 220, g: 480, life: 1700, spread: 160, dir: -90 });
    await bounce(18, 420); await wait(1100, live);
  }, { need: (c) => c.top > 120 });
  act('dig', 1, async (live) => {
    setPose({ arms: 'forward', key: false, eyes: 'open', mouth: 'o' }); const sh = inHand('shovel', 'forward', { dy: 24 }); say('Dig dig dig.', 1400);
    const dust = () => { const f = feetAt(); burst(f.x + D() * 26, f.y - 2, { n: 6, colors: ['#8B5A3C', '#C98B5E', '#6B4530'], size: 5, speed: 90, g: 500, life: 600, spread: 80 }); };
    for (let i = 0; i < 3; i++) { sh.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-10px)' }, { transform: 'translateY(4px)' }, { transform: 'translateY(0)' }], { duration: 640 }); if (!await wait(420, live)) return; dust(); if (!await wait(220, live)) return; }
    const tgt = elHand('up'), sx = (D() > 0 ? PW() + 4 : -22), coin = put(sprite('coin', { s: 3 }), sx, PH() - 24);
    setPose({ arms: 'up', key: false, eyes: 'wide', mouth: 'open' }); sh.remove();
    coin.animate(arcFrames(tgt.x - (sx + 12), tgt.y - 6 - (PH() - 12), 70, D() * 360), { duration: 720, fill: 'forwards', easing: 'ease-in-out' });
    if (!await wait(750, live)) return;
    coin.remove(); setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'grin', glint: true }); inHand('coin', 'up'); say('Treasure!', 1700, 'gold');
    const h = handAt('up'); sparkleAt(h.x, h.y, 6, 24, 'spark'); await bounce(14, 360); await wait(1300, live);
  });
  act('kite', 1, async (live) => {
    const hp = elHand('up'); setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'smile' });
    const str = track(document.createElement('i')); str.style.cssText = 'position:absolute;height:1px;background:#0B0D12;transform-origin:0 50%;pointer-events:none;'; el.appendChild(str);
    const k = put(sprite('kite', { s: 3 }), 0, 0); say('Windy today.', 1500);
    await loopFx(4600, live, (t) => {
      const rise = Math.min(1, t / 900), kx = hp.x + D() * (50 + 18 * Math.sin(t / 600)) * rise, ky = hp.y - (30 + 85 * rise) + 8 * Math.cos(t / 450);
      k.style.left = (kx - k._w / 2) + 'px'; k.style.top = (ky - k._h / 2) + 'px'; k.style.transform = `rotate(${Math.sin(t / 500) * 14}deg)`;
      const dx = kx - hp.x, dy = ky - hp.y; str.style.left = hp.x + 'px'; str.style.top = hp.y + 'px'; str.style.width = Math.hypot(dx, dy) + 'px'; str.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    });
  }, { need: (c) => c.top > 160 });
  act('cat', 0.9, async (live) => {
    const side = D(), c = sprite('catA', { s: 4 }); put(c, side > 0 ? PW() + 6 : -c._w - 6, PH() - c._h); flip2(c, 'catA', 'catB', 900);
    c.animate([{ transform: `translateX(${side * 180}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 1000, easing: 'ease-out' });
    c.animate([{ translate: '0 0' }, { translate: '0 -3px' }], { duration: 140, direction: 'alternate', iterations: 7 });
    setPose({ eyes: 'wide', mouth: 'o' }); say('A cat!', 1200); if (!await wait(1100, live)) return;
    for (let i = 0; i < 4; i++) { setPose({ arms: i % 2 ? 'forward' : 'down', eyes: 'happy', mouth: 'smile' }); const f = faceAt(); if (i % 2) flyer('heart', f.x + D() * 40, f.y + 4, 0, -34, { ms: 1000, o: { s: 2 } }); if (!await wait(520, live)) return; }
    say(pick(['Mew.', 'Purr…', 'Good kitty.']), 1500); await wait(1300, live);
    c.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${side * 180}px)`, opacity: 0 }], { duration: 900, fill: 'forwards', easing: 'ease-in' });
    c.animate([{ translate: '0 0' }, { translate: '0 -3px' }], { duration: 140, direction: 'alternate', iterations: 7 }); setPose({ eyes: 'happy', mouth: 'smile', arms: 'waveR' }); await wait(1000, live);
  });
  act('lift', 1, async (live) => {
    say('Leg day? Arm day.', 1500); let held;
    for (let i = 0; i < 5; i++) {
      const hi = i % 2 === 0, arms = hi ? 'up' : 'forward'; if (held) held.remove();
      setPose({ arms, key: false, eyes: i > 2 ? 'blink' : 'open', mouth: i > 2 ? 'o' : 'grin', acc: i > 2 ? ['sweat'] : [] }); held = inHand('dumbbell', arms);
      if (hi) squash(); if (!await wait(560, live)) return;
    }
    if (held) held.remove(); setPose({ arms: 'out', eyes: 'happy', mouth: 'grin' }); say('Gains.', 1300); await pulse(live, 1.12, 1.12, 400); await wait(400, live);
  });
  act('sign', 1.2, async (live) => {
    const hp = elHand('up'), msg = pick(['FLIP ME', 'GOLD IS REAL', 'KEYS: SAFE', 'NO HIDDEN FEES', 'WILL WORK FOR GOLD', 'HARD CAPS ♥']);
    setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'smile' });
    const sg = track(document.createElement('div')); sg.className = 'sign'; sg.textContent = msg; sg.style.left = hp.x + 'px'; el.appendChild(sg);
    sg.animate([{ transform: 'translateX(-50%) translateY(14px) rotate(-3deg)', opacity: 0 }, { transform: 'translateX(-50%) translateY(0) rotate(-3deg)', opacity: 1 }], { duration: 300 });
    for (let i = 0; i < 4; i++) { if (!await wait(700, live)) return; sg.animate([{ transform: 'translateX(-50%) rotate(-3deg)' }, { transform: 'translateX(-50%) rotate(3deg)' }, { transform: 'translateX(-50%) rotate(-3deg)' }], { duration: 500 }); }
    await wait(300, live);
  }, { need: (c) => c.top > 100 });
  act('rainbow', 0.8, async (live) => {
    const R = 26, cv2 = document.createElement('canvas'); cv2.width = R * 2 + 1; cv2.height = R + 1; const g2 = cv2.getContext('2d'), cols = ['#FF4D6D', '#FF9A3C', '#FFD866', '#37C871', '#6CCBFF', '#7A5CFF'];
    for (let y = 0; y <= R; y++) for (let x = 0; x <= R * 2; x++) { const d = Math.hypot(x - R, y - R) - (R - 12); if (d >= 0 && d < 12 && y <= R) { g2.fillStyle = cols[Math.floor(d / 2)]; g2.fillRect(x, y, 1, 1); } }
    const f = feetAt(), sc = 5, box = document.createElement('div'); box.style.cssText = `position:absolute;left:${f.x - R * sc}px;top:${f.y - R * sc}px;width:${(R * 2 + 1) * sc}px;height:${(R + 1) * sc}px;background:url(${cv2.toDataURL()}) 0 0/100% 100% no-repeat;image-rendering:pixelated;`;
    fxLayer.appendChild(box); track(box);
    setPose({ arms: 'up', eyes: 'happy', mouth: 'open' }); say('Over the rainbow…', 1800);
    box.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1000, easing: 'steps(14)', fill: 'forwards' });
    if (!await wait(1200, live)) return; for (let i = 0; i < 3; i++) { puff('note', '♪', rnd(-14, 14), 0); setPose({ arms: i % 2 ? 'out' : 'up', eyes: 'happy', mouth: 'open' }); if (!await wait(600, live)) return; }
    box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: 'forwards' }); await wait(700, live);
  }, { need: (c) => c.top > 140 });
  act('snowDay', 0.7, async (live) => {
    say('Snow!', 1100); setPose({ arms: 'out', eyes: 'happy', mouth: 'open' }); weather('snow', 5200);
    for (let i = 0; i < 6; i++) { setPose({ arms: 'out', eyes: 'happy', mouth: i % 2 ? 'tongue' : 'open' }); me.dir = i % 3 === 2 ? -me.dir : me.dir; if (!await wait(780, live)) return; }
    say('Tastes like pixels.', 1500); await wait(1300, live);
  });
  act('showKey', 1.2, async (live) => {
    say(pick(['Mine.', 'One key. One model.', 'Hard to copy.']), 1700);
    for (let i = 0; i < 5; i++) { setPose({ arms: i % 2 ? 'up' : 'waveR', eyes: 'happy', mouth: 'grin', glint: true }); const h = handAt('up'); flashAt('twinkle', h.x, h.y - 18, 3); if (!await wait(420, live)) return; }
  }, { keepSeat: true });
  act('readAloud', 1, async (live) => {
    const t = onSurface(), txt = ((t && t.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 32); if (!txt) return;
    setPose({ arms: 'forward', key: false, eyes: 'open', mouth: 'open' }); const b = put(sprite('book', { s: 3 }), PW() / 2 - 21, 12 * S());
    say('“' + txt + '”', 3000); for (let i = 0; i < 5; i++) { setPose({ arms: 'forward', key: false, eyes: i % 2 ? 'happy' : 'open', mouth: i % 2 ? 'o' : 'open' }); if (!await wait(620, live)) return; }
    b.remove(); setPose({ eyes: 'happy', mouth: 'smile' }); await wait(300, live);
  }, { need: (c) => /^(title|heading|deck|says|last)$/.test(c.kind || ''), keepSeat: true });

  // ---------- dressing up (it stays on for a while) ----------
  act('shades', 0.9, async (live) => {
    setPose({ arms: 'up', eyes: 'open', mouth: 'smile' }); if (!await wait(350, live)) return;
    wear(['shades'], 16000); setPose({ arms: 'up', eyes: 'open', mouth: 'grin', glint: true }); say(pick(['Cool.', 'Too bright in here.', 'Deal with it.']), 1700);
    const f = faceAt(); flashAt('twinkle', f.x - 12, f.y - 2, 3); await wait(1100, live);
  }, { need: (c) => !c.dressed, keepSeat: true });
  act('partyhat', 0.9, async (live) => {
    setPose({ arms: 'up', eyes: 'wide', mouth: 'o' }); if (!await wait(350, live)) return;
    wear(['partyhat'], 18000); setPose({ arms: 'up', eyes: 'happy', mouth: 'open' }); say('Party time!', 1600); const h = headAt(); burst(h.x, h.y, { n: 24, size: 6, speed: 200, life: 1200, spread: 120 });
    await bounce(16, 380); await wait(800, live);
  }, { need: (c) => !c.dressed, keepSeat: true });
  act('crown', 0.8, async (live) => {
    setPose({ arms: 'up', eyes: 'open', mouth: 'smile' }); if (!await wait(350, live)) return;
    wear(['crown'], 18000); setPose({ arms: 'hips', eyes: 'open', mouth: 'grin', glint: true }); say(pick(['All hail.', 'The gold queen.', 'Bow down.']), 1800, 'gold');
    const h = headAt(); sparkleAt(h.x, h.y, 5, 22, 'spark'); await wait(1300, live);
  }, { need: (c) => !c.dressed, keepSeat: true });
  act('headphones', 0.9, async (live) => {
    setPose({ arms: 'up', eyes: 'open', mouth: 'smile' }); if (!await wait(350, live)) return;
    wear(['headphones'], 20000); say('♪ ♫', 1500);
    for (let i = 0; i < 8; i++) {
      setPose({ eyes: 'blink', mouth: i % 2 ? 'o' : 'smile', arms: i % 4 < 2 ? 'down' : 'hips' }); puff(i % 2 ? 'note p' : 'note', i % 2 ? '♪' : '♫', rnd(-20, 20), 0);
      await tilt(live, i % 2 ? 7 : -7, 330, 0.2); if (!live()) return;
    }
  }, { need: (c) => !c.dressed, keepSeat: true });
  act('flower', 0.9, async (live) => {
    setPose({ arms: 'up', eyes: 'open', mouth: 'smile' }); if (!await wait(350, live)) return;
    wear(['flower', 'blush'], 20000); setPose({ eyes: 'happy', mouth: 'smile' }); say(pick(['Spring.', 'Do I look nice?', 'Found it outside.']), 1700);
    const f = faceAt(); flyer('heart', f.x - 12, f.y - 18, -6, -34, { ms: 1000, o: { s: 2 } }); await wait(1400, live);
  }, { need: (c) => !c.dressed, keepSeat: true });
  act('specs', 0.8, async (live) => {
    setPose({ arms: 'up', eyes: 'open', mouth: 'o' }); if (!await wait(350, live)) return;
    wear(['specs'], 18000); setPose({ arms: 'up', eyes: 'open', mouth: 'smile', glint: true }); say(pick(['Nerd mode.', 'Reading the fine print.', 'Now I see.']), 1700); await wait(1200, live);
  }, { need: (c) => !c.dressed, keepSeat: true });

  // ---------- things she does with the page ----------
  act('polish', 1, async (live) => {
    const node = onSurface(); setPose({ arms: 'forward', key: false, eyes: 'happy', mouth: 'smile' }); say(pick(['Squeaky clean.', 'Polishing…']), 1600);
    const base = me.ox;
    for (let i = 0; i < 6; i++) { if (!await glide(base + (i % 2 ? -18 : 18), 280, live, { face: false })) return; puff('dust', '', D() * 22, PH() - 6); setPose({ arms: i % 2 ? 'forward' : 'down', key: false, eyes: 'happy', mouth: 'smile' }); }
    shine(node); const m = midAt(); sparkleAt(m.x, m.y, 5, 30); setPose({ arms: 'up', eyes: 'happy', mouth: 'grin' }); await wait(900, live);
  }, { need: (c) => !!c.node });
  act('sticker', 1, async (live) => {
    const cands = surfaces().filter((s) => s.r.width > 80 && s.r.height > 24); if (!cands.length) return;
    const t = pick(cands), u = rnd(0.2, 0.8), kind = pick(['heart', 'star', 'spark']);
    const T = () => { const r = t.node.getBoundingClientRect(); return { x: r.left + r.width * u, y: r.top + r.height * 0.5 }; };
    me.dir = T().x > feetAt().x ? 1 : -1; setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'grin' }); say('Sticker!', 1000);
    if (!await wait(500, live)) return;
    const h = handAt('up'), n = track(fxSprite(kind, h.x, h.y, { s: 3 }));
    if (!await loopFx(650, live, (tm, p) => { const to = T(); centerAt(n, h.x + (to.x - h.x) * p, h.y + (to.y - h.y) * p - 4 * 70 * p * (1 - p)); })) return;
    boing(t.node); setPose({ arms: 'down', eyes: 'happy', mouth: 'open' }); say(pick(['Stuck.', 'Looks better.', 'Mine now.']), 1300);
    if (!await loopFx(3200, live, () => { const to = T(); centerAt(n, to.x, to.y); })) return;
    n.animate([{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: 'translate(30px,-70px) rotate(90deg)', opacity: 0 }], { duration: 700, fill: 'forwards' }); await wait(700, live);
  });
  // sky-writing: she spells her name in the air
  const FONT = { K: ['x.x', 'x.x', 'xx.', 'x.x', 'x.x'], E: ['xxx', 'x..', 'xxx', 'x..', 'xxx'], I: ['xxx', '.x.', '.x.', '.x.', 'xxx'], '♥': ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'] };
  act('skywrite', 1, async (live) => {
    setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'open' }); say('Watch the sky…', 1200);
    const word = pick(['KEI', 'KEI♥']), px = 5, f = feetAt(), letters = word.split(''), ws = letters.map((ch) => FONT[ch][0].length + 1), w = ws.reduce((a, b) => a + b, 0) * px - px, y0 = f.y - PH() - 44 - 5 * px, cells = [];
    let cx = f.x - w / 2; letters.forEach((ch, li) => { FONT[ch].forEach((row, ry) => row.split('').forEach((c, rx) => { if (c === 'x') cells.push([cx + rx * px, y0 + ry * px]); })); cx += ws[li] * px; });
    const nodes = [];
    cells.forEach(([x, y], i) => {
      const d = document.createElement('i'); nodes.push(d); d.style.cssText = `left:${x}px;top:${y}px;width:${px}px;height:${px}px;background:${i % 3 ? '#2340FF' : '#F2B51C'};`; fxLayer.appendChild(d); track(d);
      d.animate([{ opacity: 0, transform: 'scale(2)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 160, delay: i * 40, fill: 'both' });
    });
    if (!await wait(cells.length * 40 + 1800, live)) return;
    nodes.forEach((d) => d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }));
    await wait(550, live);
  }, { need: (c) => c.top > 120 });
  act('peekaboo', 1, async (live) => {
    setPose({ arms: 'cover', eyes: 'blink', mouth: 'smile' }); say('Where did I go?', 1300); if (!await wait(1400, live)) return;
    setPose({ arms: 'up', eyes: 'wide', mouth: 'open' }); say('Peekaboo!', 1300); await bounce(18, 380); await wait(700, live);
  }, { keepSeat: true });
  act('highfive', (c) => (c.fresh ? 1.6 : 0.6), async (live) => {
    facePtr(); setPose({ arms: 'up', key: false, eyes: 'happy', mouth: 'open' }); say('High five!', 2600);
    let hit = false; const on = (e) => { const c = midAt(); if (Math.hypot(e.clientX - c.x, e.clientY - c.y) < 140) hit = true; };
    document.addEventListener('pointerdown', on, true); onEnd(() => document.removeEventListener('pointerdown', on, true));
    for (let i = 0; i < 30 && !hit; i++) { if (!await wait(100, live)) return; }
    if (hit) {
      squash(); setPose({ arms: 'up', eyes: 'happy', mouth: 'laugh', glint: true }); say('YES!', 1400, 'gold'); const h = handAt('up');
      burst(h.x, h.y, { n: 22, size: 6, speed: 200, life: 1000, spread: 200 }); flashAt('twinkle', h.x, h.y - 10, 5); await bounce(22, 440); await wait(900, live);
    } else { setPose({ arms: 'down', eyes: 'open', mouth: 'frown' }); say('Left hanging…', 1600); await wait(1400, live); }
  });
  act('follow', 1, async (live) => {
    say('Following you.', 1300); setPose({ eyes: 'happy', mouth: 'smile' });
    const end = performance.now() + 5500;
    while (performance.now() < end) {
      const s = me.on; if (!s || !s.node.isConnected) return;
      const r = s.node.getBoundingClientRect(), target = clamp(ptr.x - r.left - PW() / 2, 6, Math.max(6, r.width - PW() - 6)), dx = target - me.ox;
      if (Math.abs(dx) > 8) { me.dir = dx > 0 ? 1 : -1; me.ox += Math.sign(dx) * Math.min(Math.abs(dx), 2.2); setPose({ legs: Math.floor(performance.now() / 130) % 2 ? 'step' : 'stand', eyes: 'happy', mouth: 'smile' }); }
      else { facePtr(); setPose({ eyes: 'happy', mouth: 'smile' }); }
      await sleep(16); if (!live()) return;
    }
  }, { need: (c) => c.fresh && c.room > 100 });
  act('countdown', 0.9, async (live) => {
    for (const n of ['3', '2', '1']) { setPose({ arms: 'up', eyes: 'wide', mouth: 'o' }); say(n + '…', 750); bounce(6, 220); if (!await wait(780, live)) return; }
    setPose({ arms: 'up', legs: 'tuck', eyes: 'happy', mouth: 'open' }); say('GO!', 1300, 'gold'); const h = headAt(); burst(h.x, h.y, { n: 26, size: 6, speed: 240, life: 1200, spread: 150 }); await bounce(38, 600); squash(); await wait(500, live);
  });
  act('knock', 1, async (live) => {
    const node = onSurface(); me.seated = false; setPose({ arms: 'forward', eyes: 'open', mouth: 'smile' }); say('Knock knock.', 1300);
    for (let i = 0; i < 3; i++) { setPose({ arms: i % 2 ? 'down' : 'forward', eyes: 'open', mouth: 'smile' }); boing(node); puff('dust', '', D() * 20, PH() * 0.5); if (!await wait(430, live)) return; }
    setPose({ arms: 'down', eyes: 'open', mouth: 'o' }); tilt(live, 8, 1200, 0.7); say('Anyone home?', 1500); await wait(1400, live);
    setPose({ eyes: 'open', mouth: 'frown', arms: 'shrug' }); await wait(700, live);
  }, { need: (c) => !!c.node });
  // reaction only: a pointer rushing at her makes her sidestep
  act('dodge', 0, async (live) => {
    const away = ptr.x > feetAt().x ? -1 : 1; setPose({ eyes: 'wide', mouth: 'o', arms: 'up' }); say(pick(['Whoa!', 'Hey!', 'Watch it!']), 900);
    await Promise.all([bounce(26, 440), glide(me.ox + away * 70, 440, live, { face: false })]);
    if (live()) { squash(); await wait(500, live); }
  });

  // ---------- choosing and running them ----------
  // walk over and sit down near the visitor's pointer, then wave
  function visitCursor() {
    const px = ptr.x + scrollX, py = ptr.y + scrollY, here = me.on && me.on.node;
    let best = null;
    for (const s of surfaces()) {
      if (s.node === here) continue;
      const left = pageX(s.r), right = left + s.r.width, top = pageY(s.r), dy = top - py;
      if (dy < -40 || dy > 220) continue;
      const side = px - left > right - px ? -1 : 1;
      let tx = px + side * 72 - PW() / 2;
      if (tx < left + 6 || tx > right - PW() - 6) tx = px - side * 72 - PW() / 2;
      if (tx < left + 6 || tx > right - PW() - 6) continue;
      const score = Math.abs(dy - 60);
      if (!best || score < best.score) best = { s, tx, score };
    }
    if (!best) return false;
    me.lastHop = performance.now();
    travel(best.s, best.tx - pageX(best.s.r), () => runAct('greet', (live) => wave(live, ptr.x + scrollX - (me.x + PW() / 2))));
    return true;
  }
  async function runAct(id, fn) {
    if (reduced) return;
    const act = ++me.actId, live = () => act === me.actId && me.mode === 'idle';
    const myJunk = (junk = new Set()), myUndo = (undo = []);
    me.whimming = true; me.whimAct = act; me.curAct = id;
    document.dispatchEvent(new CustomEvent('kei:act', { detail: { id } }));
    try { await fn(live); }
    catch (e) { console.warn('kei act', id, e); }
    finally {
      sweep(myJunk, myUndo);
      if (act === me.actId) { me.whimming = false; setPose({}); nextThink = performance.now() + 1500 + Math.random() * 2600; }
    }
  }
  function context(now) {
    const node = onSurface(), idle = now - me.lastInput, f = feetAt();
    return {
      seated: me.seated, bored: idle > 9000, idle, node, kind: me.on && me.on.kind,
      room: node ? node.getBoundingClientRect().width - PW() - 12 : 0,
      fresh: sees(), pdist: ptr.x < 0 ? 1e9 : Math.hypot(ptr.x - f.x, ptr.y - (f.y - PH() / 2)),
      hour: new Date().getHours(), dressed: me.acc.length > 0, top: f.y - PH(),
    };
  }
  function pickAct(now) {
    const c = context(now);
    const L = A.filter((a) => (!a.sit || c.seated) && (!a.need || a.need(c))).map((a) => {
      let w = typeof a.w === 'function' ? a.w(c) : a.w; if (a.bias) w *= a.bias(c);
      if (me.recent.includes(a.id)) w *= 0.08;
      return [a, w];
    }).filter(([, w]) => w > 0);
    let r = Math.random() * L.reduce((s, e) => s + e[1], 0);
    for (const e of L) { r -= e[1]; if (r <= 0) return e[0]; }
    return L[0][0];
  }
  function decide(now) {
    const fresh = sees(), f = feetAt(), dx = ptr.x - f.x, dist = ptr.x < 0 ? 1e9 : Math.hypot(dx, ptr.y - (f.y - PH() / 2));
    // the visitor is close and moving: say hi
    if (fresh && dist < 320 && ready('wave', now)) { hold('wave', 16000); me.seated = false; runAct('wave', (live) => wave(live, dx)); return; }
    // the visitor is far off but active: walk over and sit near them
    if (fresh && dist > 420 && ready('visit', now) && Math.random() < 0.35) { hold('visit', 24000); if (visitCursor()) return; }
    // every so often, wander to another spot on the page
    if (now - me.lastHop > 9000 + Math.random() * 7000 && goSomewhere()) return;
    const a = pickAct(now);
    me.recent.push(a.id); if (me.recent.length > 10) me.recent.shift();
    if (!a.keepSeat) me.seated = false;
    runAct(a.id, a.fn);
  }
  // tapping her: she shows off a random trick
  function pokeAct() {
    const a = pickAct(performance.now()); me.recent.push(a.id); if (me.recent.length > 10) me.recent.shift();
    if (!a.keepSeat) me.seated = false; runAct(a.id, a.fn);
  }
  // a pointer charging at her makes her sidestep
  let lastP = { x: 0, y: 0, t: 0 };
  addEventListener('pointermove', (e) => {
    const now = performance.now(), dt = now - lastP.t, v = dt > 0 && dt < 120 ? Math.hypot(e.clientX - lastP.x, e.clientY - lastP.y) / dt * 1000 : 0; lastP = { x: e.clientX, y: e.clientY, t: now };
    if (reduced || e.pointerType === 'touch' || v < 1700 || me.mode !== 'idle' || anim || whimBusy() || !ready('dodge', now)) return;
    const c = midAt(); if (Math.hypot(e.clientX - c.x, e.clientY - c.y) > 110 || !me.on) return;
    hold('dodge', 18000); if (Math.random() < 0.4) { me.seated = false; me.recent.push('dodge'); runAct('dodge', A.find((a) => a.id === 'dodge').fn); }
  }, { passive: true });
  // a way to call any act by name (the page's tap-for-a-trick uses it; handy in the console too)
  window.Kei = {
    acts: () => A.map((a) => a.id),
    state: () => ({ mode: me.mode, busy: whimBusy(), seated: me.seated, dressed: me.acc.length, on: !!me.on, kind: me.on && me.on.kind, kids: el.children.length, fx: fxLayer.children.length, body: getComputedStyle(bodyEl).transform, op: el.style.opacity }),
    play: (id) => { const a = A.find((x) => x.id === id); if (!a) return false; wake(); me.lastInput = performance.now(); if (!a.keepSeat) me.seated = false; me.recent.push(id); runAct(id, a.fn); return true; },
  };
  // ==== ACTS END ====

  // ---------- the loop ----------
  let last = performance.now(), nextThink = performance.now() + 1800, blinkAt = performance.now() + 2500, glintAt = performance.now() + 4000, stepT = 0, sleepT = 0;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const idleFor = now - me.lastInput;
    if (me.mode === 'held') { /* follows the pointer */ }
    else if (anim && anim.kind === 'walk') {
      const r = anim.s.node.getBoundingClientRect(), tx = pageX(r) + anim.ox, ty = pageY(r);
      const step = 70 * dt * Math.sign(tx - me.x); me.dir = Math.sign(tx - me.x) || me.dir;
      if (Math.abs(tx - me.x) <= Math.abs(step) + 0.5) {
        const a = anim; me.x = tx; me.y = ty; me.on = a.s; me.ox = a.ox; anim = null; me.mode = 'idle';
        nextThink = Math.max(nextThink, now + (a.quiet ? 1200 : 2600));
        if (a.after) a.after(); else if (!a.quiet) arrive(me.on);
      }
      else { me.x += step; me.y = ty; stepT += dt; setPose({ legs: Math.floor(stepT * 7) % 2 ? 'step' : 'stand' }); }
    } else if (anim && anim.kind === 'jump') {
      const r = anim.s.node.getBoundingClientRect(), tx = pageX(r) + anim.ox, ty = pageY(r);
      const p = Math.min(1, (now - anim.t0) / anim.dur), e = p;
      me.x = anim.x0 + (tx - anim.x0) * e;
      me.y = anim.y0 + (ty - anim.y0) * e - Math.sin(p * Math.PI) * anim.peak;
      setPose({ legs: 'tuck', arms: p < 0.5 ? 'up' : 'down', eyes: 'open', mouth: 'o' });
      if (p >= 1) land(anim.s, false, anim.after);
    } else if (anim && anim.kind === 'fall') {
      const r = anim.s.node.getBoundingClientRect(), ty = pageY(r);
      me.vy += 1500 * dt; me.y += me.vy * dt;
      setPose({ arms: 'up', eyes: 'wide', mouth: 'o', legs: 'stand' });
      if (me.y >= ty) { me.y = ty; const hard = me.vy > 900; me.vy = 0; land(anim.s, hard, anim.after); }
    } else if (me.mode === 'idle' || me.mode === 'sleep') {
      // stay on the element as it moves (floating cards, layout changes)
      if (me.on && me.on.node.isConnected) {
        const r = me.on.node.getBoundingClientRect();
        me.x = pageX(r) + me.ox; me.y = pageY(r);
        const off = r.bottom < topbarH() || r.top > innerHeight || r.width < 10;
        if (off && now > me.busyUntil) { me.busyUntil = now + 900; setTimeout(() => { if (me.mode !== 'held') { const r2 = me.on && me.on.node.getBoundingClientRect(); if (!r2 || r2.bottom < topbarH() || r2.top > innerHeight) goSomewhere(); } }, 600); }
      } else if (now > me.busyUntil) { me.busyUntil = now + 900; goSomewhere(); }
      // sleep when nobody has done anything for a while
      if (me.mode === 'idle' && idleFor > 22000 && !reduced && !whimBusy()) { me.mode = 'sleep'; me.seated = true; me.actId++; setPose({ eyes: 'sleep', mouth: 'smile' }); }
      if (me.mode === 'sleep') { sleepT += dt; if (sleepT > 1.1) { sleepT = 0; puff('z', Math.random() < 0.5 ? 'z' : 'Z', 10, 0); } }
      else if (now > blinkAt && !whimBusy()) { const p = me.pose; setPose({ ...p, eyes: 'blink' }); setTimeout(() => { if (me.pose.eyes === 'blink') setPose({ ...p, eyes: p.eyes === 'blink' ? 'open' : p.eyes || 'open' }); }, 130); blinkAt = now + 2200 + Math.random() * 3200; }
      // the key catches the light now and then
      if (me.mode === 'idle' && !reduced && !whimBusy() && now > glintAt) {
        glintAt = now + 4500 + Math.random() * 4000;
        setPose({ ...me.pose, glint: true }); setTimeout(() => { if (me.pose.glint) setPose({ ...me.pose, glint: false }); }, 220);
      }
      // nothing in particular to do: find something to do
      if (me.mode === 'idle' && !reduced && now > nextThink && now > me.busyUntil && !whimBusy()) { nextThink = now + 700; decide(now); }
    }
    place();
    requestAnimationFrame(tick);
  }

  // ---------- people ----------
  const wake = () => { me.lastInput = performance.now(); if (me.mode === 'sleep') { me.mode = 'idle'; me.seated = false; setPose({ eyes: 'wide' }); say(pick(['Huh? I\'m up!', 'Five more minutes…', 'I wasn\'t sleeping.']), 1600); nextThink = performance.now() + 2500; } };
  addEventListener('pointermove', (e) => {
    const now = performance.now(); me.lastInput = now; ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = now;
    if (me.mode === 'idle' && !anim && !whimBusy()) { const cx = me.x - scrollX + PW() / 2; if (Math.abs(e.clientX - cx) > 40) me.dir = e.clientX > cx ? 1 : -1; }
  }, { passive: true });
  let lastScrollY = scrollY, lastScrollT = performance.now();
  addEventListener('scroll', () => {
    const now = performance.now(); me.lastInput = now; if (me.mode === 'sleep') wake();
    const v = Math.abs(scrollY - lastScrollY) / Math.max(16, now - lastScrollT) * 1000; lastScrollY = scrollY; lastScrollT = now;
    // a hard scroll startles her
    if (!reduced && v > 2600 && me.mode === 'idle' && !anim && ready('whoa', now)) {
      hold('whoa', 25000);
      runAct('whoa', async (live) => { setPose({ arms: 'up', eyes: 'wide', mouth: 'o' }); say(pick(['Whoa!', 'Slow down!', 'Wheee!']), 1400); await wait(1200, live); });
    }
  }, { passive: true });
  addEventListener('keydown', wake);

  // she notices what you point at, what you click, and when you come back
  let attendAt = 0;
  document.addEventListener('pointerover', (e) => {
    const now = performance.now();
    if (reduced || e.pointerType === 'touch' || now - attendAt < 2500 || me.mode !== 'idle' || anim || whimBusy()) return;
    const t = e.target && e.target.closest && e.target.closest('.pc, .deck-row, .odd, #shareimg, .codewrap, #says li, button, a');
    if (!t || cv.contains(t) || Math.random() > 0.5) return;
    const r = t.getBoundingClientRect(), cx = me.x - scrollX + PW() / 2;
    attendAt = now; me.dir = r.left + r.width / 2 >= cx ? 1 : -1;
    if (Math.random() < 0.35) { setPose({ ...me.pose, eyes: 'wide' }); setTimeout(() => { if (me.pose.eyes === 'wide' && !whimBusy() && me.mode === 'idle') setPose({ ...me.pose, eyes: 'open' }); }, 700); }
  }, { passive: true });
  document.addEventListener('pointerdown', (e) => {
    const now = performance.now();
    if (reduced || e.target === cv || me.mode !== 'idle' || anim || whimBusy() || !ready('clicklook', now)) return;
    hold('clicklook', 3500);
    me.dir = e.clientX >= me.x - scrollX + PW() / 2 ? 1 : -1;
    if (Math.random() < 0.6) { puff('mark', '!', 4, -6); setPose({ ...me.pose, eyes: 'wide', mouth: 'o' }); setTimeout(() => { if (!whimBusy() && me.mode === 'idle') setPose({}); }, 650); }
  }, { passive: true });
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    const now = performance.now();
    if (document.hidden) { hiddenAt = now; return; }
    if (reduced || !hiddenAt || now - hiddenAt < 5000) return;
    wake();
    setTimeout(() => { if (me.mode === 'idle' && !anim) { me.seated = false; runAct('back', async (live) => { say('Welcome back!', 1900); await wave(live, 0); }); } }, 500);
  });
  cv.addEventListener('pointerenter', (e) => {
    const now = performance.now();
    if (reduced || e.pointerType === 'touch' || me.mode !== 'idle' || anim || whimBusy() || !ready('hover', now)) return;
    hold('hover', 5000); me.actId++; setPose({ eyes: 'happy', mouth: 'open' }); bounce(8, 280);
    if (Math.random() < 0.4) say(pick(['Hm?', 'Hi!', 'Yes?']), 1100);
    setTimeout(() => { if (me.mode === 'idle' && !whimBusy()) setPose({}); }, 900);
  });

  // pick her up and drop her
  let drag = null;
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); wake(); cv.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false, ox: e.clientX + scrollX - me.x, oy: e.clientY + scrollY - (me.y - PH()) };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
      drag.moved = true; me.mode = 'held'; anim = null; me.on = null; me.seated = false; me.actId++; el.classList.add('held');
      say(pick(['Wheee!', 'Put me down!', 'Hey!']), 1400);
    }
    if (drag.moved) {
      me.x = e.clientX + scrollX - drag.ox; me.y = e.clientY + scrollY - drag.oy + PH();
      setPose({ arms: 'up', eyes: 'wide', mouth: 'o', legs: Math.floor(performance.now() / 120) % 2 ? 'step' : 'stand' });
    }
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const wasDrag = drag.moved; drag = null; el.classList.remove('held');
    if (wasDrag) {
      // fall onto whatever is below her, or the closest thing nearby
      const list = surfaces(), cx = me.x + PW() / 2;
      const below = list.filter((s) => pageX(s.r) <= cx && pageX(s.r) + s.r.width >= cx && pageY(s.r) >= me.y - 4).sort((a, b) => pageY(a.r) - pageY(b.r))[0];
      const target = below || list.sort((a, b) => Math.hypot(pageX(a.r) - me.x, pageY(a.r) - me.y) - Math.hypot(pageX(b.r) - me.x, pageY(b.r) - me.y))[0];
      if (!target) { me.mode = 'idle'; return; }
      if (below) { me.mode = 'fall'; me.vy = 0; anim = { kind: 'fall', s: below }; }
      else travel(target, me.x - pageX(target.r));
      return;
    }
    // a tap: she reacts, and too many pokes make her dizzy
    const now = performance.now(); me.pokes = now - me.pokeAt < 1500 ? me.pokes + 1 : 1; me.pokeAt = now;
    if (me.pokes >= 5) { me.pokes = 0; me.actId++; setPose({ eyes: 'dizzy', mouth: 'o' }); say('Stop poking! @_@', 1800); me.busyUntil = now + 2000; setTimeout(() => setPose({}), 1800); return; }
    puff('heart', '♥', (Math.random() - 0.5) * 24, 6);
    // a tap gets a cheer, or she shows off one of her tricks
    if (me.whimming && me.curAct === 'highfive') return;       // that is the high five
    if (reduced || Math.random() < 0.28) cheer(pick(LINES.poke));
    else pokeAct();
  };
  cv.addEventListener('pointerup', release); cv.addEventListener('pointercancel', release);

  // a card was just turned over: run to it
  document.addEventListener('tokard:reveal', (e) => {
    wake(); const pc = e.detail && e.detail.el; if (!pc || me.mode === 'held') return;
    const node = pc.querySelector('.pc-rot'); if (!node) return;
    setTimeout(() => {
      const r = node.getBoundingClientRect(); if (r.top < topbarH() + PH()) return;
      travel({ node, kind: 'card', w: 4, r }, r.width / 2 - PW() / 2);
    }, 300);
  });

  // ---------- start: she arrives on the headline ----------
  function start() {
    const title = document.querySelector('#hero-h .l:first-child > span') || document.querySelector('#hero-h');
    const r = title.getBoundingClientRect();
    const s = { node: title, kind: 'title', w: 3, r };
    setPose({});
    if (reduced) { stickTo(s, r.width / 2 - PW() / 2); me.seated = true; place(); return requestAnimationFrame(tick); }
    dropInto(s, r.width * 0.6 - PW() / 2); nextThink = performance.now() + 4500; requestAnimationFrame(tick);
    setTimeout(() => say('Hi! I\'m Kei.', 2200), 1100);
  }
  if (document.readyState === 'complete') setTimeout(start, 900); else addEventListener('load', () => setTimeout(start, 900));
})();
