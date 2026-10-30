// A first line of defence on image and film prompts, before they reach the model.
// The providers run their own safety systems too; this only stops the clearest
// cases early and leaves an audit trail. It is not a complete moderation system.

const MINOR = /\b(child|children|kid|kids|minor|minors|underage|under-age|preteen|pre-teen|teen|teens|teenage|schoolgirl|schoolboy|toddler|infant|baby|loli|shota|\d{1,2}\s*(yo|y\/o|years?\s*old))\b/i;
const SEXUAL = /\b(nude|nudity|naked|nsfw|sex|sexual|sexy|porn|porno|erotic|explicit|lingerie|undress(ed|ing)?|topless|genital|breasts?|seductive)\b/i;
const REAL_PERSON_SEXUAL = /\b(deepfake|face\s*swap|faceswap)\b/i;

export function checkPrompt(text) {
  const s = String(text || '').slice(0, 20000);
  if (MINOR.test(s) && SEXUAL.test(s)) return 'This request was blocked because it may sexualize minors.';
  if (REAL_PERSON_SEXUAL.test(s) && SEXUAL.test(s)) return 'Sexual images of real people are not allowed.';
  return null;
}

// pull the prompt out of an image / video API body (JSON)
export function promptOf(body) {
  if (!body || typeof body !== 'object') return '';
  return [body.prompt, body.input, body.negative_prompt, body.metadata && body.metadata.prompt].filter((x) => typeof x === 'string').join('\n');
}
