import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../utils/email.js';
import { createCaptcha, verifyCaptcha } from '../utils/captcha.js';
import bcrypt from 'bcryptjs';
import { supabase } from '../db/supabase.js';
import type { Request, Response } from 'express';

const router = Router();

// In-memory verification tokens for MVP; replace with DB later
const emailVerifications = new Map<string, { email: string; expireAt: number }>();
const passwordResets = new Map<string, { email: string; expireAt: number }>();
const TOKEN_TTL_MS = 30 * 60 * 1000;
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

function mktoken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

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

router.get('/captcha', (_req: Request, res: Response) => {
  const { id, svg } = createCaptcha();
  res.json({ id, svg });
});

router.post('/signup', async (req: Request, res: Response) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(6), nickname: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, nickname, password } = parsed.data as { email: string; nickname: string; password: string };

  // Check existing user
  const { data: existing, error: exErr } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (exErr && exErr.code !== 'PGRST116') return res.status(500).json({ error: 'DB error' });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = await bcrypt.hash(password, 10);
  const { error: insErr } = await supabase.from('users').insert({ email, password_hash, nickname });
  if (insErr) return res.status(500).json({ error: 'Failed to create user' });

  const token = mktoken();
  emailVerifications.set(token, { email, expireAt: Date.now() + TOKEN_TTL_MS });
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[dev] verify-email token for ${email}: ${token}`);
  }
  const base = process.env.APP_BASE_URL || 'http://localhost:3000';
  const link = `${base}/verify-email?token=${token}`;
  await sendEmail({ to: email, subject: 'Verify your email', html: `点击验证：<a href="${link}">${link}</a>` });
  res.status(201).json({ message: 'Signup pending verification. Check email.' });
});

router.post('/verify-email', async (req: Request, res: Response) => {
  const schema = z.object({ token: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const rec = emailVerifications.get(parsed.data.token);
  if (!rec || rec.expireAt < Date.now()) return res.status(400).json({ error: 'Token invalid or expired' });
  emailVerifications.delete(parsed.data.token);
  const { error: upErr } = await supabase
    .from('users')
    .update({ email_verified_at: new Date().toISOString() })
    .eq('email', rec.email);
  if (upErr) return res.status(500).json({ error: 'Failed to verify email' });
  res.json({ message: 'Email verified' });
});

router.post('/login', async (req: Request, res: Response) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password } = parsed.data;
  const { data: user, error: selErr } = await supabase
    .from('users')
    .select('id, password_hash, email_verified_at')
    .eq('email', email)
    .single();
  if (selErr || !user) return res.status(400).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
  if (!user.email_verified_at) return res.status(403).json({ error: 'Email not verified' });
  const token = jwt.sign({ sub: user.id, email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// Return current user's basic profile
router.get('/me', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { data, error } = await supabase
    .from('users')
    .select('id, email, nickname')
    .eq('id', userId)
    .single();
  if (error || !data) return res.status(500).json({ error: 'Failed to load profile' });

  // Fetch roles
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  // Determine primary role for frontend (system_admin > school_admin > class_admin > student)
  let role = 'student';
  if (roles && roles.length > 0) {
    const roleNames = roles.map(r => r.role);
    if (roleNames.includes('system_admin')) role = 'system_admin';
    else if (roleNames.includes('school_admin')) role = 'school_admin';
    else if (roleNames.includes('class_admin')) role = 'class_admin';
  }

  // Temporary backdoor for dev/debugging if DB permissions are broken
  if (data.email === '46464126@qq.com') {
    role = 'system_admin';
  }

  res.json({ id: data.id, email: data.email, nickname: (data as any).nickname || '', role });
});

router.post('/request-password-reset', async (req: Request, res: Response) => {
  const schema = z.object({ email: z.string().email(), captcha_id: z.string(), captcha_answer: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const ok = verifyCaptcha(parsed.data.captcha_id, parsed.data.captcha_answer);
  if (!ok) return res.status(400).json({ error: 'Invalid captcha' });
  const token = mktoken();
  passwordResets.set(token, { email: parsed.data.email, expireAt: Date.now() + TOKEN_TTL_MS });
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[dev] reset-password token for ${parsed.data.email}: ${token}`);
  }
  const base = process.env.APP_BASE_URL || 'http://localhost:3000';
  const link = `${base}/reset-password?token=${token}`;
  await sendEmail({ to: parsed.data.email, subject: 'Reset your password', html: `点击重置：<a href="${link}">${link}</a>` });
  res.json({ message: 'Reset link sent if email exists' });
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const schema = z.object({ token: z.string(), new_password: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const rec = passwordResets.get(parsed.data.token);
  if (!rec || rec.expireAt < Date.now()) return res.status(400).json({ error: 'Token invalid or expired' });
  passwordResets.delete(parsed.data.token);
  const password_hash = await bcrypt.hash(parsed.data.new_password, 10);
  const { error: upErr } = await supabase
    .from('users')
    .update({ password_hash })
    .eq('email', rec.email);
  if (upErr) return res.status(500).json({ error: 'Failed to update password' });
  res.json({ message: 'Password updated' });
});

router.patch('/profile/nickname', async (req: Request, res: Response) => {
  const schema = z.object({ nickname: z.string().min(1), captcha_id: z.string(), captcha_answer: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const ok = verifyCaptcha(parsed.data.captcha_id, parsed.data.captcha_answer);
  if (!ok) return res.status(400).json({ error: 'Invalid captcha' });
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { error: upErr } = await supabase
    .from('users')
    .update({ nickname: parsed.data.nickname })
    .eq('id', userId);
  if (upErr) return res.status(500).json({ error: 'Failed to update nickname' });
  res.json({ message: 'Nickname updated' });
});

export default router;
