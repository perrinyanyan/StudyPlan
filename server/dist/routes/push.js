import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { supabase } from '../db/supabase.js';
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
const subSchema = z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
    userAgent: z.string().optional(),
});
router.get('/public-key', async (_req, res) => {
    const key = process.env.VAPID_PUBLIC_KEY || '';
    res.json({ key });
});
router.post('/subscribe', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const parsed = subSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid subscription' });
    const { endpoint, keys, userAgent } = parsed.data;
    const upsert = {
        user_id: userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent ?? null,
    };
    const { error } = await supabase
        .from('push_subscriptions')
        .upsert(upsert, { onConflict: 'endpoint' });
    if (error)
        return res.status(500).json({ error: 'Failed to save subscription' });
    res.json({ message: 'OK' });
});
const unsubSchema = z.object({
    endpoint: z.string().url(),
});
router.post('/unsubscribe', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const parsed = unsubSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid request' });
    const { endpoint } = parsed.data;
    const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);
    if (error)
        return res.status(500).json({ error: 'Failed to unsubscribe' });
    res.json({ message: 'OK' });
});
export default router;
