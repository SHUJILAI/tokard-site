// Token Rain: a small pixel game for the wait between flips.
// Move the card, catch tokens (+1) and sparks (+5), dodge bugs (they cost a heart).
// Just for fun: nothing is won, so there is nothing to farm.
(() => {
  const P = 4;                                   // one art pixel = 4 CSS px
  const PAL = { c: '#2340FF', C: '#4F68FF', d: '#1A2CC8', w: '#FFFFFF', y: '#F2B51C', Y: '#FFE08A', o: '#C88A00', W: '#FFFBEA', r: '#FF4D5E', R: '#C21F3A', k: '#0B0D12', h: '#FF4D5E', g: '#D9DEEA' };
  const SPR = {
    card: ['.CCCCCCCCCCCC.', 'Ccccccwccccccd', 'Cccccwwwcccccd', 'Ccccccwccccccd', 'Cccccccccccccd', '.dddddddddddd.'],
    coin: ['.yyyy.', 'yYYyyo', 'yYyyyo', 'yyyyyo', 'yyyyoo', '.oooo.'],
    star: ['...y...', '...y...', '..yYy..', 'yyYWYyy', '..yYy..', '...y...', '...y...'],
    bug: ['r.....r', '.rRRRr.', 'rRkRkRr', '.RRRRR.', 'rRRRRRr', '.r.r.r.'],
    heart: ['hh.hh', 'hhhhh', '.hhh.', '..h..'],
    heartOff: ['gg.gg', 'ggggg', '.ggg.', '..g..'],
  };
  const FONT = {
    0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'],
    4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'], 6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'],
    8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'], '+': ['000', '010', '111', '010', '000'], '-': ['000', '000', '111', '000', '000'],
    B: ['110', '101', '110', '101', '110'], E: ['111', '100', '110', '100', '111'], S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'], ' ': ['000', '000', '000', '000', '000'],
  };
  const BEST = 'tokard.game.best';
  const getBest = () => { try { return +localStorage.getItem(BEST) || 0; } catch { return 0; } };
  const setBest = (v) => { try { localStorage.setItem(BEST, String(v)); } catch { /* private mode */ } };

  function sprite(ctx, rows, x, y, s = P, alpha = 1) {
    ctx.globalAlpha = alpha;
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.') continue; ctx.fillStyle = PAL[ch]; ctx.fillRect(Math.round(x + i * s), Math.round(y + j * s), s, s); } });
    ctx.globalAlpha = 1;
  }
  function text(ctx, str, x, y, s, color, align = 'left', alpha = 1) {
    const w = str.length * 4 * s - s;
    let cx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    for (const ch of String(str)) { const g = FONT[ch] || FONT[' ']; g.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] === '1') ctx.fillRect(Math.round(cx + i * s), Math.round(y + j * s), s, s); }); cx += 4 * s; }
    ctx.globalAlpha = 1;
  }

  function mount(host) {
    host.innerHTML = '<canvas class="tr-canvas" tabindex="0" aria-label="Token Rain: move with the mouse, a finger or the arrow keys"></canvas><button class="vbtn primary tr-play" type="button">Play</button>';
    const cv = host.querySelector('canvas'), btn = host.querySelector('.tr-play'), ctx = cv.getContext('2d');
    let W = 0, H = 0, raf = 0, last = 0, visible = true;
    let mode = 'idle', score = 0, best = getBest(), lives = 3, t = 0, spawnIn = 0, shake = 0, hurt = 0;
    let items = [], pops = [], dust = [];
    const pl = { x: 0, tx: 0, w: SPR.card[0].length * P, h: SPR.card.length * P };
    const keys = { l: false, r: false };

    function size() {
      const r = host.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = Math.round(W * d); cv.height = Math.round(H * d); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.imageSmoothingEnabled = false;
      if (!pl.x) pl.x = pl.tx = (minX() + maxX()) / 2 - pl.w / 2;
      pl.x = Math.min(Math.max(pl.x, minX()), maxX() - pl.w); pl.tx = Math.min(Math.max(pl.tx, minX()), maxX() - pl.w);
    }
    const groundY = () => H - 84;
    const minX = () => W * 0.16, maxX = () => W * 0.9;          // the edges fade into the page, so play stays inside

    function spawn() {
      const r = Math.random(), bugP = Math.min(0.34, 0.18 + t * 0.004);
      const kind = r < bugP ? 'bug' : r < bugP + 0.07 ? 'star' : 'coin';
      const spr = SPR[kind], w = spr[0].length * P;
      const speed = (110 + t * 3.2) * (0.75 + Math.random() * 0.5);
      items.push({ kind, x: minX() + 6 + Math.random() * (maxX() - minX() - 12 - w), y: -40, w, h: spr.length * P, vy: speed, wob: Math.random() * 6 });
    }
    function start() {
      mode = 'play'; score = 0; lives = 3; t = 0; spawnIn = 0.4; items = []; pops = []; hurt = 0;
      btn.hidden = true; playing(true); cv.focus({ preventScroll: true }); kick();
    }
    function over() {
      mode = 'over'; if (score > best) { best = score; setBest(best); }
      btn.textContent = 'Play again'; btn.hidden = false; playing(false);
    }
    function pop(x, y, str, color) { pops.push({ x, y, str, color, life: 1 }); }
    function sparks(x, y, colors, n) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 120; dust.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, c: colors[(Math.random() * colors.length) | 0], life: 1 }); } }

    function step(dt) {
      t += mode === 'play' ? dt : 0;
      // the card follows the pointer, or the keys
      if (keys.l) pl.tx -= 520 * dt; if (keys.r) pl.tx += 520 * dt;
      pl.tx = Math.min(Math.max(pl.tx, minX()), maxX() - pl.w);
      pl.x += (pl.tx - pl.x) * Math.min(1, dt * 16);
      const gy = groundY();
      if (mode === 'play') {
        spawnIn -= dt;
        if (spawnIn <= 0) { spawn(); spawnIn = Math.max(0.26, 0.9 - t * 0.012) * (0.7 + Math.random() * 0.6); }
      } else if (Math.random() < dt * 1.2) {
        // idle: a few tokens drift down as decoration
        const w = 6 * P; items.push({ kind: Math.random() < 0.15 ? 'star' : 'coin', x: minX() + 6 + Math.random() * (maxX() - minX() - 12 - w), y: -40, w, h: 6 * P, vy: 50 + Math.random() * 30, wob: Math.random() * 6, ghost: true });
      }
      for (const it of items) {
        it.y += it.vy * dt; it.wob += dt * 3;
        if (mode === 'play' && !it.ghost && !it.done && it.y + it.h >= gy && it.y <= gy + pl.h * 0.6 && it.x + it.w > pl.x + 2 && it.x < pl.x + pl.w - 2) {
          it.done = true; const cx = it.x + it.w / 2;
          if (it.kind === 'bug') { lives--; hurt = 0.45; shake = 0.3; pop(cx, gy - 10, '-', PAL.r); sparks(cx, gy, [PAL.r, PAL.R], 14); if (lives <= 0) over(); }
          else { const v = it.kind === 'star' ? 5 : 1; score += v; pop(cx, gy - 10, '+' + v, it.kind === 'star' ? PAL.o : PAL.c); sparks(cx, gy, it.kind === 'star' ? [PAL.y, PAL.Y, PAL.W] : [PAL.y, PAL.Y], it.kind === 'star' ? 18 : 8); }
        }
      }
      items = items.filter((it) => !it.done && it.y < H + 20);
      for (const p of pops) { p.y -= 40 * dt; p.life -= dt * 1.3; }
      pops = pops.filter((p) => p.life > 0);
      for (const d of dust) { d.vy += 380 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt * 1.6; }
      dust = dust.filter((d) => d.life > 0);
      shake = Math.max(0, shake - dt); hurt = Math.max(0, hurt - dt);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (shake) ctx.translate((Math.random() - 0.5) * 6 * shake / 0.3, 0);
      const gy = groundY();
      // ground: a row of faint pixel dots rather than a line
      ctx.fillStyle = '#D9DEEA';
      for (let x = minX(); x < maxX(); x += P * 3) ctx.fillRect(x, gy + pl.h + 10, P, P);
      for (const it of items) sprite(ctx, SPR[it.kind], it.x + Math.sin(it.wob) * (it.kind === 'bug' ? 3 : 0), it.y, P, it.ghost ? 0.45 : 1);
      const blink = hurt > 0 && Math.floor(hurt * 20) % 2 === 0;
      sprite(ctx, SPR.card, pl.x, gy, P, blink ? 0.3 : mode === 'play' ? 1 : 0.85);
      for (const d of dust) { ctx.globalAlpha = Math.max(0, d.life); ctx.fillStyle = d.c; ctx.fillRect(Math.round(d.x), Math.round(d.y), P, P); }
      ctx.globalAlpha = 1;
      for (const p of pops) text(ctx, p.str, p.x, p.y, 3, p.color, 'center', Math.min(1, p.life * 1.5));
      ctx.restore();
      // score, best and hearts
      const cx = (minX() + maxX()) / 2, top = H * 0.14;
      if (mode !== 'idle') { text(ctx, String(score), maxX(), top, 6, '#0B0D12', 'right'); for (let i = 0; i < 3; i++) sprite(ctx, i < lives ? SPR.heart : SPR.heartOff, minX() + i * 26, top + 4, P); }
      if (best) text(ctx, 'BEST ' + best, mode === 'idle' ? cx : maxX(), mode === 'idle' ? H / 2 - 92 : top + 46, 3, '#8A93A8', mode === 'idle' ? 'center' : 'right');
      if (mode === 'idle') {
        // legend: what each thing is worth
        const lx = cx - 96, ly = H / 2 + 46;
        sprite(ctx, SPR.coin, lx, ly, P); text(ctx, '+1', lx + 32, ly + 4, 3, PAL.c);
        sprite(ctx, SPR.star, lx + 70, ly - 2, P); text(ctx, '+5', lx + 106, ly + 4, 3, PAL.o);
        sprite(ctx, SPR.bug, lx + 146, ly, P); sprite(ctx, SPR.heartOff, lx + 180, ly + 4, 3);
      }
      if (mode === 'over') text(ctx, String(score), cx, H / 2 - 110, 12, score && score >= best ? PAL.o : '#0B0D12', 'center');
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      step(dt); draw();
      raf = visible && !document.hidden ? requestAnimationFrame(frame) : 0;
    }
    function kick() { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }

    // controls: pointer anywhere over the game, a finger, or the arrow keys
    const toX = (e) => { const r = cv.getBoundingClientRect(); pl.tx = e.clientX - r.left - pl.w / 2; };
    const playing = (on) => host.classList.toggle('playing', on);
    cv.addEventListener('pointermove', toX);
    cv.addEventListener('pointerdown', (e) => { toX(e); if (mode !== 'play') return; cv.setPointerCapture?.(e.pointerId); });
    cv.addEventListener('touchmove', (e) => { if (mode === 'play') e.preventDefault(); }, { passive: false });
    cv.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') { keys.l = true; e.preventDefault(); }
      if (e.key === 'ArrowRight' || e.key === 'd') { keys.r = true; e.preventDefault(); }
      if ((e.key === ' ' || e.key === 'Enter') && mode !== 'play') { e.preventDefault(); start(); }
    });
    cv.addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'a') keys.l = false; if (e.key === 'ArrowRight' || e.key === 'd') keys.r = false; });
    cv.addEventListener('blur', () => { keys.l = keys.r = false; });
    btn.addEventListener('click', start);
    new ResizeObserver(() => { size(); draw(); }).observe(host);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(host);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
    size(); kick();
    return { start };
  }

  window.TokenRain = { mount };
})();
