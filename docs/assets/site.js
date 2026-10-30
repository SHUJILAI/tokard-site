// Shared by every Tokard page: config, navigation state, the signed-in session
// and the account API (served by new-api behind our web server).
// Without a server (a static preview) or with WEB_DEMO_MODE=1, a built-in demo
// account answers instead, so every page can be clicked through.
(() => {
  'use strict';

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  };

  const MODELS = {
    text: { label: 'Text', name: 'DeepSeek V4.1 Flash', logo: 'assets/brand/deepseek.svg', price: '$0.30 in · $1.20 out per 1M tokens' },
    image: { label: 'Image', name: 'Seedream 5.0 Pro', logo: 'assets/brand/dreamina.png', price: '$0.045 per image' },
    video: { label: 'Video', name: 'Seedance 2.5', logo: 'assets/brand/seed.png', price: '$0.23 per second (720p)' },
  };
  const PRICES = { textIn: 0.30, textOut: 1.20, textCached: 0.006, image: 0.045, videoSecond: 0.23 };

  const ready = (async () => {
    const cfg = { demo: true, serverless: true, apiUrl: 'https://api.tokard.ai', quotaPerUnit: 500000, newUserCredit: 5 };
    try {
      const r = await fetch('config.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('no server');
      Object.assign(cfg, await r.json(), { serverless: false });
    } catch { /* static preview */ }
    return cfg;
  })();

  // ---------- session ----------
  const SESSION_KEY = 'chinaapi.session';
  const session = {
    get() { return store.get(SESSION_KEY, null); },
    set(s) { store.set(SESSION_KEY, s); },
    clear() { store.del(SESSION_KEY); },
    fromLogin(data) {
      const s = {
        token: data.access_token,
        expires: data.access_expires_at ? data.access_expires_at * (data.access_expires_at < 1e12 ? 1000 : 1) : Date.now() + 14 * 60 * 1000,
        sid: (data.session && (data.session.id || data.session.sid || data.session.session_id)) || (typeof data.session === 'string' ? data.session : ''),
        user: data.user ? { id: data.user.id, username: data.user.username, display_name: data.user.display_name || '' } : null,
      };
      session.set(s);
      return s;
    },
  };

  // ---------- account API ----------
  class ApiError extends Error {
    constructor(message, status, data) { super(message); this.status = status; this.data = data; }
  }

  let refreshing = null;
  async function refresh() {
    const s = session.get();
    if (!s) throw new ApiError('Signed out', 401);
    if (!refreshing) {
      refreshing = (async () => {
        const headers = {};
        if (s.sid) headers['X-Auth-Session'] = String(s.sid);
        const r = await fetch('/api/user/auth/refresh', { method: 'POST', headers, credentials: 'same-origin' });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || data.success === false || !data.data || !data.data.access_token) {
          session.clear();
          throw new ApiError('Your session ended. Sign in again.', 401);
        }
        return session.fromLogin({ ...data.data, user: data.data.user || s.user, session: data.data.session || { id: s.sid } });
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function real(method, path, body, opts = {}) {
    let s = session.get();
    if (s && !opts.anonymous && s.expires && s.expires - Date.now() < 60 * 1000) {
      try { s = await refresh(); } catch { s = null; }
    }
    const send = async (sess) => {
      const headers = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (sess && !opts.anonymous) {
        headers.Authorization = 'Bearer ' + sess.token;
        if (sess.user && sess.user.id) headers['New-Api-User'] = String(sess.user.id);
      }
      return fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
    };
    let r = await send(s);
    if (r.status === 401 && s && !opts.anonymous) {
      s = await refresh();
      r = await send(s);
    }
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { success: false, message: r.ok ? 'Unexpected reply from the server.' : `The server answered ${r.status}.` }; }
    if (r.status === 401) { session.clear(); throw new ApiError(data.message || 'Sign in again.', 401, data); }
    if (r.status === 429) throw new ApiError('Too many tries from this network. Wait a few minutes, then try again.', 429, data);
    if (!r.ok || data.success === false) throw new ApiError(data.message || `Request failed (${r.status})`, r.status, data);
    return data.data !== undefined ? data.data : data;
  }

  // ---------- demo account (no server) ----------
  const demo = (() => {
    const now = Math.floor(Date.now() / 1000);
    const QPU = 500000;
    const state = {
      user: { id: 1, username: 'demo', display_name: 'Demo team', quota: 4.18 * QPU, used_quota: 0.82 * QPU, request_count: 23, email: 'demo@example.com' },
      tokens: [{ id: 1, name: 'Default key', key: 'sk-demo' + 'x'.repeat(30) + 'Q7f2', status: 1, created_time: now - 86400 * 3, accessed_time: now - 600, used_quota: 0.82 * QPU, unlimited_quota: true, remain_quota: 0 }],
      redeemed: false,
    };
    const logs = [
      { created_at: now - 600, model_name: 'video', quota: 1.15 * QPU, prompt_tokens: 0, completion_tokens: 108000, use_time: 74, token_name: 'Default key', type: 2 },
      { created_at: now - 900, model_name: 'image', quota: 0.045 * QPU, prompt_tokens: 0, completion_tokens: 0, use_time: 9, token_name: 'Default key', type: 2 },
      { created_at: now - 1500, model_name: 'text', quota: 0.00028 * QPU, prompt_tokens: 412, completion_tokens: 128, use_time: 2, token_name: 'Default key', type: 2 },
      { created_at: now - 3600, model_name: 'text', quota: 0.0011 * QPU, prompt_tokens: 2210, completion_tokens: 380, use_time: 3, token_name: 'Default key', type: 2 },
      { created_at: now - 7200, model_name: 'image', quota: 0.045 * QPU, prompt_tokens: 0, completion_tokens: 0, use_time: 11, token_name: 'Default key', type: 2 },
    ];
    const data = [
      { model_name: 'text', count: 18, quota: 0.0921 * QPU, token_used: 286000, created_at: now - 86400 },
      { model_name: 'image', count: 4, quota: 0.18 * QPU, token_used: 0, created_at: now - 3600 },
      { model_name: 'video', count: 1, quota: 1.15 * QPU, token_used: 108000, created_at: now - 600 },
    ];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const err = (m, s = 400) => { throw new ApiError(m, s); };
    async function call(method, path, body) {
      await wait(180);
      const p = path.split('?')[0];
      if (p === '/api/status') return { system_name: 'Tokard', quota_per_unit: QPU, register_enabled: true, password_register_enabled: true, email_verification: false, turnstile_check: false, password_login_encryption_enabled: false };
      if (p === '/api/user/login' || p === '/api/user/register') {
        if (!body || !body.username || !body.password) err('Enter a username and password.');
        if (p === '/api/user/register') return {};
        return { access_token: 'demo', access_expires_at: Math.floor(Date.now() / 1000) + 3600 * 24, session: { id: 'demo' }, user: { id: 1, username: body.username } };
      }
      if (p === '/api/user/auth/logout') return {};
      if (p === '/api/user/self') return { ...state.user };
      if (p === '/api/token/' && method === 'GET') return { items: state.tokens.map((t) => ({ ...t, key: t.key.slice(0, 7) + '**********' + t.key.slice(-4) })), total: state.tokens.length };
      if (p === '/api/token/' && method === 'POST') {
        const id = state.tokens.reduce((m, t) => Math.max(m, t.id), 0) + 1;
        state.tokens.push({ id, name: (body && body.name) || 'Key ' + id, key: 'sk-demo' + Math.random().toString(36).slice(2).padEnd(30, 'x') + 'Ab' + id, status: 1, created_time: Math.floor(Date.now() / 1000), accessed_time: 0, used_quota: 0, unlimited_quota: true });
        return {};
      }
      let m = p.match(/^\/api\/token\/(\d+)\/key$/);
      if (m) { const t = state.tokens.find((x) => x.id === +m[1]); if (!t) err('Key not found', 404); return { key: t.key.replace(/^sk-/, '') }; }
      m = p.match(/^\/api\/token\/(\d+)$/);
      if (m && method === 'DELETE') { state.tokens = state.tokens.filter((x) => x.id !== +m[1]); return {}; }
      if (p === '/api/log/self') return { items: logs, total: logs.length, page: 1, page_size: 10 };
      if (p === '/api/data/self') return data;
      if (p === '/api/user/topup/info') return { enable_stripe_topup: true, enable_redemption: true, stripe_min_topup: 5, amount_options: [10, 20, 50, 100], pay_methods: [{ type: 'stripe', name: 'Stripe' }] };
      if (p === '/api/user/topup/self') return { items: state.redeemed || (state.subs && state.subs.length) ? [{ id: 1 }] : [], total: state.redeemed ? 1 : 0 };
      if (p === '/api/user/stripe/pay') return { pay_link: '' };
      if (p === '/api/user/topup') {
        if (!body || !body.key) err('Enter a code.');
        state.redeemed = true; state.user.quota += 10 * QPU; return 10 * QPU;
      }
      if (p === '/api/subscription/plans') return [
        { plan: { id: 2, title: 'Pro', price_amount: 100, duration_unit: 'month', duration_value: 1, total_amount: 100 * QPU, enabled: true, allow_balance_pay: true } },
        { plan: { id: 1, title: 'Starter', price_amount: 20, duration_unit: 'month', duration_value: 1, total_amount: 20 * QPU, enabled: true, allow_balance_pay: true } },
      ];
      if (p === '/api/subscription/self') return { subscriptions: state.subs || [] };
      if (p === '/api/subscription/balance/pay') {
        const price = body.plan_id === 2 ? 100 : 20;
        if (state.user.quota < price * QPU) err('Your balance is too low for this plan.');
        state.user.quota -= price * QPU;
        state.subs = [{ plan_id: body.plan_id, amount_total: price * QPU, amount_used: 0, status: 'active', end_time: now + 30 * 86400 }];
        return null;
      }
      if (p === '/api/subscription/stripe/pay') return { pay_link: '' };
      err('Not available in the demo', 404);
    }
    return { call };
  })();

  async function account(method, path, body, opts) {
    const cfg = await ready;
    if (cfg.serverless || cfg.demo) return demo.call(method, path, body);
    return real(method, path, body, opts);
  }

  // The API key Studio and Playground use in this browser.
  const KEY = 'chinaapi.key';
  const apiKey = {
    get() { return store.get(KEY, ''); },
    set(k) { store.set(KEY, k); },
    clear() { store.del(KEY); },
    // Saved key, else the signed-in account's first key (saved for next time).
    async resolve() {
      const saved = apiKey.get();
      if (saved) return saved;
      const cfg = await ready;
      if (!session.get() && !cfg.serverless && !cfg.demo) return '';
      try {
        const list = await account('GET', '/api/token/?p=1&size=20');
        const items = Array.isArray(list) ? list : list.items || list.data || [];
        const t = items.find((x) => x.status === 1) || items[0];
        if (!t) return '';
        const k = await account('POST', `/api/token/${t.id}/key`);
        const full = 'sk-' + String(k.key || k).replace(/^sk-/, '');
        apiKey.set(full);
        return full;
      } catch { return ''; }
    },
  };

  function copy(text, btn, label = 'Copy') {
    // icon buttons morph copy → check and back; text buttons say so in words
    const icon = btn && btn.querySelector('path[data-icon]');
    const done = (t) => {
      if (!btn) return;
      if (icon && window.Morph) { window.Morph.to(icon, t === 'Copied' ? 'check' : 'copy'); btn.setAttribute('aria-label', t); setTimeout(() => { window.Morph.to(icon, 'copy'); btn.setAttribute('aria-label', label); }, 1600); return; }
      btn.textContent = t; setTimeout(() => { btn.textContent = label; }, 1800);
    };
    try {
      navigator.clipboard.writeText(text).then(() => done('Copied'), () => done('Select and copy'));
    } catch { done('Select and copy'); }
  }

  const usd = (v) => {
    if (!isFinite(v)) return '$0.00';
    if (v === 0) return '$0.00';
    if (Math.abs(v) < 0.01) return '$' + v.toFixed(4).replace(/0+$/, '');
    if (Math.abs(v) < 1) return '$' + v.toFixed(3).replace(/0$/, '');
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Header: mark the current page and turn "Get API key" into "Console" once signed in.
  function initNav() {
    const here = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
    document.querySelectorAll('nav.links a[data-page], .topbar [data-page]').forEach((a) => {
      if (a.dataset.page === here) a.setAttribute('aria-current', 'page');
    });
    const bar = document.querySelector('.topbar');
    if (bar) {
      const onScroll = () => bar.classList.toggle('scrolled', scrollY > 8);
      addEventListener('scroll', onScroll, { passive: true }); onScroll();
      const mb = bar.querySelector('.menu-btn');
      if (mb) mb.addEventListener('click', () => {
        const open = bar.classList.toggle('open');
        mb.setAttribute('aria-expanded', open ? 'true' : 'false'); mb.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
        if (window.Morph) window.Morph.to(mb.querySelector('path[data-icon]'), open ? 'x' : 'menu');
      });
    }
    if (session.get()) document.querySelectorAll('.js-account').forEach((a) => { a.textContent = 'Console'; });
    ready.then((cfg) => {
      document.querySelectorAll('.js-api').forEach((el) => { el.textContent = cfg.apiUrl.replace(/\/+$/, '') + '/v1'; });
      document.querySelectorAll('.js-demo').forEach((el) => { el.hidden = !(cfg.serverless || cfg.demo); });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNav); else initNav();

  // wide headlines: a hero headline is set line by line without wrapping, so shrink it
  // a little whenever its longest line would not fit the column
  function fitHeadlines() {
    document.querySelectorAll('h1.display').forEach((h) => {
      const lines = [...h.querySelectorAll(':scope > .l > span')]; if (!lines.length) return;
      h.style.fontSize = '';
      const avail = h.clientWidth, widest = Math.max(...lines.map((x) => x.offsetWidth));
      if (avail && widest > avail) h.style.fontSize = (parseFloat(getComputedStyle(h).fontSize) * (avail / widest) * 0.98).toFixed(1) + 'px';
    });
  }
  const fitSoon = () => requestAnimationFrame(fitHeadlines);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fitSoon); else fitSoon();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSoon);
  addEventListener('resize', fitSoon);

  window.ChinaAPI = { store, MODELS, PRICES, ready, session, account, apiKey, copy, usd, ApiError };
})();
