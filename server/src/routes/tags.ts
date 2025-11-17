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

const createTagSchema = z.object({
  name: z.string().min(1),
});

router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { data, error } = await supabase
    .from('tags')
    .select('id,name,created_at')
    .eq('user_id', userId)
    .order('name');
  if (error) return res.status(500).json({ error: 'Failed to list tags' });
  res.json({ items: data });
});

router.post('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = createTagSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const name = parsed.data.name.trim().toLowerCase();

  const { data, error } = await supabase
    .from('tags')
    .upsert({ user_id: userId, name }, { onConflict: 'user_id,name' })
    .select('id')
    .single();
  if (error) return res.status(500).json({ error: 'Failed to create tag' });
  res.status(201).json({ id: data!.id });
});

export default router;
