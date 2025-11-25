import webPush from 'web-push';
const required = (k) => process.env[k] ?? '';
let vapidConfigured = false;
function ensureVapid() {
    if (vapidConfigured)
        return true;
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
export async function sendPushToSubscription(sub, payload) {
    try {
        const ok = ensureVapid();
        if (!ok) {
            return { ok: false, error: 'VAPID_NOT_CONFIGURED' };
        }
        await webPush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: e?.message || String(e) };
    }
}
