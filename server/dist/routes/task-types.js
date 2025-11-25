import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
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
const createTypeSchema = z.object({
    name: z.string().min(1),
    color: z.string().min(3),
});
router.get('/', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { data, error } = await supabase
        .from('task_types')
        .select('id,name,color,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
    if (error)
        return res.status(500).json({ error: 'Failed to list task types' });
    res.json({ items: data });
});
router.post('/', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const parsed = createTypeSchema.safeParse(req.body ?? {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid input' });
    const { name, color } = parsed.data;
    // unique per user (user_id, name)
    const { data, error } = await supabase
        .from('task_types')
        .upsert({ user_id: userId, name, color }, { onConflict: 'user_id,name' })
        .select('id')
        .single();
    if (error)
        return res.status(500).json({ error: 'Failed to create task type' });
    res.status(201).json({ id: data.id });
});
export default router;
