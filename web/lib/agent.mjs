// The Studio agent. DeepSeek (model "text") holds the conversation and decides
// when to call Seedream (model "image") or Seedance (model "video").

export const MODEL_LABELS = {
  text: 'DeepSeek V4.1 Flash',
  image: 'Seedream 5.0 Pro',
  video: 'Seedance 2.5',
};

const SYSTEM_PROMPT = `You are ChinaAPI Studio, a multimodal assistant. You can talk, read images the user attaches, create images and create videos.

Rules:
- Call generate_image only when the user asks for a picture, poster, logo, illustration, photo or an edit of an image. Write the prompt in English with subject, style, composition, lighting and colour.
- Call generate_video only when the user asks for a video, clip or animation. Describe the subject, the motion and the camera. Default to 5 seconds.
- If the user attached an image and wants it changed, used as a reference or animated, set reference to "attachment". If they mean the image you just made, set reference to "last_image".
- For everything else, answer directly and stay concise.
- After a tool finishes, reply in one or two short sentences. Do not repeat the prompt and do not include links or markdown images; the result is already shown to the user.
- Always reply in the language the user writes in.`;

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Create or edit an image with Seedream 5.0 Pro. The image is shown to the user automatically.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Detailed English description of the image to create.' },
          aspect_ratio: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:3', '3:4'], description: 'Shape of the image. Default 1:1.' },
          reference: { type: 'string', enum: ['none', 'attachment', 'last_image'], description: 'Image to use as a reference or to edit.' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_video',
      description: 'Create a video with sound using Seedance 2.5 (720p). It takes one to a few minutes and is shown to the user automatically.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'English description of the subject, motion and camera.' },
          seconds: { type: 'integer', minimum: 4, maximum: 12, description: 'Length in seconds. Default 5.' },
          aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'], description: 'Default 16:9.' },
          reference: { type: 'string', enum: ['none', 'attachment', 'last_image'], description: 'Image to animate, if any.' },
        },
        required: ['prompt'],
      },
    },
  },
];

// Sizes stay at or under 2.36 megapixels, Seedream's lower price tier.
const IMAGE_SIZES = {
  '1:1': '1536x1536',
  '16:9': '2048x1152',
  '9:16': '1152x2048',
  '4:3': '1760x1320',
  '3:4': '1320x1760',
};

function lastOf(list, pred) {
  for (let i = list.length - 1; i >= 0; i--) if (pred(list[i])) return list[i];
  return undefined;
}

// history items: { role: 'user'|'assistant', text, images?: [url], media?: [{ kind, url, prompt }] }
function toChatMessages(history, { includeImages }) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  const recentUsers = new Set(history.filter((m) => m.role === 'user').slice(-2));
  for (const m of history) {
    if (m.role === 'user') {
      const images = includeImages && recentUsers.has(m) ? m.images || [] : [];
      if (images.length) {
        messages.push({
          role: 'user',
          content: [{ type: 'text', text: m.text || '(image attached)' }].concat(
            images.map((url) => ({ type: 'image_url', image_url: { url } })),
          ),
        });
      } else {
        const note = (m.images || []).length ? ' [the user attached an image]' : '';
        messages.push({ role: 'user', content: (m.text || '') + note });
      }
    } else if (m.role === 'assistant') {
      const notes = (m.media || []).map((x) => `[You created ${x.kind === 'video' ? 'a video' : 'an image'}: ${x.prompt}]`);
      const content = [m.text || '', ...notes].filter(Boolean).join('\n');
      if (content) messages.push({ role: 'assistant', content });
    }
  }
  return messages;
}

function guessRatio(text) {
  const t = (text || '').toLowerCase();
  if (/(9:16|vertical|portrait|竖|手机|story|reel|tiktok)/.test(t)) return '9:16';
  if (/(16:9|wide|landscape|横|banner|cinematic|youtube)/.test(t)) return '16:9';
  return null;
}

export async function runAgent({ gw, key, history, mode = 'auto', emit, signal, media, limits = {} }) {
  const lastUser = lastOf(history, (m) => m.role === 'user');
  if (!lastUser) throw new Error('No message to answer');
  const attachments = lastUser.images || [];
  const lastImage = lastOf(history, (m) => m.role === 'assistant' && (m.media || []).some((x) => x.kind === 'image'));
  const lastImageUrl = lastImage ? lastOf(lastImage.media, (x) => x.kind === 'image').url : null;
  let toolCount = 0;

  function referenceImages(reference) {
    if (reference === 'attachment' && attachments.length) return attachments.slice(0, 4);
    if (reference === 'last_image' && lastImageUrl && /^https?:|^data:/.test(lastImageUrl)) return [lastImageUrl];
    return [];
  }

  async function toolImage(args) {
    const id = 'img_' + (++toolCount);
    const ratio = IMAGE_SIZES[args.aspect_ratio] ? args.aspect_ratio : '1:1';
    emit({ t: 'tool', id, kind: 'image', model: MODEL_LABELS.image, prompt: args.prompt, detail: `${IMAGE_SIZES[ratio]} · ${ratio}` });
    try {
      const { url } = await gw.generateImage({ key, prompt: args.prompt, size: IMAGE_SIZES[ratio], images: referenceImages(args.reference), signal });
      emit({ t: 'image', id, url, prompt: args.prompt });
      return { status: 'ok', result: 'The image was created and is shown to the user.' };
    } catch (err) {
      emit({ t: 'tool_error', id, message: err.message });
      return { status: 'error', error: err.message };
    }
  }

  async function toolVideo(args) {
    const id = 'vid_' + (++toolCount);
    if (limits.video === false) {
      emit({ t: 'tool', id, kind: 'video', model: MODEL_LABELS.video, prompt: args.prompt, detail: '' });
      const message = 'Video is not available on the free trial. Add your own API key to make videos.';
      emit({ t: 'tool_error', id, message });
      return { status: 'error', error: message };
    }
    const seconds = Math.min(12, Math.max(4, parseInt(args.seconds, 10) || 5));
    const ratio = ['16:9', '9:16', '1:1'].includes(args.aspect_ratio) ? args.aspect_ratio : '16:9';
    emit({ t: 'tool', id, kind: 'video', model: MODEL_LABELS.video, prompt: args.prompt, detail: `${seconds} s · 720p · ${ratio} · sound` });
    try {
      const taskId = await gw.createVideo({ key, prompt: args.prompt, seconds, ratio, images: referenceImages(args.reference), signal });
      const started = Date.now();
      const timeoutMs = (limits.videoTimeoutSec || 900) * 1000;
      let last = -1;
      for (;;) {
        if (signal?.aborted) throw new Error('Stopped');
        if (Date.now() - started > timeoutMs) throw new Error('The video is taking longer than expected. Try again later.');
        const st = await gw.getVideo({ key, id: taskId, signal });
        if (st.status === 'completed') break;
        if (st.status === 'failed') throw new Error(st.error || 'The video could not be created');
        // Seedance reports coarse progress; ease it forward by time so the bar keeps moving.
        const byTime = Math.min(95, Math.round(((Date.now() - started) / 1000 / 90) * 100));
        const progress = Math.max(st.progress || 0, byTime);
        if (progress !== last) {
          emit({ t: 'progress', id, progress });
          last = progress;
        }
        await new Promise((r) => setTimeout(r, limits.pollMs || 4000));
      }
      const url = media.register({ key, taskId });
      emit({ t: 'video', id, url, prompt: args.prompt });
      return { status: 'ok', result: 'The video was created and is shown to the user.' };
    } catch (err) {
      emit({ t: 'tool_error', id, message: err.message });
      return { status: 'error', error: err.message };
    }
  }

  // Direct modes skip the planner and go straight to one model.
  if (mode === 'image') {
    const prompt = lastUser.text || 'Recreate this image with more detail';
    const r = await toolImage({ prompt, aspect_ratio: guessRatio(prompt) || '1:1', reference: attachments.length ? 'attachment' : 'none' });
    emit({ t: 'done', models: ['image'], ok: r.status === 'ok' });
    return;
  }
  if (mode === 'video') {
    const prompt = lastUser.text || 'Bring this image to life with gentle motion';
    const r = await toolVideo({ prompt, seconds: 5, aspect_ratio: guessRatio(prompt) || '16:9', reference: attachments.length ? 'attachment' : 'none' });
    emit({ t: 'done', models: ['video'], ok: r.status === 'ok' });
    return;
  }

  const used = new Set(['text']);
  let includeImages = limits.vision !== false;
  let messages = toChatMessages(history, { includeImages });
  let tools = mode === 'text' ? null : TOOLS;

  for (let round = 0; round < 2; round++) {
    let text = '';
    const calls = [];
    try {
      for await (const chunk of gw.chatStream({ key, messages, tools, signal })) {
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          text += delta.content;
          emit({ t: 'delta', text: delta.content });
        }
        for (const tc of delta.tool_calls || []) {
          const i = tc.index ?? 0;
          calls[i] = calls[i] || { id: tc.id || 'call_' + i, name: '', args: '' };
          if (tc.id) calls[i].id = tc.id;
          if (tc.function?.name) calls[i].name += tc.function.name;
          if (tc.function?.arguments) calls[i].args += tc.function.arguments;
        }
      }
    } catch (err) {
      // Some deployments of the text model refuse image input; retry once without it.
      if (includeImages && round === 0 && !text && /image|vision|multimodal|content type/i.test(err.message)) {
        includeImages = false;
        messages = toChatMessages(history, { includeImages });
        round--;
        continue;
      }
      throw err;
    }

    const toolCalls = calls.filter((c) => c && c.name);
    if (!toolCalls.length) break;

    messages.push({
      role: 'assistant',
      content: text || null,
      tool_calls: toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args || '{}' } })),
    });
    for (const c of toolCalls) {
      let args = {};
      try { args = JSON.parse(c.args || '{}'); } catch { args = { prompt: lastUser.text }; }
      let result;
      if (c.name === 'generate_image') {
        used.add('image');
        result = await toolImage(args);
      } else if (c.name === 'generate_video') {
        used.add('video');
        result = await toolVideo(args);
      } else {
        result = { status: 'error', error: 'Unknown tool' };
      }
      messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(result) });
    }
    if (text) emit({ t: 'delta', text: '\n\n' });
    tools = null; // one round of tools, then a short wrap-up
  }
  emit({ t: 'done', models: [...used] });
}
