// A fake DeepSeek + BytePlus ModelArk for testing the whole stack without real keys.
// Point new-api channels at it:  DeepSeek base URL  http://<host>:9100
//                                VolcEngine base URL http://<host>:9100
// Run: node dev/mock-upstream.mjs   (PORT=9100 by default)

import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockChatChunks } from '../lib/mock.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(HERE, '..', 'public', 'samples');
const PORT = parseInt(process.env.PORT || '9100', 10);
const PUBLIC_BASE = process.env.PUBLIC_BASE || `http://127.0.0.1:${PORT}`;
const tasks = new Map();
let seq = 0;

function body(req) {
  return new Promise((resolve) => {
    const parts = [];
    req.on('data', (c) => parts.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch { resolve({}); }
    });
  });
}
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
function log(req, extra) {
  console.log(new Date().toISOString(), req.method, req.url, extra ? JSON.stringify(extra).slice(0, 400) : '');
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (req.method === 'GET' && /^\/(v1\/)?models$/.test(p)) {
    log(req);
    return json(res, 200, { object: 'list', data: [{ id: 'deepseek-flash', object: 'model' }] });
  }

  if (req.method === 'POST' && /^\/(v1\/)?chat\/completions$/.test(p)) {
    const b = await body(req);
    const last = b.messages?.[b.messages.length - 1];
    log(req, { model: b.model, stream: b.stream, tools: (b.tools || []).map((t) => t.function?.name), last: last?.role, hasImage: JSON.stringify(b.messages || '').includes('image_url') });
    const chunks = mockChatChunks(b.messages || [], b.tools);
    const base = { id: 'chatcmpl-mock', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: b.model };
    if (b.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      for (const c of chunks) {
        res.write('data: ' + JSON.stringify({ ...base, ...c }) + '\n\n');
        await new Promise((r) => setTimeout(r, 15));
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    const text = chunks.map((c) => c.choices?.[0]?.delta?.content || '').join('');
    return json(res, 200, { id: 'chatcmpl-mock', object: 'chat.completion', model: b.model, choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 } });
  }

  if (req.method === 'POST' && p === '/api/v3/images/generations') {
    const b = await body(req);
    log(req, { model: b.model, size: b.size, hasImage: !!b.image, prompt: (b.prompt || '').slice(0, 60) });
    return json(res, 200, {
      model: b.model,
      created: Math.floor(Date.now() / 1000),
      data: [{ url: `${PUBLIC_BASE}/files/koi.png`, size: '2048x1152' }],
      usage: { generated_images: 1, output_tokens: 9216, total_tokens: 9216 },
    });
  }

  if (req.method === 'POST' && p === '/api/v3/contents/generations/tasks') {
    const b = await body(req);
    const id = 'cgt-mock-' + (++seq);
    tasks.set(id, { created: Date.now(), body: b });
    log(req, { id, model: b.model, duration: b.duration, resolution: b.resolution, ratio: b.ratio, content: (b.content || []).map((c) => c.type) });
    return json(res, 200, { id });
  }

  const m = p.match(/^\/api\/v3\/contents\/generations\/tasks\/(.+)$/);
  if (req.method === 'GET' && m) {
    const t = tasks.get(m[1]);
    if (!t) return json(res, 404, { error: { code: 'NotFound', message: 'task not found' } });
    const elapsed = Date.now() - t.created;
    log(req, { id: m[1], elapsed });
    if (elapsed < 3000) return json(res, 200, { id: m[1], model: t.body.model, status: 'running' });
    return json(res, 200, {
      id: m[1], model: t.body.model, status: 'succeeded',
      content: { video_url: `${PUBLIC_BASE}/files/koi.mp4` },
      usage: { completion_tokens: 108000, total_tokens: 108000 },
      resolution: '720p', ratio: t.body.ratio || '16:9', duration: t.body.duration || 5,
    });
  }

  if (req.method === 'GET' && (p === '/files/koi.png' || p === '/files/koi.mp4')) {
    const file = join(SAMPLES, p.slice(7));
    const size = statSync(file).size;
    log(req);
    res.writeHead(200, { 'Content-Type': p.endsWith('.png') ? 'image/png' : 'video/mp4', 'Content-Length': size });
    return createReadStream(file).pipe(res);
  }

  log(req, { unhandled: true });
  json(res, 404, { error: { message: 'mock: no route for ' + req.method + ' ' + p } });
}).listen(PORT, () => console.log('mock upstream on :' + PORT));
