import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';
import { fromZonedTime } from 'date-fns-tz';
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
const createSchema = z.object({
    start_at: z.string().datetime(),
    end_at: z.string().datetime(),
    task_id: z.string().uuid().nullable().optional(),
});
const updateSchema = z.object({
    start_at: z.string().datetime().optional(),
    end_at: z.string().datetime().optional(),
    task_id: z.string().uuid().nullable().optional(),
});
function toIso(s) {
    return new Date(s).toISOString();
}
async function updateTaskSchedulingStatus(taskId) {
    const { count, error } = await supabase
        .from('time_blocks')
        .select('id', { count: 'exact', head: true })
        .eq('task_id', taskId);
    if (error)
        return;
    const scheduling_status = (count || 0) > 0 ? 'scheduled' : 'unscheduled';
    await supabase.from('tasks').update({ scheduling_status }).eq('id', taskId);
}
router.post('/', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid input' });
    const { start_at, end_at, task_id } = parsed.data;
    const startIso = toIso(start_at);
    const endIso = toIso(end_at);
    if (new Date(endIso) <= new Date(startIso))
        return res.status(400).json({ error: 'end_at must be after start_at' });
    const { data: conflicts, error: cErr } = await supabase
        .from('time_blocks')
        .select('id,start_at,end_at,task_id')
        .eq('user_id', userId)
        .lt('start_at', endIso)
        .gt('end_at', startIso);
    if (cErr) {
        if (process.env.NODE_ENV !== 'production')
            console.error('[blocks] conflict check error (create)', cErr);
        return res.status(500).json({ error: 'Failed to check conflicts' });
    }
    if (conflicts && conflicts.length > 0)
        return res.status(409).json({ error: 'Time conflict', conflicts });
    const { data, error } = await supabase
        .from('time_blocks')
        .insert({ user_id: userId, start_at: startIso, end_at: endIso, task_id: task_id ?? null })
        .select('id, task_id')
        .single();
    if (error)
        return res.status(500).json({ error: 'Failed to create block' });
    if (data.task_id) {
        await updateTaskSchedulingStatus(data.task_id);
        const estimateMin = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
        await supabase
            .from('tasks')
            .update({ due_at: endIso, estimate_min: estimateMin })
            .eq('id', data.task_id)
            .eq('user_id', userId);
    }
    res.status(201).json({ id: data.id });
});
router.get('/daily', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const dateStr = typeof req.query.date === 'string' ? req.query.date : undefined;
    if (!dateStr)
        return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
    const { data: us } = await supabase
        .from('user_settings')
        .select('timezone')
        .eq('user_id', userId)
        .maybeSingle();
    const tz = us?.timezone || 'Asia/Shanghai';
    const start = fromZonedTime(`${dateStr} 00:00:00.000`, tz).toISOString();
    const end = fromZonedTime(`${dateStr} 23:59:59.999`, tz).toISOString();
    const { data, error } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', userId)
        .lt('start_at', end)
        .gt('end_at', start)
        .order('start_at', { ascending: true });
    if (error)
        return res.status(500).json({ error: 'Failed to list time blocks' });
    res.json({ items: data });
});
router.get('/range', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const startStr = typeof req.query.start === 'string' ? req.query.start : undefined;
    const endStr = typeof req.query.end === 'string' ? req.query.end : undefined;
    if (!startStr || !endStr)
        return res.status(400).json({ error: 'start and end are required (YYYY-MM-DD)' });
    if (startStr > endStr)
        return res.status(400).json({ error: 'start must be <= end' });
    const { data: us } = await supabase
        .from('user_settings')
        .select('timezone')
        .eq('user_id', userId)
        .maybeSingle();
    const tz = us?.timezone || 'Asia/Shanghai';
    const start = fromZonedTime(`${startStr} 00:00:00.000`, tz).toISOString();
    const end = fromZonedTime(`${endStr} 23:59:59.999`, tz).toISOString();
    const { data, error } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', userId)
        .lt('start_at', end)
        .gt('end_at', start)
        .order('start_at', { ascending: true });
    if (error)
        return res.status(500).json({ error: 'Failed to list time blocks' });
    res.json({ items: data });
});
router.patch('/:id', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid input' });
    const { data: before, error: bErr } = await supabase
        .from('time_blocks')
        .select('id, start_at, end_at, task_id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
    if (bErr || !before)
        return res.status(404).json({ error: 'Not found' });
    const startIso = parsed.data.start_at ? toIso(parsed.data.start_at) : before.start_at;
    const endIso = parsed.data.end_at ? toIso(parsed.data.end_at) : before.end_at;
    const newTaskId = parsed.data.task_id !== undefined ? parsed.data.task_id : before.task_id;
    if (new Date(endIso) <= new Date(startIso))
        return res.status(400).json({ error: 'end_at must be after start_at' });
    const { data: conflicts, error: cErr } = await supabase
        .from('time_blocks')
        .select('id')
        .eq('user_id', userId)
        .neq('id', id)
        .lt('start_at', endIso)
        .gt('end_at', startIso);
    if (cErr) {
        if (process.env.NODE_ENV !== 'production')
            console.error('[blocks] conflict check error (update)', cErr);
        return res.status(500).json({ error: 'Failed to check conflicts' });
    }
    if (conflicts && conflicts.length > 0)
        return res.status(409).json({ error: 'Time conflict' });
    const { error: uErr } = await supabase
        .from('time_blocks')
        .update({ start_at: startIso, end_at: endIso, task_id: newTaskId ?? null })
        .eq('id', id)
        .eq('user_id', userId);
    if (uErr)
        return res.status(500).json({ error: 'Failed to update block' });
    if (before.task_id !== newTaskId) {
        if (before.task_id)
            await updateTaskSchedulingStatus(before.task_id);
        if (newTaskId)
            await updateTaskSchedulingStatus(newTaskId);
    }
    res.json({ message: 'OK' });
});
router.delete('/:id', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { data: before, error: bErr } = await supabase
        .from('time_blocks')
        .select('id, task_id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();
    if (bErr || !before)
        return res.status(404).json({ error: 'Not found' });
    const { error } = await supabase
        .from('time_blocks')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    if (error)
        return res.status(500).json({ error: 'Failed to delete block' });
    if (before.task_id)
        await updateTaskSchedulingStatus(before.task_id);
    res.json({ message: 'OK' });
});
export default router;
