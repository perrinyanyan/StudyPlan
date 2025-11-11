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
  due_at: z.string().datetime().optional(),
  estimate_min: z.number().int().optional(),
  priority: z.number().int().optional(),
  recurrence_rule: z.string().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.string().optional(),
  color: z.string().optional(),
  due_at: z.string().datetime().nullable().optional(),
  estimate_min: z.number().int().nullable().optional(),
  priority: z.number().int().nullable().optional(),
  recurrence_rule: z.string().nullable().optional(),
  status: z.enum(['open', 'done']).optional(),
});

router.post('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const payload = parsed.data;
  const insert = {
    user_id: userId,
    title: payload.title,
    type: payload.type ?? null,
    color: payload.color ?? null,
    due_at: payload.due_at ? new Date(payload.due_at).toISOString() : null,
    estimate_min: payload.estimate_min ?? null,
    priority: payload.priority ?? null,
    recurrence_rule: payload.recurrence_rule ?? null,
  } as const;
  const { data, error } = await supabase.from('tasks').insert(insert).select('id').single();
  if (error) return res.status(500).json({ error: 'Failed to create task' });
  res.status(201).json({ id: data!.id });
});

router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const q = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  const { data, error } = status ? await q.eq('status', status) : await q;
  if (error) return res.status(500).json({ error: 'Failed to list tasks' });
  res.json({ items: data });
});

router.get('/daily', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const dateStr = typeof req.query.date === 'string' ? req.query.date : undefined;
  if (!dateStr) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
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
    .eq('status', 'open')
    .gte('due_at', start.toISOString())
    .lte('due_at', end.toISOString())
    .order('due_at', { ascending: true, nullsFirst: false });
  if (err1) return res.status(500).json({ error: 'Failed to query today tasks' });
  const { data: overdue, error: err2 } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'open')
    .lt('due_at', start.toISOString())
    .order('due_at', { ascending: true, nullsFirst: false });
  if (err2) return res.status(500).json({ error: 'Failed to query overdue tasks' });
  res.json({ today, overdue });
});

router.patch('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const payload = parsed.data;
  const update: any = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.type !== undefined) update.type = payload.type;
  if (payload.color !== undefined) update.color = payload.color;
  if (payload.due_at !== undefined) update.due_at = payload.due_at ? new Date(payload.due_at).toISOString() : null;
  if (payload.estimate_min !== undefined) update.estimate_min = payload.estimate_min;
  if (payload.priority !== undefined) update.priority = payload.priority;
  if (payload.recurrence_rule !== undefined) update.recurrence_rule = payload.recurrence_rule;
  if (payload.status !== undefined) update.status = payload.status;
  const { error } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return res.status(500).json({ error: 'Failed to update task' });
  res.json({ message: 'OK' });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return res.status(500).json({ error: 'Failed to delete task' });
  res.json({ message: 'OK' });
});

export default router;
