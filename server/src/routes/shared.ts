import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';

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

async function getShareByToken(token: string) {
  const { data, error } = await supabase
    .from('shares')
    .select('id, owner_user_id, scope, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (error) throw new Error('DB error');
  if (!data) return null;
  if (new Date(data.expires_at) <= new Date()) return 'expired';
  return data;
}

function dayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000Z`).toISOString();
  const end = new Date(`${dateStr}T23:59:59.999Z`).toISOString();
  return { start, end };
}

router.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  const share = await getShareByToken(token);
  if (share === null) return res.status(404).json({ error: 'Not found' });
  if (share === 'expired') return res.status(410).json({ error: 'Expired' });
  const dateStr = typeof req.query.date === 'string' ? req.query.date : undefined;
  let q = supabase
    .from('time_blocks')
    .select('id, start_at, end_at, task_id')
    .eq('user_id', (share as any).owner_user_id)
    .order('start_at', { ascending: true });
  if (dateStr) {
    const { start, end } = dayRange(dateStr);
    q = q.lt('start_at', end).gt('end_at', start);
  }
  const { data: blocks, error: bErr } = await q;
  if (bErr) return res.status(500).json({ error: 'Failed to load blocks' });

  if ((share as any).scope === 'blocks_only') {
    const sanitized = (blocks || []).map(b => ({ start_at: b.start_at, end_at: b.end_at }));
    return res.json({ share: { scope: 'blocks_only', expires_at: (share as any).expires_at }, blocks: sanitized });
  }

  const taskIds = Array.from(new Set((blocks || []).map(b => b.task_id).filter(Boolean)));
  let tasks: any[] = [];
  if (taskIds.length > 0) {
    const { data: tks, error: tErr } = await supabase
      .from('tasks')
      .select('id, title, type, color, due_at, estimate_min, priority, recurrence_rule, status, scheduling_status')
      .in('id', taskIds as string[]);
    if (tErr) return res.status(500).json({ error: 'Failed to load tasks' });
    tasks = tks || [];
  }
  const outBlocks = (blocks || []).map(b => ({ start_at: b.start_at, end_at: b.end_at, task_id: b.task_id }));
  return res.json({ share: { scope: 'full', expires_at: (share as any).expires_at }, tasks, blocks: outBlocks });
});

router.post('/:token/copy', async (req: Request, res: Response) => {
  const viewerId = getUserId(req);
  if (!viewerId) return res.status(401).json({ error: 'Unauthorized' });
  const { token } = req.params;
  const dateStr = typeof req.query.date === 'string' ? req.query.date : undefined;
  if (!dateStr) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
  const share = await getShareByToken(token);
  if (share === null) return res.status(404).json({ error: 'Not found' });
  if (share === 'expired') return res.status(410).json({ error: 'Expired' });
  const { start, end } = dayRange(dateStr);
  const { data: blocks, error: bErr } = await supabase
    .from('time_blocks')
    .select('id, start_at, end_at, task_id')
    .eq('user_id', (share as any).owner_user_id)
    .lt('start_at', end)
    .gt('end_at', start)
    .order('start_at', { ascending: true });
  if (bErr) return res.status(500).json({ error: 'Failed to load blocks' });

  if ((share as any).scope === 'blocks_only') {
    const payload = (blocks || []).map(b => ({ user_id: viewerId, start_at: b.start_at, end_at: b.end_at, task_id: null }));
    if (payload.length === 0) return res.json({ created_blocks: 0 });
    const { error: insErr } = await supabase.from('time_blocks').insert(payload);
    if (insErr) return res.status(500).json({ error: 'Failed to copy blocks' });
    return res.json({ created_blocks: payload.length });
  }

  const taskIds = Array.from(new Set((blocks || []).map(b => b.task_id).filter(Boolean))) as string[];
  const taskMap = new Map<string, string>();
  if (taskIds.length > 0) {
    for (const tid of taskIds) {
      const { data: t, error: tErr } = await supabase
        .from('tasks')
        .select('id, title, type, color, due_at, estimate_min, priority, recurrence_rule, status')
        .eq('id', tid)
        .single();
      if (tErr || !t) return res.status(500).json({ error: 'Failed to load task' });
      const insert = {
        user_id: viewerId,
        title: t.title,
        type: t.type ?? null,
        color: t.color ?? null,
        due_at: t.due_at ?? null,
        estimate_min: t.estimate_min ?? null,
        priority: t.priority ?? null,
        recurrence_rule: t.recurrence_rule ?? null,
        status: t.status,
      } as const;
      const { data: newT, error: iErr } = await supabase
        .from('tasks')
        .insert(insert)
        .select('id')
        .single();
      if (iErr || !newT) return res.status(500).json({ error: 'Failed to copy task' });
      taskMap.set(tid, newT.id);
    }
  }
  const blockPayload = (blocks || []).map(b => ({ user_id: viewerId, start_at: b.start_at, end_at: b.end_at, task_id: b.task_id ? taskMap.get(b.task_id) ?? null : null }));
  if (blockPayload.length > 0) {
    const { error: bInsErr } = await supabase.from('time_blocks').insert(blockPayload);
    if (bInsErr) return res.status(500).json({ error: 'Failed to copy blocks' });
  }
  return res.json({ created_tasks: taskMap.size, created_blocks: blockPayload.length });
});

export default router;
