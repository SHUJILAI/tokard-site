// Stripe Checkout, called directly over HTTPS (no SDK). The price always comes from
// our database, never from the browser. Cards are only issued from a signed webhook,
// never from the success page, and every webhook event is processed once.

import { createHmac } from 'node:crypto';
import { safeEqual } from './security.mjs';

function form(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out); else out.append(key, String(v));
  }
  return out;
}

export function createStripe({ secretKey, webhookSecret, apiBase = 'https://api.stripe.com' }) {
  async function call(method, path, params, idempotencyKey) {
    if (!secretKey) throw new Error('Payments are not configured (STRIPE_SECRET_KEY).');
    const res = await fetch(apiBase + path, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-06-20',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: params ? form(params) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error?.message || `Stripe ${res.status}`), { status: res.status });
    return data;
  }
  return {
    // one line item, priced by us; the session can't outlive the offer it sells
    checkout({ orderId, email, name, cents, successUrl, cancelUrl, expiresAt }) {
      return call('POST', '/v1/checkout/sessions', {
        mode: 'payment',
        customer_email: email,
        client_reference_id: orderId,
        success_url: successUrl,
        cancel_url: cancelUrl,
        expires_at: Math.floor(Math.max(Date.now() + 31 * 60e3, Math.min(expiresAt, Date.now() + 23 * 3600e3)) / 1000),
        line_items: { 0: { quantity: 1, price_data: { currency: 'usd', unit_amount: cents, product_data: { name } } } },
        metadata: { order_id: orderId },
        payment_intent_data: { metadata: { order_id: orderId } },
        payment_method_types: { 0: 'card' },
        allow_promotion_codes: 'false',
      }, `checkout-${orderId}`);
    },
    paymentIntent(id) { return call('GET', `/v1/payment_intents/${encodeURIComponent(id)}?expand[]=latest_charge`); },
    refund(paymentIntent, reason) { return call('POST', '/v1/refunds', { payment_intent: paymentIntent, reason: reason || 'requested_by_customer' }, `refund-${paymentIntent}`); },

    // Stripe-Signature: t=..., v1=...  (HMAC-SHA256 of "t.rawBody"; 5 minutes of tolerance)
    verify(raw, header) {
      if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set.');
      const parts = Object.fromEntries(String(header || '').split(',').map((p) => p.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
      const sigs = String(header || '').split(',').filter((p) => p.trim().startsWith('v1=')).map((p) => p.trim().slice(3));
      const t = parseInt(parts.t, 10);
      if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) return null;
      const expected = createHmac('sha256', webhookSecret).update(`${t}.${raw.toString('utf8')}`).digest('hex');
      if (!sigs.some((s) => safeEqual(s, expected))) return null;
      try { return JSON.parse(raw.toString('utf8')); } catch { return null; }
    },
  };
}
