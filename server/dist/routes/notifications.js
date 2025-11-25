import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';
import { sendPushToSubscription } from '../utils/push.js';
const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
function getUserId(req) {
    const auth = req.headers['authorization'] || '';
    if (typeof auth !== 'string' || !auth.startsWith('Bearer '))
        return null;
    const token = auth.slice(7);
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        return payload.sub;
    }
    catch {
        return null;
    }
}
router.post('/test', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { data: subs, error } = await supabase
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', userId);
    if (error)
        return res.status(500).json({ error: 'DB error' });
    if (!subs || subs.length === 0)
        return res.status(400).json({ error: 'No subscription' });
    const payload = JSON.stringify({ title: 'Study Planner', body: 'Test notification', at: new Date().toISOString() });
    const results = [];
    for (const s of subs) {
        const r = await sendPushToSubscription({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        results.push({ endpoint: s.endpoint, ok: r.ok, error: r.ok ? undefined : String(r.error) });
    }
    res.json({ results });
});
export default router;
