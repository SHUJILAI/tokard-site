// Client for the ChinaAPI gateway (new-api). Every call uses the caller's own
// API key, so usage is billed to that user's account in the console.

export class GatewayError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function readError(res) {
  const text = await res.text().catch(() => '');
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  const message = data?.error?.message || data?.message || text.slice(0, 300) || res.statusText;
  return new GatewayError(message, res.status);
}

// Parse an OpenAI-style server-sent event stream into JSON objects.
export async function* parseSSE(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      try { yield JSON.parse(data); } catch { /* ignore keep-alives */ }
    }
  }
}

export function createGateway({ baseUrl, models }) {
  const root = baseUrl.replace(/\/+$/, '');

  function call(path, key, init = {}) {
    const headers = { Authorization: 'Bearer ' + key, ...(init.headers || {}) };
    if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    return fetch(root + path, { ...init, headers });
  }

  async function json(path, key, init) {
    const res = await call(path, key, init);
    if (!res.ok) throw await readError(res);
    return res.json();
  }

  return {
    name: 'gateway',

    async checkKey(key) {
      const data = await json('/v1/models', key);
      return (data.data || []).map((m) => m.id);
    },

    async *chatStream({ key, messages, tools, signal }) {
      const body = { model: models.text, messages, stream: true, stream_options: { include_usage: true } };
      if (tools && tools.length) {
        body.tools = tools;
        body.tool_choice = 'auto';
      }
      const res = await call('/v1/chat/completions', key, { method: 'POST', body: JSON.stringify(body), signal });
      if (!res.ok) throw await readError(res);
      yield* parseSSE(res.body);
    },

    async generateImage({ key, prompt, size, images, signal }) {
      const body = { model: models.image, prompt, size, response_format: 'url', watermark: false };
      if (images && images.length) body.image = images.length === 1 ? images[0] : images;
      const data = await json('/v1/images/generations', key, { method: 'POST', body: JSON.stringify(body), signal });
      const item = (data.data || [])[0];
      if (!item) throw new GatewayError('The image model returned no image', 502);
      return { url: item.url || (item.b64_json ? 'data:image/png;base64,' + item.b64_json : '') };
    },

    async createVideo({ key, prompt, seconds, ratio, images, signal }) {
      const body = {
        model: models.video,
        prompt,
        seconds: String(seconds),
        metadata: { resolution: '720p', ratio, generate_audio: true, watermark: false },
      };
      if (images && images.length) body.images = images;
      const data = await json('/v1/videos', key, { method: 'POST', body: JSON.stringify(body), signal });
      const id = data.id || data.task_id;
      if (!id) throw new GatewayError('The video model did not return a task id', 502);
      return id;
    },

    async getVideo({ key, id, signal }) {
      const data = await json('/v1/videos/' + encodeURIComponent(id), key, { signal });
      const status = String(data.status || '').toLowerCase();
      const progress = typeof data.progress === 'number' ? data.progress : parseInt(data.progress, 10) || 0;
      return {
        status: status === 'succeeded' || status === 'success' ? 'completed' : status,
        progress,
        error: data.error?.message || data.fail_reason || '',
      };
    },

    // Returns the raw fetch Response so the caller can stream it (Range is passed through).
    videoContent({ key, id, range }) {
      const headers = range ? { Range: range } : {};
      return call('/v1/videos/' + encodeURIComponent(id) + '/content', key, { headers });
    },
  };
}
