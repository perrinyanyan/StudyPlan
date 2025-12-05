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
const createTaskSchema = z.object({
    title: z.string().min(1),
    type: z.string().optional(),
    color: z.string().optional(),
    type_id: z.string().uuid().optional(),
    due_at: z.string().datetime().optional(),
    estimate_min: z.number().int().optional(),
    priority: z.number().int().min(0).max(2).optional(),
    recurrence_rule: z.string().optional(),
    tags: z.array(z.string().min(1)).max(20).optional(),
});
const updateTaskSchema = z.object({
    title: z.string().min(1).optional(),
    type: z.string().optional(),
    color: z.string().optional(),
    due_at: z.string().datetime().nullable().optional(),
    estimate_min: z.number().int().nullable().optional(),
    priority: z.number().int().min(0).max(2).nullable().optional(),
    recurrence_rule: z.string().nullable().optional(),
    status: z.enum(['open', 'done']).optional(),
    tags: z.array(z.string().min(1)).max(20).optional(),
});
router.post('/', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid input' });
    const payload = parsed.data;
    // Resolve type/name and color if only type_id is provided
    let typeName = payload.type ?? null;
    let typeColor = payload.color ?? null;
    if (payload.type_id && (!typeName || !typeColor)) {
        const { data: tt, error: tErr } = await supabase
            .from('task_types')
            .select('name,color')
            .eq('id', payload.type_id)
            .eq('user_id', userId)
            .maybeSingle();
        if (!tErr && tt) {
            typeName = tt.name ?? typeName;
            typeColor = tt.color ?? typeColor;
        }
    }
    let autoStart = null;
    let autoEnd = null;
    if (payload.due_at && typeof payload.estimate_min === 'number' && payload.estimate_min > 0) {
        autoEnd = new Date(payload.due_at).toISOString();
        autoStart = new Date(new Date(payload.due_at).getTime() - payload.estimate_min * 60000).toISOString();
        const { data: conflicts, error: cErr } = await supabase
            .from('time_blocks')
            .select('id')
            .eq('user_id', userId)
            .lt('start_at', autoEnd)
            .gt('end_at', autoStart);
        if (cErr)
            return res.status(500).json({ error: 'Failed to check conflicts' });
        if (conflicts && conflicts.length > 0)
            return res.status(409).json({ error: 'Time conflict' });
    }
    const insert = {
        user_id: userId,
        title: payload.title,
        type: typeName,
        color: typeColor,
        due_at: payload.due_at ? new Date(payload.due_at).toISOString() : null,
        estimate_min: payload.estimate_min ?? null,
        priority: payload.priority ?? null,
        recurrence_rule: payload.recurrence_rule ?? null,
    };
    const { data, error } = await supabase.from('tasks').insert(insert).select('id').single();
    if (error)
        return res.status(500).json({ error: 'Failed to create task' });
    const taskId = data.id;
    // Auto-create time block if explicit time provided (due_at + estimate_min)
    if (autoStart && autoEnd) {
        const { error: bErr } = await supabase
            .from('time_blocks')
            .insert({ user_id: userId, start_at: autoStart, end_at: autoEnd, task_id: taskId });
        if (!bErr) {
            await supabase.from('tasks').update({ scheduling_status: 'scheduled' }).eq('id', taskId).eq('user_id', userId);
        }
    }
    // If tags are provided, ensure tag rows and create relations
    if (payload.tags && payload.tags.length > 0) {
        const names = Array.from(new Set(payload.tags.map(s => s.trim().toLowerCase()).filter(Boolean)));
        if (names.length > 0) {
            const upserts = names.map(n => ({ user_id: userId, name: n }));
            const { error: upErr } = await supabase
                .from('tags')
                .upsert(upserts, { onConflict: 'user_id,name' });
            if (upErr)
                return res.status(500).json({ error: 'Failed to upsert tags' });
            const { data: tagRows, error: selErr } = await supabase
                .from('tags')
                .select('id,name')
                .eq('user_id', userId)
                .in('name', names);
            if (selErr || !tagRows)
                return res.status(500).json({ error: 'Failed to load tags' });
            const links = tagRows.map(r => ({ task_id: taskId, tag_id: r.id }));
            const { error: linkErr } = await supabase
                .from('task_tags')
                .upsert(links, { onConflict: 'task_id,tag_id' });
            if (linkErr)
                return res.status(500).json({ error: 'Failed to link tags' });
        }
    }
    res.status(201).json({ id: taskId });
});
router.get('/', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const withParam = typeof req.query.with === 'string' ? req.query.with : '';
    const withTags = withParam.split(',').includes('tags');
    const q = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
    const { data, error } = status ? await q.eq('status', status) : await q;
    if (error)
        return res.status(500).json({ error: 'Failed to list tasks' });
    if (withTags && data && data.length > 0) {
        const ids = data.map(x => x.id).filter(Boolean);
        if (ids.length > 0) {
            const { data: ttRows, error: tErr } = await supabase
                .from('task_tags')
                .select('task_id, tag_id')
                .in('task_id', ids);
            if (tErr)
                return res.status(500).json({ error: 'Failed to load task-tag relations' });
            const tagIds = Array.from(new Set((ttRows || []).map(r => r.tag_id).filter(Boolean)));
            let tagNameById = new Map();
            if (tagIds.length > 0) {
                const { data: tgRows, error: gErr } = await supabase
                    .from('tags')
                    .select('id,name')
                    .in('id', tagIds);
                if (gErr)
                    return res.status(500).json({ error: 'Failed to load tag names' });
                (tgRows || []).forEach((g) => tagNameById.set(String(g.id), String(g.name)));
            }
            const tagsByTask = new Map();
            (ttRows || []).forEach((r) => {
                const tid = String(r.task_id);
                const name = tagNameById.get(String(r.tag_id));
                if (!name)
                    return;
                const arr = tagsByTask.get(tid) || [];
                if (!arr.includes(name))
                    arr.push(name);
                tagsByTask.set(tid, arr);
            });
            const enriched = data.map((it) => ({ ...it, tags: tagsByTask.get(String(it.id)) || [] }));
            return res.json({ items: enriched });
        }
    }
    res.json({ items: data });
});
router.get('/by-ids', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const idsParam = typeof req.query.ids === 'string' ? req.query.ids : '';
    const withParam = typeof req.query.with === 'string' ? req.query.with : '';
    const withTags = withParam.split(',').includes('tags');
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0)
        return res.json({ items: [] });
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .in('id', ids);
    if (error)
        return res.status(500).json({ error: 'Failed to load tasks' });
    if (withTags && data && data.length > 0) {
        const tIds = data.map(x => x.id).filter(Boolean);
        if (tIds.length > 0) {
            const { data: ttRows, error: tErr } = await supabase
                .from('task_tags')
                .select('task_id, tag_id')
                .in('task_id', tIds);
            if (tErr)
                return res.status(500).json({ error: 'Failed to load task-tag relations' });
            const tagIds = Array.from(new Set((ttRows || []).map(r => r.tag_id).filter(Boolean)));
            let tagNameById = new Map();
            if (tagIds.length > 0) {
                const { data: tgRows, error: gErr } = await supabase
                    .from('tags')
                    .select('id,name')
                    .in('id', tagIds);
                if (gErr)
                    return res.status(500).json({ error: 'Failed to load tag names' });
                (tgRows || []).forEach((g) => tagNameById.set(String(g.id), String(g.name)));
            }
            const tagsByTask = new Map();
            (ttRows || []).forEach((r) => {
                const tid = String(r.task_id);
                const name = tagNameById.get(String(r.tag_id));
                if (!name)
                    return;
                const arr = tagsByTask.get(tid) || [];
                if (!arr.includes(name))
                    arr.push(name);
                tagsByTask.set(tid, arr);
            });
            const enriched = data.map((it) => ({ ...it, tags: tagsByTask.get(String(it.id)) || [] }));
            return res.json({ items: enriched });
        }
    }
    res.json({ items: data });
});
router.get('/daily', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const dateStr = typeof req.query.date === 'string' ? req.query.date : undefined;
    if (!dateStr)
        return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
    const withParam = typeof req.query.with === 'string' ? req.query.with : '';
    const withTags = withParam.split(',').includes('tags');
    const { data: us } = await supabase
        .from('user_settings')
        .select('timezone')
        .eq('user_id', userId)
        .maybeSingle();
    const tz = us?.timezone || 'Asia/Shanghai';
    const start = fromZonedTime(`${dateStr} 00:00:00.000`, tz);
    const end = fromZonedTime(`${dateStr} 23:59:59.999`, tz);
    const { data: today, error: err1 } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['open', 'done'])
        .gte('due_at', start.toISOString())
        .lte('due_at', end.toISOString())
        .order('due_at', { ascending: true, nullsFirst: false });
    if (err1)
        return res.status(500).json({ error: 'Failed to query today tasks' });
    const { data: overdue, error: err2 } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['open', 'done'])
        .lt('due_at', start.toISOString())
        .order('due_at', { ascending: true, nullsFirst: false });
    if (err2)
        return res.status(500).json({ error: 'Failed to query overdue tasks' });
    if (withTags && today && overdue) {
        const all = [].concat(today, overdue);
        const ids = all.map(x => x.id).filter(Boolean);
        if (ids.length > 0) {
            const { data: ttRows, error: tErr } = await supabase
                .from('task_tags')
                .select('task_id, tag_id')
                .in('task_id', ids);
            if (tErr)
                return res.status(500).json({ error: 'Failed to load task-tag relations' });
            const tagIds = Array.from(new Set((ttRows || []).map(r => r.tag_id).filter(Boolean)));
            let tagNameById = new Map();
            if (tagIds.length > 0) {
                const { data: tgRows, error: gErr } = await supabase
                    .from('tags')
                    .select('id,name')
                    .in('id', tagIds);
                if (gErr)
                    return res.status(500).json({ error: 'Failed to load tag names' });
                (tgRows || []).forEach((g) => tagNameById.set(String(g.id), String(g.name)));
            }
            const tagsByTask = new Map();
            (ttRows || []).forEach((r) => {
                const tid = String(r.task_id);
                const name = tagNameById.get(String(r.tag_id));
                if (!name)
                    return;
                const arr = tagsByTask.get(tid) || [];
                if (!arr.includes(name))
                    arr.push(name);
                tagsByTask.set(tid, arr);
            });
            const todayEnriched = today.map((it) => ({ ...it, tags: tagsByTask.get(String(it.id)) || [] }));
            const overdueEnriched = overdue.map((it) => ({ ...it, tags: tagsByTask.get(String(it.id)) || [] }));
            return res.json({ today: todayEnriched, overdue: overdueEnriched });
        }
    }
    res.json({ today, overdue });
});
router.patch('/:id', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid input' });
    const payload = parsed.data;
    let autoStart = null;
    let autoEnd = null;
    if (payload.due_at && typeof payload.estimate_min === 'number' && payload.estimate_min > 0) {
        autoEnd = new Date(payload.due_at).toISOString();
        autoStart = new Date(new Date(payload.due_at).getTime() - payload.estimate_min * 60000).toISOString();
        const { data: conflicts, error: cErr } = await supabase
            .from('time_blocks')
            .select('id,task_id')
            .eq('user_id', userId)
            .neq('task_id', id)
            .lt('start_at', autoEnd)
            .gt('end_at', autoStart);
        if (cErr)
            return res.status(500).json({ error: 'Failed to check conflicts' });
        if (conflicts && conflicts.length > 0)
            return res.status(409).json({ error: 'Time conflict' });
    }
    const update = {};
    if (payload.title !== undefined)
        update.title = payload.title;
    if (payload.type !== undefined)
        update.type = payload.type;
    if (payload.color !== undefined)
        update.color = payload.color;
    if (payload.due_at !== undefined)
        update.due_at = payload.due_at ? new Date(payload.due_at).toISOString() : null;
    if (payload.estimate_min !== undefined)
        update.estimate_min = payload.estimate_min;
    if (payload.priority !== undefined)
        update.priority = payload.priority;
    if (payload.recurrence_rule !== undefined)
        update.recurrence_rule = payload.recurrence_rule;
    if (payload.status !== undefined)
        update.status = payload.status;
    const { error } = await supabase
        .from('tasks')
        .update(update)
        .eq('id', id)
        .eq('user_id', userId);
    if (error)
        return res.status(500).json({ error: 'Failed to update task' });
    if (autoStart && autoEnd) {
        const { data: blocks, error: bSelErr } = await supabase
            .from('time_blocks')
            .select('id')
            .eq('user_id', userId)
            .eq('task_id', id);
        if (bSelErr)
            return res.status(500).json({ error: 'Failed to update time block' });
        if (blocks && blocks.length === 1) {
            const blockId = blocks[0].id;
            const { error: bUpdErr } = await supabase
                .from('time_blocks')
                .update({ start_at: autoStart, end_at: autoEnd })
                .eq('id', blockId)
                .eq('user_id', userId);
            if (bUpdErr)
                return res.status(500).json({ error: 'Failed to update time block' });
        }
        else if (blocks && blocks.length === 0) {
            const { error: bInsErr } = await supabase
                .from('time_blocks')
                .insert({ user_id: userId, start_at: autoStart, end_at: autoEnd, task_id: id });
            if (bInsErr)
                return res.status(500).json({ error: 'Failed to create time block' });
            await supabase
                .from('tasks')
                .update({ scheduling_status: 'scheduled' })
                .eq('id', id)
                .eq('user_id', userId);
        }
    }
    if (payload.tags !== undefined) {
        const names = Array.from(new Set((payload.tags || []).map(s => s.trim().toLowerCase()).filter(Boolean)));
        const { error: delErr } = await supabase
            .from('task_tags')
            .delete()
            .eq('task_id', id);
        if (delErr)
            return res.status(500).json({ error: 'Failed to update tags' });
        if (names.length > 0) {
            const upserts = names.map(n => ({ user_id: userId, name: n }));
            const { error: upErr } = await supabase
                .from('tags')
                .upsert(upserts, { onConflict: 'user_id,name' });
            if (upErr)
                return res.status(500).json({ error: 'Failed to upsert tags' });
            const { data: tagRows, error: selErr } = await supabase
                .from('tags')
                .select('id,name')
                .eq('user_id', userId)
                .in('name', names);
            if (selErr || !tagRows)
                return res.status(500).json({ error: 'Failed to load tags' });
            const links = tagRows.map(r => ({ task_id: id, tag_id: r.id }));
            const { error: linkErr } = await supabase
                .from('task_tags')
                .upsert(links, { onConflict: 'task_id,tag_id' });
            if (linkErr)
                return res.status(500).json({ error: 'Failed to link tags' });
        }
    }
    res.json({ message: 'OK' });
});
router.delete('/:id', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    // First remove any time blocks associated with this task to avoid orphan blocks
    const { error: blockErr } = await supabase
        .from('time_blocks')
        .delete()
        .eq('user_id', userId)
        .eq('task_id', id);
    if (blockErr)
        return res.status(500).json({ error: 'Failed to delete time blocks for task' });
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
    if (error)
        return res.status(500).json({ error: 'Failed to delete task' });
    res.json({ message: 'OK' });
});
// Get unique task types for user
router.get('/types', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { data, error } = await supabase
        .from('tasks')
        .select('type')
        .eq('user_id', userId)
        .not('type', 'is', null);
    if (error)
        return res.status(500).json({ error: 'Failed to fetch types' });
    const types = Array.from(new Set((data || []).map(t => t.type).filter(Boolean)));
    res.json({ types });
});
// Get unique tags for user
router.get('/tags-list', async (req, res) => {
    const userId = getUserId(req);
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const { data, error } = await supabase
        .from('tags')
        .select('name')
        .eq('user_id', userId);
    if (error)
        return res.status(500).json({ error: 'Failed to fetch tags' });
    const tags = (data || []).map(t => t.name);
    res.json({ tags });
});
export default router;
