import svgCaptcha from 'svg-captcha';

const store = new Map<string, { code: string; expireAt: number }>();
const TTL_MS = 5 * 60 * 1000;

function uid() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function createCaptcha() {
  const { data, text } = svgCaptcha.create({
    size: 4,
    noise: 2,
    width: 120,
    height: 40,
    color: true,
    background: '#ffffff',
  });
  const id = uid();
  store.set(id, { code: text.toLowerCase(), expireAt: Date.now() + TTL_MS });
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[dev] captcha ${id} code: ${text.toLowerCase()}`);
  }
  return { id, svg: data };
}

export function verifyCaptcha(id: string, answer: string) {
  const rec = store.get(id);
  if (!rec) return false;
  if (Date.now() > rec.expireAt) {
    store.delete(id);
    return false;
  }
  const ok = rec.code === String(answer).toLowerCase();
  if (ok) store.delete(id);
  return ok;
}
