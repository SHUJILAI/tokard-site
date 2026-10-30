// One-time setup of the new-api gateway for ChinaAPI.
// Creates the admin, sets the brand and the sign-up credit, adds the DeepSeek and
// BytePlus channels with the text / image / video model names, sets prices, creates
// the Starter and Pro plans and (optionally) a Studio trial key.
//
// Usage (Node 20+):
//   NEWAPI_URL=https://admin.chinaapi.ai ADMIN_USER=admin ADMIN_PASS='...' \
//   DEEPSEEK_API_KEY=sk-... BYTEPLUS_API_KEY=... \
//   SITE_URL=https://chinaapi.ai API_URL=https://api.chinaapi.ai \
//   node scripts/init-newapi.mjs
//
// It is safe to run again: existing channels with the same name are updated, not duplicated.

const env = process.env;
const BASE = (env.NEWAPI_URL || 'http://localhost:3000').replace(/\/+$/, '');
const ADMIN_USER = env.ADMIN_USER || 'admin';
const ADMIN_PASS = env.ADMIN_PASS || '';
const SITE_URL = (env.SITE_URL || '').replace(/\/+$/, '');
const API_URL = (env.API_URL || '').replace(/\/+$/, '');
const QUOTA_PER_USD = 500000; // new-api's default QuotaPerUnit
const NEW_USER_CREDIT = parseFloat(env.NEW_USER_CREDIT || '5'); // USD, shown on the website as "$5 free credit"

// Monthly plans shown on the Pricing page and bought in the Console. credit = usage
// allowance per month in USD. With a Stripe Price ID the plan is paid by card;
// without one it can be paid from the account balance.
const PLANS = [
  { title: 'Starter', price: 20, credit: parseFloat(env.STARTER_CREDIT || '20'), stripe: env.STRIPE_PRICE_STARTER || '', sort: 2 },
  { title: 'Pro', price: 100, credit: parseFloat(env.PRO_CREDIT || '100'), stripe: env.STRIPE_PRICE_PRO || '', sort: 1 },
];

// new-api's Doubao plugin knows Seedream/Seedance by these names (it uses them for
// billing and request checks). The website's API edge turns "image" and "video" into
// them, and the channel mapping below turns them into BytePlus's own model IDs.
export const IMAGE_MODEL = 'doubao-seedream-5-0-pro-260628';
export const VIDEO_MODEL = 'doubao-seedance-2-5-260628';

function mapping(pairs) {
  return Object.fromEntries(Object.entries(pairs).filter(([from, to]) => to && to !== from));
}

const CHANNELS = [
  {
    name: 'DeepSeek',
    type: 43, // DeepSeek
    key: env.DEEPSEEK_API_KEY,
    base_url: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    models: ['text'],
    mapping: { text: env.DEEPSEEK_MODEL || 'deepseek-flash' },
  },
  {
    name: 'BytePlus',
    type: 45, // VolcEngine (BytePlus ModelArk uses the same wire format)
    key: env.BYTEPLUS_API_KEY,
    base_url: env.BYTEPLUS_BASE_URL || 'https://ark.ap-southeast.bytepluses.com',
    models: [IMAGE_MODEL, VIDEO_MODEL],
    mapping: mapping({
      [IMAGE_MODEL]: env.SEEDREAM_MODEL || 'seedream-5-0-pro-260628',
      [VIDEO_MODEL]: env.SEEDANCE_MODEL || 'dreamina-seedance-2-5-260628',
    }),
  },
  // Optional extras, only created when a key is given. They are not shown on the website.
  {
    name: 'GLM (optional)',
    type: 26, // Zhipu v4
    key: env.ZAI_API_KEY,
    base_url: env.ZAI_BASE_URL || 'https://api.z.ai/api/paas/v4',
    models: ['glm-5.3'],
    mapping: {},
  },
  {
    name: 'Kimi (optional)',
    type: 25, // Moonshot
    key: env.MOONSHOT_API_KEY,
    base_url: env.MOONSHOT_BASE_URL || 'https://api.moonshot.ai',
    models: ['kimi-k3'],
    mapping: {},
  },
];

// Prices. Text uses new-api ratios (1.0 = $2 per 1M input tokens).
const PRICING = {
  text: { ModelRatio: 0.15, CompletionRatio: 4, CacheRatio: 0.02 }, // $0.30 in, $1.20 out, $0.006 cached
  [IMAGE_MODEL]: { ModelPrice: 0.045 }, // USD per image
  // Seedance reports tokens: 720p ≈ 21,600 tokens per second, so $10.65 per 1M tokens ≈ $0.23 per second.
  [VIDEO_MODEL]: { 'billing_setting.billing_mode': 'tiered_expr', 'billing_setting.billing_expr': 'tier("base", u("tokens") * 10.65 / 1000000)' },
};

let accessToken = '';

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = 'Bearer ' + accessToken;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { success: false, message: text.slice(0, 300) }; }
  if (!res.ok || data.success === false) {
    const err = new Error(`${method} ${path} → ${res.status}: ${data.message || text.slice(0, 300)}`);
    err.data = data;
    throw err;
  }
  return data.data;
}

function step(msg) { console.log('•', msg); }

async function main() {
  if (!ADMIN_PASS) throw new Error('Set ADMIN_PASS (the admin password to create or use).');

  const setup = await api('GET', '/api/setup');
  if (!setup.status) {
    step('Creating the admin account');
    await api('POST', '/api/setup', { username: ADMIN_USER, password: ADMIN_PASS, confirmPassword: ADMIN_PASS, SelfUseModeEnabled: false, DemoSiteEnabled: false });
  }

  step('Signing in');
  const login = await api('POST', '/api/user/login', { username: ADMIN_USER, password: ADMIN_PASS });
  accessToken = login.access_token;
  if (!accessToken) throw new Error('Login did not return an access token: ' + JSON.stringify(login).slice(0, 300));

  step('Setting the brand');
  const options = { SystemName: 'ChinaAPI', QuotaForNewUser: String(Math.round(NEW_USER_CREDIT * QUOTA_PER_USD)) };
  if (SITE_URL) {
    options.Logo = SITE_URL + '/assets/brand/chinaapi-mark.svg';
    options.HomePageContent = SITE_URL;
  }
  if (API_URL) options.ServerAddress = API_URL;
  for (const [key, value] of Object.entries(options)) await api('PUT', '/api/option/', { key, value });

  step('Adding channels');
  const existing = (await api('GET', '/api/channel/?p=0&page_size=100')) || {};
  const list = Array.isArray(existing) ? existing : existing.items || existing.data || [];
  for (const ch of CHANNELS) {
    if (!ch.key) {
      if (ch.name.includes('optional')) continue;
      throw new Error(`Missing API key for the ${ch.name} channel.`);
    }
    const payload = {
      name: ch.name,
      type: ch.type,
      key: ch.key,
      base_url: ch.base_url,
      models: ch.models.join(','),
      model_mapping: Object.keys(ch.mapping).length ? JSON.stringify(ch.mapping) : '',
      group: 'default',
      status: 1,
    };
    const found = list.find((c) => c.name === ch.name);
    if (found) {
      const { status, ...update } = payload; // status cannot be changed through an update
      await api('PUT', '/api/channel/', { ...update, id: found.id });
      console.log(`  updated ${ch.name} (models: ${payload.models})`);
    } else {
      await api('POST', '/api/channel/', { mode: 'single', channel: payload });
      console.log(`  added ${ch.name} (models: ${payload.models})`);
    }
  }

  step('Setting prices');
  const snapshot = await api('GET', '/api/option/model_pricing');
  const versions = Object.fromEntries((snapshot.entries || []).map((e) => [e.model_name, e.version]));
  const changes = Object.entries(PRICING).map(([model, pricing]) => ({ model_name: model, expected_version: versions[model] || snapshot.empty_version || '', pricing }));
  await api('PATCH', '/api/option/model_pricing', { changes });

  step('Setting up plans');
  try {
    const existingPlans = (await api('GET', '/api/subscription/admin/plans')) || [];
    const listPlans = (Array.isArray(existingPlans) ? existingPlans : existingPlans.items || []).map((x) => x.plan || x);
    for (const p of PLANS) {
      const plan = {
        title: p.title, price_amount: p.price, currency: 'USD', duration_unit: 'month', duration_value: 1,
        total_amount: Math.round(p.credit * QUOTA_PER_USD), quota_reset_period: 'never', enabled: true, sort_order: p.sort,
        allow_balance_pay: true, stripe_price_id: p.stripe,
      };
      const found = listPlans.find((x) => x.title === p.title);
      if (found) await api('PUT', `/api/subscription/admin/plans/${found.id}`, { plan: { ...found, ...plan, id: found.id } });
      else await api('POST', '/api/subscription/admin/plans', { plan });
      console.log(`  ${found ? 'updated' : 'added'} ${p.title}: $${p.price}/month, $${p.credit} of usage${p.stripe ? ', card via Stripe' : ', paid from balance until a Stripe price is set'}`);
    }
  } catch (err) {
    console.log('  skipped plans:', err.message);
  }

  if (env.CREATE_STUDIO_TRIAL_KEY === '1') {
    step('Creating the Studio trial key');
    await api('POST', '/api/token/', { name: 'studio-trial', remain_quota: 5 * 500000, unlimited_quota: false, expired_time: -1, group: '' });
    const tokens = await api('GET', '/api/token/?p=0&size=50');
    const items = Array.isArray(tokens) ? tokens : tokens.items || tokens.data || [];
    const t = items.find((x) => x.name === 'studio-trial');
    const key = t ? await api('POST', `/api/token/${t.id}/key`) : null;
    console.log('  STUDIO_TRIAL_KEY=' + (key?.key ? 'sk-' + key.key.replace(/^sk-/, '') : '(open the console to copy it)'));
  }

  console.log(`\nDone. Two things only you can do, in the admin console:
  1. Payment settings: read and confirm the compliance statement. Until then redeem codes,
     card top-ups and plans stay switched off for everyone.
  2. Payment settings → Stripe: add your keys; set the webhook to ${BASE}/api/stripe/webhook.
Then send one test call per model.`);
}

main().catch((err) => {
  console.error('\nSetup stopped:', err.message);
  process.exit(1);
});
