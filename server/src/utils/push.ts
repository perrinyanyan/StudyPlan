import webPush from 'web-push';

const required = (k: string) => process.env[k] ?? '';

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const subject = required('VAPID_SUBJECT');
  const publicKey = required('VAPID_PUBLIC_KEY');
  const privateKey = required('VAPID_PRIVATE_KEY');
  if (!subject || !publicKey || !privateKey) {
    console.warn('[push] VAPID not configured. Set VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY');
    return false;
  }
  webPush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export type PushPayload = string | Buffer;

export async function sendPushToSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: PushPayload) {
  try {
    const ok = ensureVapid();
    if (!ok) {
      return { ok: false, error: 'VAPID_NOT_CONFIGURED' };
    }
    await webPush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys as any }, payload);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
