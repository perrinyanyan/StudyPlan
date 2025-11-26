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

const timeRegex = /^\d{2}:\d{2}$/;
const settingsSchema = z.object({
  daily_summary_time: z.string().regex(timeRegex, 'HH:MM expected').nullable().optional(),
  timezone: z.string().min(1).nullable().optional(),
  focus_duration_minutes: z.number().int().min(1).nullable().optional(),
  focus_start_sound: z.string().nullable().optional(),
  focus_end_sound: z.string().nullable().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { data, error } = await supabase
    .from('user_settings')
    .select('daily_summary_time, timezone, focus_duration_minutes, focus_start_sound, focus_end_sound')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'DB error' });
  if (!data) return res.json({ daily_summary_time: null, timezone: null, focus_duration_minutes: null, focus_start_sound: null, focus_end_sound: null });
  return res.json(data);
});

router.put('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = settingsSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { daily_summary_time, timezone, focus_duration_minutes, focus_start_sound, focus_end_sound } = parsed.data;
  // Upsert by user_id unique constraint
  const payload: any = { user_id: userId };
  if (typeof daily_summary_time !== 'undefined') payload.daily_summary_time = daily_summary_time;
  if (typeof timezone !== 'undefined') payload.timezone = timezone;
  if (typeof focus_duration_minutes !== 'undefined') payload.focus_duration_minutes = focus_duration_minutes;
  if (typeof focus_start_sound !== 'undefined') payload.focus_start_sound = focus_start_sound;
  if (typeof focus_end_sound !== 'undefined') payload.focus_end_sound = focus_end_sound;

  const { error } = await supabase
    .from('user_settings')
    .upsert(payload, { onConflict: 'user_id' });
  if (error) return res.status(500).json({ error: 'Failed to save settings' });
  return res.json({ message: 'OK' });
});

router.post('/clear-data', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Verify email matches logged in user
  // We can check auth.users via admin API or check our 'users' table if it syncs email
  // Assuming 'users' table has email and is synced.
  const { data: user, error: uErr } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (uErr || !user) return res.status(500).json({ error: 'Failed to fetch user info' });

  if (user.email !== email) {
    return res.status(403).json({ error: 'Email does not match' });
  }

  // Delete all tasks (cascade should handle time_blocks if configured, but let's be safe)
  // First delete time_blocks
  const { error: tbErr } = await supabase
    .from('time_blocks')
    .delete()
    .eq('user_id', userId);

  if (tbErr) return res.status(500).json({ error: 'Failed to clear time blocks' });

  // Delete tasks
  const { error: tErr } = await supabase
    .from('tasks')
    .delete()
    .eq('user_id', userId);

  if (tErr) return res.status(500).json({ error: 'Failed to clear tasks' });

  res.json({ message: 'All plans cleared' });
});

export default router;
