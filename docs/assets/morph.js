// Tokard icon morphs. Icons are stroked on a 24-unit grid and change shape only when their meaning
// changes (menu → close, copy → done, plus → minus, run → working → done).
// The morphing itself is Morphicons (MIT, https://www.morphicons.com), loaded from jsDelivr.
// If it can't load, icons simply swap, so nothing depends on it.
(() => {
  'use strict';
  const I = {
    menu: 'M4 7h16M4 12h16M4 17h16',
    x: 'M6 6l12 12M18 6L6 18',
    copy: 'M9 9h11v11H9zM15 5V4H4v11h1',
    check: 'M4 12.5l5 5L20 6.5',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    play: 'M8 5v14l11-7z',
    busy: 'M4 12h3M10.5 12h3M17 12h3',
    arrow: 'M4 12h15M13 6l6 6-6 6',
  };
  let lib = null;
  const live = new WeakMap();
  function to(path, name, spring) {
    if (!path || !I[name]) return;
    const cur = path.getAttribute('data-icon');
    if (cur === name) return;
    path.setAttribute('data-icon', name);
    if (lib && I[cur]) {
      let h = live.get(path);
      if (!h) { h = lib.createMorph(path, I[cur], { reducedMotion: 'user' }); live.set(path, h); }
      h.morphTo(I[name], spring || 'snappy');
    } else path.setAttribute('d', I[name]);
  }
  const svg = (name) => `<svg class="mi" viewBox="0 0 24 24" aria-hidden="true"><path data-icon="${name}" d="${I[name]}"/></svg>`;
  const ready = import('https://cdn.jsdelivr.net/npm/morphicons@1.7.1/dist/dom.js').then((m) => { lib = m; return true; }, () => false);
  window.Morph = { I, to, svg, ready };
})();
