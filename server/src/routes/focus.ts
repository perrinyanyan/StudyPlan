import { Router } from 'express';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
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

const startSchema = z.object({
  task_id: z.string().uuid().nullable().optional(),
  started_at: z.string().datetime().optional(),
});

const endSchema = z.object({
  ended_at: z.string().datetime().optional(),
});

router.post('/start', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { data: active, error: aErr } = await supabase
    .from('focus_sessions')
    .select('id')
    .eq('user_id', userId)
    .is('ended_at', null)
    .maybeSingle();
  if (aErr && aErr.code !== 'PGRST116') return res.status(500).json({ error: 'DB error' });
  if (active) return res.status(409).json({ error: 'Active session exists' });

  const started_at = parsed.data.started_at ? new Date(parsed.data.started_at).toISOString() : new Date().toISOString();
  const insert = { user_id: userId, task_id: parsed.data.task_id ?? null, started_at } as const;
  const { data, error } = await supabase
    .from('focus_sessions')
    .insert(insert)
    .select('id')
    .single();
  if (error) return res.status(500).json({ error: 'Failed to start session' });
  res.status(201).json({ id: data.id });
});

router.post('/end', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = endSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { data: session, error: sErr } = await supabase
    .from('focus_sessions')
    .select('id, started_at')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sErr && sErr.code !== 'PGRST116') return res.status(500).json({ error: 'DB error' });
  if (!session) return res.status(404).json({ error: 'No active session' });

  const ended_at = parsed.data.ended_at ? new Date(parsed.data.ended_at).toISOString() : new Date().toISOString();
  const { error: uErr } = await supabase
    .from('focus_sessions')
    .update({ ended_at })
    .eq('id', session.id)
    .eq('user_id', userId);
  if (uErr) return res.status(500).json({ error: 'Failed to end session' });
  res.json({ message: 'OK' });
});

router.get('/stats', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : new Date();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const { data, error } = await supabase
    .from('focus_sessions')
    .select('started_at, ended_at')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .lte('started_at', toIso)
    .gte('ended_at', fromIso);
  if (error) return res.status(500).json({ error: 'Failed to load stats' });

  const byDay: Record<string, { minutes: number; sessions: number }> = {};
  let totalMinutes = 0;
  let sessionsCount = 0;
  for (const row of data || []) {
    const start = new Date(row.started_at);
    const end = new Date(row.ended_at as string);
    const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    const day = end.toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = { minutes: 0, sessions: 0 };
    byDay[day].minutes += minutes;
    byDay[day].sessions += 1;
    totalMinutes += minutes;
    sessionsCount += 1;
  }
  res.json({ total_minutes: totalMinutes, sessions_count: sessionsCount, by_day: byDay });
});

export default router;
