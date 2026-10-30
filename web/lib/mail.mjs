// Sign-in code emails. Sent through Resend's HTTP API (set RESEND_API_KEY and
// MAIL_FROM, with SPF, DKIM and DMARC set up for the sending domain).
// MAIL_DEV=1 prints codes to the server log instead; it refuses to run in production.

export function createMailer({ apiKey, from, dev, production }) {
  if (dev && production) throw new Error('MAIL_DEV must not be on in production.');
  return {
    async sendCode(to, code) {
      if (dev) { console.log(`[mail:dev] code for ${to}: ${code}`); return; }
      if (!apiKey || !from) throw new Error('Email is not configured (RESEND_API_KEY, MAIL_FROM).');
      const text = `Your Tokard code is ${code}\n\nIt works for 10 minutes. If you didn't ask for it, ignore this email; nobody can sign in without the code.\n\nTokard will never ask you for this code by phone or chat.`;
      const html = `<div style="font:16px/1.5 -apple-system,Segoe UI,sans-serif;color:#0B0D12;max-width:420px">
        <p style="margin:0 0 16px">Your Tokard code</p>
        <p style="margin:0 0 16px;font:600 32px/1 ui-monospace,Menlo,monospace;letter-spacing:.2em">${code}</p>
        <p style="margin:0;color:#474E5C;font-size:14px">It works for 10 minutes. If you didn't ask for it, ignore this email; nobody can sign in without the code. Tokard will never ask you for it by phone or chat.</p></div>`;
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject: `${code} is your Tokard code`, text, html }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`Email provider said ${res.status}`);
    },
  };
}
