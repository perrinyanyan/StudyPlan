import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';
import { fromZonedTime } from 'date-fns-tz';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

function getUserId(req: Request): string | null {
  const auth = req.headers['authorization'] || '';
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return payload.sub as string;
  } catch {
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
  content: z.string().nullish(),
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
  content: z.string().nullish(),
});

router.post('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const payload = parsed.data;

  // Resolve type/name and color if only type_id is provided
  let typeName: string | null = payload.type ?? null;
  let typeColor: string | null = payload.color ?? null;
  if (payload.type_id && (!typeName || !typeColor)) {
    const { data: tt, error: tErr } = await supabase
      .from('task_types')
      .select('name,color')
      .eq('id', payload.type_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (!tErr && tt) {
      typeName = (tt as any).name ?? typeName;
      typeColor = (tt as any).color ?? typeColor;
    }
  }

  // Recurrence logic
  const dates: Date[] = [];
  const startBase = payload.due_at ? new Date(payload.due_at) : new Date();

  if (payload.recurrence_rule && payload.recurrence_rule !== 'POOL' && payload.due_at) {
    const rule = payload.recurrence_rule;
    const untilMatch = rule.match(/UNTIL=(\d{8})/);
    if (!untilMatch) {
      // No UNTIL, just create one instance (or handle infinite? for now 1)
      dates.push(startBase);
    } else {
      const untilStr = untilMatch[1];
      const untilDate = new Date(
        Number(untilStr.slice(0, 4)),
        Number(untilStr.slice(4, 6)) - 1,
        Number(untilStr.slice(6, 8)),
        23, 59, 59
      );

      const freq = rule.startsWith('DAILY') ? 'DAILY' : rule.startsWith('WEEKLY') ? 'WEEKLY' : rule.startsWith('MONTHLY') ? 'MONTHLY' : null;

      // Parse BYDAY
      let byDay: string[] = [];
      const byDayMatch = rule.match(/BYDAY=([^;]+)/);
      if (byDayMatch) byDay = byDayMatch[1].split(',');

      // Parse BYMONTHDAY
      let byMonthDay: number[] = [];
      const byMonthDayMatch = rule.match(/BYMONTHDAY=([^;]+)/);
      if (byMonthDayMatch) byMonthDay = byMonthDayMatch[1].split(',').map(Number);

      let current = new Date(startBase);
      let count = 0;
      const MAX_COUNT = 365; // Safety cap

      // Helper to check if current date matches criteria
      const matches = (d: Date) => {
        if (freq === 'WEEKLY' && byDay.length > 0) {
          const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
          const dayStr = dayMap[d.getDay()];
          if (!byDay.includes(dayStr)) return false;
        }
        if (freq === 'MONTHLY' && byMonthDay.length > 0) {
          const dom = d.getDate();
          if (!byMonthDay.includes(dom)) return false;
        }
        return true;
      };

      while (current <= untilDate && count < MAX_COUNT) {
        if (matches(current)) {
          dates.push(new Date(current));
          count++;
        }
        // Advance
        if (freq === 'DAILY') {
          current.setDate(current.getDate() + 1);
        } else if (freq === 'WEEKLY') {
          // If BYDAY is present, we still advance day by day to catch all days in the week
          // Optimization: could jump, but day-by-day is safer for multi-day selection
          current.setDate(current.getDate() + 1);
        } else if (freq === 'MONTHLY') {
          // Similar to weekly, if BYMONTHDAY is present, day-by-day is safest to catch multiple dates
          // But if no BYMONTHDAY, jump month
          if (byMonthDay.length > 0) {
            current.setDate(current.getDate() + 1);
          } else {
            current.setMonth(current.getMonth() + 1);
          }
        } else {
          break; // Should not happen
        }
      }
    }
  } else {
    // Single task or POOL
    dates.push(startBase);
  }

  if (dates.length === 0) return res.status(400).json({ error: 'No valid dates generated from recurrence rule' });

  const createdIds: string[] = [];

  // Batch insert is more efficient, but we need to handle time blocks and tags for each.
  // We'll loop and insert one by one for simplicity and correctness with dependent tables.

  for (const date of dates) {
    const insert = {
      user_id: userId,
      title: payload.title,
      type: typeName,
      color: typeColor,
      due_at: payload.due_at ? new Date(payload.due_at).toISOString() : null,
      estimate_min: payload.estimate_min ?? null,
      priority: payload.priority ?? null,
      recurrence_rule: payload.recurrence_rule ?? null,
      content: payload.content ?? null,
    } as const;

    const { data, error } = await supabase.from('tasks').insert(insert).select('id').single();
    if (error) {
      console.error('Failed to create task instance', error);
      continue;
    }
    const taskId = (data as any)!.id as string;
    createdIds.push(taskId);

    // Auto-create time block
    if (payload.estimate_min && payload.estimate_min > 0 && payload.recurrence_rule !== 'POOL') {
      const autoEnd = date.toISOString();
      const autoStart = new Date(date.getTime() - payload.estimate_min * 60000).toISOString();

      // Check for conflicts
      const { data: conflicts, error: cErr } = await supabase
        .from('time_blocks')
        .select('id')
        .eq('user_id', userId)
        .lt('start_at', autoEnd)
        .gt('end_at', autoStart);

      if (cErr) {
        console.error('Failed to check conflicts', cErr);
      } else if (conflicts && conflicts.length > 0) {
        // If conflict, we should probably rollback the task creation?
        // Or just return error and let the user handle it?
        // Since we are inside a loop (for recurrence), failing one might be tricky.
        // But for "Schedule to Calendar" it's usually a single date.
        // Let's delete the task and return 409.
        await supabase.from('tasks').delete().eq('id', taskId);
        return res.status(409).json({ error: 'Time conflict' });
      }

      const { error: bErr } = await supabase
        .from('time_blocks')
        .insert({ user_id: userId, start_at: autoStart, end_at: autoEnd, task_id: taskId });

      if (!bErr) {
        await supabase.from('tasks').update({ scheduling_status: 'scheduled' }).eq('id', taskId).eq('user_id', userId);
      }
    }

    // Link tags
    if (payload.tags && payload.tags.length > 0) {
      const names = Array.from(new Set(payload.tags.map(s => s.trim().toLowerCase()).filter(Boolean)));
      if (names.length > 0) {
        // Upsert tags (idempotent)
        const upserts = names.map(n => ({ user_id: userId, name: n }));
        await supabase.from('tags').upsert(upserts, { onConflict: 'user_id,name' });

        // Get IDs
        const { data: tagRows } = await supabase.from('tags').select('id,name').eq('user_id', userId).in('name', names);
        if (tagRows) {
          const links = (tagRows as any[]).map(r => ({ task_id: taskId, tag_id: r.id as string }));
          await supabase.from('task_tags').upsert(links, { onConflict: 'task_id,tag_id' });
        }
      }
    }
  }

  if (createdIds.length === 0) return res.status(500).json({ error: 'Failed to create any tasks' });

  res.status(201).json({ id: createdIds[0], count: createdIds.length });
});

router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
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
  if (error) return res.status(500).json({ error: 'Failed to list tasks' });
  if (withTags && data && data.length > 0) {
    const ids = (data as any[]).map(x => x.id).filter(Boolean) as string[];
    if (ids.length > 0) {
      const { data: ttRows, error: tErr } = await supabase
        .from('task_tags')
        .select('task_id, tag_id')
        .in('task_id', ids);
      if (tErr) return res.status(500).json({ error: 'Failed to load task-tag relations' });
      const tagIds = Array.from(new Set((ttRows || []).map(r => r.tag_id).filter(Boolean))) as string[];
      let tagNameById = new Map<string, string>();
      if (tagIds.length > 0) {
        const { data: tgRows, error: gErr } = await supabase
          .from('tags')
          .select('id,name')
          .in('id', tagIds);
        if (gErr) return res.status(500).json({ error: 'Failed to load tag names' });
        (tgRows || []).forEach((g: any) => tagNameById.set(String(g.id), String(g.name)));
      }
      const tagsByTask = new Map<string, string[]>();
      (ttRows || []).forEach((r: any) => {
        const tid = String(r.task_id);
        const name = tagNameById.get(String(r.tag_id));
        if (!name) return;
        const arr = tagsByTask.get(tid) || [];
        if (!arr.includes(name)) arr.push(name);
        tagsByTask.set(tid, arr);
      });
      const enriched = (data as any[]).map((it: any) => ({ ...it, tags: tagsByTask.get(String(it.id)) || [] }));
      return res.json({ items: enriched });
    }
  }
  res.json({ items: data });
});

router.get('/by-ids', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const idsParam = typeof req.query.ids === 'string' ? req.query.ids : '';
  const withParam = typeof req.query.with === 'string' ? req.query.with : '';
  const withTags = withParam.split(',').includes('tags');
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return res.json({ items: [] });

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .in('id', ids);
  if (error) return res.status(500).json({ error: 'Failed to load tasks' });

  if (withTags && data && data.length > 0) {
    const tIds = (data as any[]).map(x => x.id).filter(Boolean) as string[];
    if (tIds.length > 0) {
      const { data: ttRows, error: tErr } = await supabase
        .from('task_tags')
        .select('task_id, tag_id')
        .in('task_id', tIds);
      if (tErr) return res.status(500).json({ error: 'Failed to load task-tag relations' });
      const tagIds = Array.from(new Set((ttRows || []).map(r => r.tag_id).filter(Boolean))) as string[];
      let tagNameById = new Map<string, string>();
      if (tagIds.length > 0) {
        const { data: tgRows, error: gErr } = await supabase
          .from('tags')
          .select('id,name')
          .in('id', tagIds);
        if (gErr) return res.status(500).json({ error: 'Failed to load tag names' });
        (tgRows || []).forEach((g: any) => tagNameById.set(String(g.id), String(g.name)));
      }
      const tagsByTask = new Map<string, string[]>();
      (ttRows || []).forEach((r: any) => {
        const tid = String(r.task_id);
        const name = tagNameById.get(String(r.tag_id));
        if (!name) return;
        const arr = tagsByTask.get(tid) || [];
        if (!arr.includes(name)) arr.push(name);
        tagsByTask.set(tid, arr);
      });
      const enriched = (data as any[]).map((it: any) => ({ ...it, tags: tagsByTask.get(String(it.id)) || [] }));
      return res.json({ items: enriched });
    }
  }

  res.json({ items: data });
});

router.get('/daily', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const dateStr = typeof req.query.date === 'string' ? req.query.date : undefined;
  if (!dateStr) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
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
  if (err1) return res.status(500).json({ error: 'Failed to query today tasks' });
  const { data: overdue, error: err2 } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['open', 'done'])
    .lt('due_at', start.toISOString())
    .order('due_at', { ascending: true, nullsFirst: false });
  if (err2) return res.status(500).json({ error: 'Failed to query overdue tasks' });
  if (withTags && today && overdue) {
    const all = ([] as any[]).concat(today as any[], overdue as any[]);
    const ids = all.map(x => x.id).filter(Boolean) as string[];
    if (ids.length > 0) {
      const { data: ttRows, error: tErr } = await supabase
        .from('task_tags')
        .select('task_id, tag_id')
        .in('task_id', ids);
      if (tErr) return res.status(500).json({ error: 'Failed to load task-tag relations' });
      const tagIds = Array.from(new Set((ttRows || []).map(r => r.tag_id).filter(Boolean))) as string[];
      let tagNameById = new Map<string, string>();
      if (tagIds.length > 0) {
        const { data: tgRows, error: gErr } = await supabase
          .from('tags')
          .select('id,name')
          .in('id', tagIds);
        if (gErr) return res.status(500).json({ error: 'Failed to load tag names' });
        (tgRows || []).forEach((g: any) => tagNameById.set(String(g.id), String(g.name)));
      }
      const tagsByTask = new Map<string, string[]>();
      (ttRows || []).forEach((r: any) => {
        const tid = String(r.task_id);
        const name = tagNameById.get(String(r.tag_id));
        if (!name) return;
        const arr = tagsByTask.get(tid) || [];
        if (!arr.includes(name)) arr.push(name);
        tagsByTask.set(tid, arr);
      });
      const todayEnriched = (today as any[]).map((it: any) => ({ ...it, tags: tagsByTask.get(String(it.id)) || [] }));
      const overdueEnriched = (overdue as any[]).map((it: any) => ({ ...it, tags: tagsByTask.get(String(it.id)) || [] }));
      return res.json({ today: todayEnriched, overdue: overdueEnriched });
    }
  }
  res.json({ today, overdue });
});

router.patch('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const payload = parsed.data;
  let autoStart: string | null = null;
  let autoEnd: string | null = null;
  // Check if it's a pool task (either in payload or existing)
  let isPool = false;
  if (payload.recurrence_rule !== undefined) {
    isPool = (payload.recurrence_rule || '').startsWith('POOL');
  } else {
    // Fetch existing to check
    const { data: existing } = await supabase.from('tasks').select('recurrence_rule').eq('id', id).single();
    if (existing && existing.recurrence_rule && existing.recurrence_rule.startsWith('POOL')) {
      isPool = true;
    }
  }

  console.log('PATCH /:id debug:', {
    id,
    payloadRecur: payload.recurrence_rule,
    isPool,
    due_at: payload.due_at,
    estimate_min: payload.estimate_min
  });

  if (payload.due_at && typeof payload.estimate_min === 'number' && payload.estimate_min > 0 && !isPool) {
    autoEnd = new Date(payload.due_at).toISOString();
    autoStart = new Date(new Date(payload.due_at).getTime() - payload.estimate_min * 60000).toISOString();
    const { data: conflicts, error: cErr } = await supabase
      .from('time_blocks')
      .select('id,task_id')
      .eq('user_id', userId)
      .neq('task_id', id)
      .lt('start_at', autoEnd)
      .gt('end_at', autoStart);
    if (cErr) return res.status(500).json({ error: 'Failed to check conflicts' });
    if (conflicts && conflicts.length > 0) return res.status(409).json({ error: 'Time conflict' });
  }
  const update: any = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.type !== undefined) update.type = payload.type;
  if (payload.color !== undefined) update.color = payload.color;
  if (payload.due_at !== undefined) update.due_at = payload.due_at ? new Date(payload.due_at).toISOString() : null;
  if (payload.estimate_min !== undefined) update.estimate_min = payload.estimate_min;
  if (payload.priority !== undefined) update.priority = payload.priority;
  if (payload.recurrence_rule !== undefined) update.recurrence_rule = payload.recurrence_rule;
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.content !== undefined) update.content = payload.content;
  const { error } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return res.status(500).json({ error: 'Failed to update task' });

  if (isPool) {
    // If it's a pool task, ensure NO time blocks exist (so it doesn't block others)
    // and ensure status is unscheduled
    await supabase.from('time_blocks').delete().eq('task_id', id).eq('user_id', userId);
    await supabase.from('tasks').update({ scheduling_status: 'unscheduled' }).eq('id', id).eq('user_id', userId);
  } else if (autoStart && autoEnd) {
    const { data: blocks, error: bSelErr } = await supabase
      .from('time_blocks')
      .select('id')
      .eq('user_id', userId)
      .eq('task_id', id);
    if (bSelErr) return res.status(500).json({ error: 'Failed to update time block' });
    if (blocks && blocks.length === 1) {
      const blockId = (blocks[0] as any).id as string;
      const { error: bUpdErr } = await supabase
        .from('time_blocks')
        .update({ start_at: autoStart, end_at: autoEnd })
        .eq('id', blockId)
        .eq('user_id', userId);
      if (bUpdErr) return res.status(500).json({ error: 'Failed to update time block' });
    } else if (blocks && blocks.length === 0) {
      const { error: bInsErr } = await supabase
        .from('time_blocks')
        .insert({ user_id: userId, start_at: autoStart, end_at: autoEnd, task_id: id });
      if (bInsErr) return res.status(500).json({ error: 'Failed to create time block' });
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
    if (delErr) return res.status(500).json({ error: 'Failed to update tags' });
    if (names.length > 0) {
      const upserts = names.map(n => ({ user_id: userId, name: n }));
      const { error: upErr } = await supabase
        .from('tags')
        .upsert(upserts, { onConflict: 'user_id,name' });
      if (upErr) return res.status(500).json({ error: 'Failed to upsert tags' });
      const { data: tagRows, error: selErr } = await supabase
        .from('tags')
        .select('id,name')
        .eq('user_id', userId)
        .in('name', names);
      if (selErr || !tagRows) return res.status(500).json({ error: 'Failed to load tags' });
      const links = (tagRows as any[]).map(r => ({ task_id: id, tag_id: r.id as string }));
      const { error: linkErr } = await supabase
        .from('task_tags')
        .upsert(links, { onConflict: 'task_id,tag_id' });
      if (linkErr) return res.status(500).json({ error: 'Failed to link tags' });
    }
  }
  res.json({ message: 'OK' });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;

  // First remove any time blocks associated with this task to avoid orphan blocks
  const { error: blockErr } = await supabase
    .from('time_blocks')
    .delete()
    .eq('user_id', userId)
    .eq('task_id', id);
  if (blockErr) return res.status(500).json({ error: 'Failed to delete time blocks for task' });

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return res.status(500).json({ error: 'Failed to delete task' });
  res.json({ message: 'OK' });
});

// Get unique task types for user
router.get('/types', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await supabase
    .from('tasks')
    .select('type')
    .eq('user_id', userId)
    .not('type', 'is', null);

  if (error) return res.status(500).json({ error: 'Failed to fetch types' });

  const types = Array.from(new Set((data || []).map(t => t.type).filter(Boolean)));
  res.json({ types });
});

// Get unique tags for user
router.get('/tags-list', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { data, error } = await supabase
    .from('tags')
    .select('name')
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: 'Failed to fetch tags' });

  const tags = (data || []).map(t => t.name);
  res.json({ tags });
});

export default router;
