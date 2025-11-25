import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';
import { randomBytes } from 'crypto';
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
function makeToken(len = 24) {
    return randomBytes(len).toString('base64url');
}
const createShareSchema = z.object({
    scope: z.enum(['blocks_only', 'full']),
    expires_in_days: z.number().int().min(1).max(365).optional(),
    expires_at: z.string().datetime().optional(),
});
router.post('/', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const parsed = createShareSchema.safeParse(req.body ?? {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid input' });
    const { scope } = parsed.data;
    let expiresAt;
    if (parsed.data.expires_at) {
        const d = new Date(parsed.data.expires_at);
        if (isNaN(d.getTime()))
            return res.status(400).json({ error: 'Invalid expires_at' });
        expiresAt = d;
    }
    else {
        const days = parsed.data.expires_in_days ?? 7;
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }
    const token = makeToken(24);
    const { data, error } = await supabase
        .from('shares')
        .insert({ owner_user_id: userId, token, scope, expires_at: expiresAt.toISOString() })
        .select('id, token, scope, expires_at')
        .single();
    if (error)
        return res.status(500).json({ error: 'Failed to create share' });
    const base = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${base}/shared/${data.token}`;
    res.status(201).json({ id: data.id, token: data.token, scope: data.scope, expires_at: data.expires_at, url });
});
router.get('/', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { data, error } = await supabase
        .from('shares')
        .select('id, token, scope, expires_at, created_at')
        .eq('owner_user_id', userId)
        .order('created_at', { ascending: false });
    if (error)
        return res.status(500).json({ error: 'Failed to list shares' });
    res.json({ items: data });
});
router.delete('/:id', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { error } = await supabase
        .from('shares')
        .delete()
        .eq('id', id)
        .eq('owner_user_id', userId);
    if (error)
        return res.status(500).json({ error: 'Failed to delete share' });
    res.json({ message: 'OK' });
});
export default router;
