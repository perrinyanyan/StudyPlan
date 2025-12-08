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
router.patch('/:id', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const parsed = createTypeSchema.partial().safeParse(req.body ?? {});
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid input' });
    const { name, color } = parsed.data;
    // Get old type to know name for cascading updates
    const { data: oldType, error: oldErr } = await supabase
        .from('task_types')
        .select('name')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
    if (oldErr || !oldType)
        return res.status(404).json({ error: 'Task type not found' });
    const update = {};
    if (name)
        update.name = name;
    if (color)
        update.color = color;
    const { error } = await supabase
        .from('task_types')
        .update(update)
        .eq('id', id)
        .eq('user_id', userId);
    if (error)
        return res.status(500).json({ error: 'Failed to update task type' });
    // Cascade update to tasks if name or color changed
    if (name || color) {
        const taskUpdate = {};
        if (name)
            taskUpdate.type = name;
        if (color)
            taskUpdate.color = color;
        // Update all tasks that had the old type name
        await supabase
            .from('tasks')
            .update(taskUpdate)
            .eq('user_id', userId)
            .eq('type', oldType.name);
    }
    res.json({ message: 'OK' });
});
router.delete('/:id', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const force = req.query.force === 'true';
    // Get type name to check usage
    const { data: typeRow, error: fetchErr } = await supabase
        .from('task_types')
        .select('name')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
    if (fetchErr || !typeRow)
        return res.status(404).json({ error: 'Task type not found' });
    // Check if any tasks use this type
    const { data: usedTasks, error: checkErr } = await supabase
        .from('tasks')
        .select('title, due_at')
        .eq('user_id', userId)
        .eq('type', typeRow.name)
        .limit(5);
    if (checkErr)
        return res.status(500).json({ error: 'Failed to check type usage' });
    if (usedTasks && usedTasks.length > 0 && !force) {
        return res.status(409).json({
            error: 'Type is in use',
            tasks: usedTasks.map(t => ({ title: t.title, due_at: t.due_at }))
        });
    }
    // If force delete, or no usage, proceed.
    // If force delete, we must also clear the type from the tasks
    if (force && usedTasks && usedTasks.length > 0) {
        const { error: updateErr } = await supabase
            .from('tasks')
            .update({ type: null, color: null })
            .eq('user_id', userId)
            .eq('type', typeRow.name);
        if (updateErr)
            return res.status(500).json({ error: 'Failed to decouple tasks' });
    }
    const { error } = await supabase
        .from('task_types')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    if (error)
        return res.status(500).json({ error: 'Failed to delete task type' });
    res.json({ message: 'OK' });
});
export default router;
