// Cards become keys in the gateway (new-api). One dedicated gateway user, the
// "issuer", owns every card's key; its personal access token is limited to the
// "API keys" scope, so even if it leaked it could not read users, prices or channels.
// Each key gets a hard quota (the card's face value), one allowed model and no expiry.

const QUOTA_PER_USD_DEFAULT = 500000;

export function createIssuer({ baseUrl, token, quotaPerUsd = QUOTA_PER_USD_DEFAULT, models }) {
  const root = baseUrl.replace(/\/+$/, '');
  async function call(path, init = {}) {
    if (!token) throw new Error('Card issuing is not configured (ISSUER_TOKEN).');
    const res = await fetch(root + path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw Object.assign(new Error(`Gateway ${path} failed: ${data.message || res.status}`), { status: res.status });
    return data;
  }
  const items = (d) => (Array.isArray(d.data) ? d.data : d.data?.items || d.data?.data || []);
  const quota = (usd) => Math.round(usd * quotaPerUsd);

  return {
    quotaPerUsd,
    // returns { tokenId, key }
    async create({ cardId, deck, usd }) {
      const name = `card_${cardId}`;
      await call('/api/token/', { method: 'POST', body: JSON.stringify({
        name, remain_quota: quota(usd), unlimited_quota: false, expired_time: -1,
        model_limits_enabled: true, model_limits: models[deck], allow_ips: '', group: '',
      }) });
      const found = items(await call(`/api/token/search?keyword=${encodeURIComponent(name)}&p=0&size=10`)).find((t) => t.name === name);
      if (!found) throw new Error('The gateway did not return the new key.');
      const k = await call(`/api/token/${found.id}/key`, { method: 'POST' });
      const key = 'sk-' + String(k.data?.key || '').replace(/^sk-/, '');
      return { tokenId: found.id, key };
    },
    async get(tokenId) { return (await call(`/api/token/${Number(tokenId)}`)).data; },
    async remainingUsd(tokenId) { const t = await this.get(tokenId); return (t.remain_quota || 0) / quotaPerUsd; },
    async setStatus(tokenId, enabled) { await call('/api/token/?status_only=true', { method: 'PUT', body: JSON.stringify({ id: Number(tokenId), status: enabled ? 1 : 2 }) }); },
    async addUsd(tokenId, usd) {
      const t = await this.get(tokenId);
      await call('/api/token/', { method: 'PUT', body: JSON.stringify({ ...t, remain_quota: (t.remain_quota || 0) + quota(usd) }) });
    },
    async remove(tokenId) { await call(`/api/token/${Number(tokenId)}`, { method: 'DELETE' }); },
  };
}
