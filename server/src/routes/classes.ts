import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { supabase } from '../db/supabase.js';
import { isAdminOfClass, isMemberOfClass } from '../utils/rbac.js';

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

 

const joinReqSchema = z.object({ invite_code: z.string().min(1) });

router.post('/join-requests', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = joinReqSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const code = parsed.data.invite_code;
  const { data: cls, error: cErr } = await supabase
    .from('classes')
    .select('id')
    .eq('join_code', code)
    .maybeSingle();
  if (cErr || !cls) return res.status(400).json({ error: 'InvalidCode' });

  const classId = cls.id as string;
  const { data: dupPending } = await supabase
    .from('class_join_requests')
    .select('id')
    .eq('class_id', classId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();
  if (dupPending) return res.status(409).json({ error: 'DuplicatePending' });

  const { data: already, error: mErr } = await supabase
    .from('class_memberships')
    .select('id')
    .eq('class_id', classId)
    .eq('user_id', userId)
    .maybeSingle();
  if (mErr) return res.status(500).json({ error: 'DB error' });
  if (already) return res.status(409).json({ error: 'AlreadyMember' });

  const { data: jr, error: jErr } = await supabase
    .from('class_join_requests')
    .insert({ class_id: classId, user_id: userId, status: 'pending' })
    .select('id, class_id, status')
    .single();
  if (jErr) return res.status(500).json({ error: 'Failed to create join request' });
  res.status(201).json(jr);
});

router.get('/:class_id/join-requests', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const classId = req.params.class_id;
  const ok = await isAdminOfClass(userId, classId);
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  let q = supabase
    .from('class_join_requests')
    .select('id, user_id, status, created_at')
    .eq('class_id', classId)
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: 'Failed to list join requests' });
  res.json({ items: data });
});

router.post('/:class_id/join-requests/:request_id/approve', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const classId = req.params.class_id;
  const requestId = req.params.request_id;
  const ok = await isAdminOfClass(userId, classId);
  if (!ok) return res.status(403).json({ error: 'Forbidden' });

  const { data: jr, error: jErr } = await supabase
    .from('class_join_requests')
    .select('id, user_id, class_id, status')
    .eq('id', requestId)
    .maybeSingle();
  if (jErr || !jr || jr.class_id !== classId) return res.status(404).json({ error: 'Not found' });

  if (jr.status !== 'pending') {
    const { error: upErr } = await supabase
      .from('class_memberships')
      .upsert({ user_id: jr.user_id, class_id: classId }, { onConflict: 'user_id,class_id' });
    if (upErr) return res.status(500).json({ error: 'Failed to ensure membership' });
    return res.json({ status: jr.status });
  }

  const nowIso = new Date().toISOString();
  const { error: uErr } = await supabase
    .from('class_join_requests')
    .update({ status: 'approved', decided_at: nowIso, decided_by: userId })
    .eq('id', requestId);
  if (uErr) return res.status(500).json({ error: 'Failed to approve' });

  const { error: upErr } = await supabase
    .from('class_memberships')
    .upsert({ user_id: jr.user_id, class_id: classId }, { onConflict: 'user_id,class_id' });
  if (upErr) return res.status(500).json({ error: 'Failed to add membership' });
  res.json({ status: 'approved' });
});

router.post('/:class_id/join-requests/:request_id/reject', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const classId = req.params.class_id;
  const requestId = req.params.request_id;
  const ok = await isAdminOfClass(userId, classId);
  if (!ok) return res.status(403).json({ error: 'Forbidden' });

  const { data: jr, error: jErr } = await supabase
    .from('class_join_requests')
    .select('id, class_id, status')
    .eq('id', requestId)
    .maybeSingle();
  if (jErr || !jr || jr.class_id !== classId) return res.status(404).json({ error: 'Not found' });

  if (jr.status !== 'pending') return res.status(409).json({ error: 'Conflict' });

  const nowIso = new Date().toISOString();
  const { error: uErr } = await supabase
    .from('class_join_requests')
    .update({ status: 'rejected', decided_at: nowIso, decided_by: userId })
    .eq('id', requestId);
  if (uErr) return res.status(500).json({ error: 'Failed to reject' });
  res.json({ status: 'rejected' });
});

router.get('/:class_id/members', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const classId = req.params.class_id;
  const admin = await isAdminOfClass(userId, classId);
  let allow = admin;
  if (!allow) allow = await isMemberOfClass(userId, classId);
  if (!allow) return res.status(403).json({ error: 'Forbidden' });

  const { data: members, error: mErr } = await supabase
    .from('class_memberships')
    .select('user_id, joined_at')
    .eq('class_id', classId)
    .order('joined_at', { ascending: true });
  if (mErr) return res.status(500).json({ error: 'Failed to list members' });

  const ids = (members || []).map(m => m.user_id);
  let users: any[] = [];
  if (ids.length > 0) {
    const { data: uList, error: uErr } = await supabase
      .from('users')
      .select('id, nickname, email')
      .in('id', ids);
    if (uErr) return res.status(500).json({ error: 'Failed to load users' });
    users = uList || [];
  }
  const userMap = new Map<string, any>(users.map(u => [u.id, u]));
  const out = (members || []).map(m => ({ user_id: m.user_id, nickname: userMap.get(m.user_id)?.nickname ?? null, joined_at: m.joined_at }));
  res.json({ members: out });
});

export default router;
