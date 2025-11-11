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
});

router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { data, error } = await supabase
    .from('user_settings')
    .select('daily_summary_time, timezone')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'DB error' });
  if (!data) return res.json({ daily_summary_time: null, timezone: null });
  return res.json(data);
});

router.put('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = settingsSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { daily_summary_time, timezone } = parsed.data;
  // Upsert by user_id unique constraint
  const payload: any = { user_id: userId };
  if (typeof daily_summary_time !== 'undefined') payload.daily_summary_time = daily_summary_time;
  if (typeof timezone !== 'undefined') payload.timezone = timezone;
  const { error } = await supabase
    .from('user_settings')
    .upsert(payload, { onConflict: 'user_id' });
  if (error) return res.status(500).json({ error: 'Failed to save settings' });
  return res.json({ message: 'OK' });
});

export default router;
