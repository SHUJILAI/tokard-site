// Demo mode: a stand-in for the gateway so the Studio can be tried without
// any API keys. It decides like the real agent would and returns sample media.

import { createReadStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';

const IMAGE_WORDS = /(draw|image|picture|photo|poster|logo|illustrat|sketch|painting|wallpaper|画|图|海报|插画|照片|头像)/i;
const VIDEO_WORDS = /(video|clip|animate|animation|movie|film|trailer|视频|动画|短片|动起来)/i;

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((p) => p.type === 'text').map((p) => p.text).join(' ');
  return '';
}

function isChinese(s) {
  return /[一-鿿]/.test(s || '');
}

// Returns the OpenAI-format stream chunks the mock text model would send.
export function mockChatChunks(messages, tools) {
  const last = messages[messages.length - 1];
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const ask = textOf(lastUser?.content).replace(/\s*\[the user attached an image\]$/, '');
  const zh = isChinese(ask);
  const chunks = [];
  const say = (text) => {
    for (const piece of text.match(/.{1,12}/gs) || []) chunks.push({ choices: [{ index: 0, delta: { content: piece } }] });
  };

  if (last.role === 'tool') {
    let ok = true;
    try { ok = JSON.parse(last.content).status === 'ok'; } catch { /* keep ok */ }
    const kind = /vid_|video/.test(JSON.stringify(messages[messages.length - 2]?.tool_calls || '')) ? 'video' : 'image';
    if (ok) say(zh ? (kind === 'video' ? '视频做好了，就在上面。要不要换个镜头或时长？' : '图做好了，就在上面。需要调整风格或比例吗？')
      : (kind === 'video' ? 'Your video is ready above. Want a different camera move or length?' : 'Here is your image. Want a different style or shape?'));
    else say(zh ? '这次没有生成成功，错误信息在上面。' : 'That did not work this time; the error is shown above.');
  } else if (tools && (VIDEO_WORDS.test(ask) || IMAGE_WORDS.test(ask))) {
    const video = VIDEO_WORDS.test(ask);
    const prompt = (ask || 'A koi fish over a neon city at night').replace(/^(please |can you |could you |帮我|请|给我)/i, '');
    const args = video ? { prompt, seconds: 5, aspect_ratio: '16:9', reference: 'none' } : { prompt, aspect_ratio: '16:9', reference: 'none' };
    say(zh ? (video ? '好的，我来用 Seedance 生成这段视频。' : '好的，我来用 Seedream 画这张图。') : (video ? 'Sure, making that video with Seedance.' : 'Sure, creating that with Seedream.'));
    chunks.push({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_demo_1', type: 'function', function: { name: video ? 'generate_video' : 'generate_image', arguments: '' } }] } }] });
    const json = JSON.stringify(args);
    for (let i = 0; i < json.length; i += 24) {
      chunks.push({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: json.slice(i, i + 24) } }] } }] });
    }
  } else {
    say(zh
      ? `这是演示模式，还没接上 DeepSeek，所以我先用示例回答。接上 API Key 后，这里会是 DeepSeek V4.1 Flash 的真实回复。\n\n你可以试试：“画一张霓虹城市里的锦鲤海报”，或者“做一段 5 秒的锦鲤游过城市的视频”。`
      : `This is demo mode, so DeepSeek isn't connected yet and this is a sample reply. With an API key, DeepSeek V4.1 Flash answers here.\n\nTry: "Draw a poster of a koi fish over a neon city" or "Make a 5 second video of a koi swimming through a city".`);
  }
  chunks.push({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 } });
  return chunks;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createMockGateway({ samplesDir }) {
  const videos = new Map();
  return {
    name: 'mock',
    async checkKey() { return ['text', 'image', 'video']; },
    async *chatStream({ messages, tools }) {
      for (const c of mockChatChunks(messages, tools)) {
        await wait(25);
        yield c;
      }
    },
    async generateImage() {
      await wait(1600);
      return { url: '/samples/koi.png' };
    },
    async createVideo() {
      const id = 'demo_' + Math.random().toString(36).slice(2, 10);
      videos.set(id, Date.now());
      return id;
    },
    async getVideo({ id }) {
      const elapsed = Date.now() - (videos.get(id) || 0);
      if (elapsed > 6000) return { status: 'completed', progress: 100 };
      return { status: 'in_progress', progress: Math.round((elapsed / 6000) * 100) };
    },
    videoContent() {
      const file = samplesDir + '/koi.mp4';
      const size = statSync(file).size;
      return new Response(Readable.toWeb(createReadStream(file)), {
        status: 200,
        headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(size) },
      });
    },
  };
}
