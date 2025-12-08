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
const createTagSchema = z.object({
    name: z.string().min(1),
});
router.get('/', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { data, error } = await supabase
        .from('tags')
        .select('id,name,created_at')
        .eq('user_id', userId)
        .order('name');
    if (error)
        return res.status(500).json({ error: 'Failed to list tags' });
    res.json({ items: data });
});
router.post('/', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const parsed = createTagSchema.safeParse(req.body ?? {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid input' });
    const name = parsed.data.name.trim().toLowerCase();
    const { data, error } = await supabase
        .from('tags')
        .upsert({ user_id: userId, name }, { onConflict: 'user_id,name' })
        .select('id')
        .single();
    if (error)
        return res.status(500).json({ error: 'Failed to create tag' });
    res.status(201).json({ id: data.id });
});
router.patch('/:id', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const parsed = createTagSchema.safeParse(req.body ?? {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid input' });
    const name = parsed.data.name.trim().toLowerCase();
    const { error } = await supabase
        .from('tags')
        .update({ name })
        .eq('id', id)
        .eq('user_id', userId);
    if (error) {
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Tag name already exists' });
        }
        return res.status(500).json({ error: 'Failed to update tag' });
    }
    res.json({ message: 'OK' });
});
router.delete('/:id', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const force = req.query.force === 'true';
    // Get tag name to check usage (optional, but good for confirmation if needed)
    const { data: tagRow, error: fetchErr } = await supabase
        .from('tags')
        .select('name')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
    if (fetchErr || !tagRow)
        return res.status(404).json({ error: 'Tag not found' });
    // Check if any tasks use this tag
    const { data: usedTasks, error: checkErr } = await supabase
        .from('task_tags')
        .select('task_id, tasks(title, due_at)')
        .eq('tag_id', id)
        .limit(5);
    if (checkErr)
        return res.status(500).json({ error: 'Failed to check tag usage' });
    // Filter out any null tasks (shouldn't happen with inner join but safety first)
    const validTasks = usedTasks?.map((ut) => ut.tasks).filter(Boolean) || [];
    if (validTasks.length > 0 && !force) {
        return res.status(409).json({
            error: 'Tag is in use',
            tasks: validTasks.map((t) => ({ title: t.title, due_at: t.due_at }))
        });
    }
    // If force delete, or no usage, proceed.
    // First remove from task_tags
    const { error: linkErr } = await supabase
        .from('task_tags')
        .delete()
        .eq('tag_id', id);
    if (linkErr)
        return res.status(500).json({ error: 'Failed to unlink tag' });
    // Then delete the tag
    const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    if (error)
        return res.status(500).json({ error: 'Failed to delete tag' });
    res.json({ message: 'OK' });
});
export default router;
