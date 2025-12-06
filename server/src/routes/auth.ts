import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { sendEmail } from '../utils/email.js';
import { createCaptcha, verifyCaptcha } from '../utils/captcha.js';
import bcrypt from 'bcryptjs';
import { supabase } from '../db/supabase.js';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

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

router.post('/send-code', async (req: Request, res: Response) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email' });

  const { email } = parsed.data;

  // Check if email already registered (verified)
  const { data: existing } = await supabase
    .from('users')
    .select('id, email_verified_at')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    // If verified, return error (user should login)
    if (existing.email_verified_at) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    // If not verified, we can allow re-sending code (or maybe delete old user row? 
    // adhering to current logic: we just send code. Signup will handle user creation/update)
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store in DB
  const { error: dbErr } = await supabase
    .from('email_verification_codes')
    .insert({ email, code, expires_at: expiresAt.toISOString() });

  if (dbErr) {
    console.error('Failed to store code:', dbErr);
    return res.status(500).json({ error: 'Database error' });
  }

  // Send email
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[dev] Verification code for ${email}: ${code}`);
  }

  await sendEmail({
    to: email,
    subject: 'Your Verification Code',
    html: `<p>Your verification code is: <strong>${code}</strong></p><p>It expires in 10 minutes.</p>`
  });

  res.json({ message: 'Code sent' });
});

router.post('/signup', async (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    nickname: z.string().min(1),
    code: z.string().length(6)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, nickname, password, code } = parsed.data;

  // Verify Code
  const { data: codeRecord, error: codeErr } = await supabase
    .from('email_verification_codes')
    .select('*')
    .eq('email', email)
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (codeErr || !codeRecord) {
    return res.status(400).json({ error: 'Invalid or expired verification code' });
  }

  // Check existing user again to be safe
  const { data: existing } = await supabase
    .from('users')
    .select('id, email_verified_at')
    .eq('email', email)
    .maybeSingle();

  if (existing && existing.email_verified_at) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const password_hash = await bcrypt.hash(password, 10);

  if (existing) {
    // Update existing unverified user
    const { error: upErr } = await supabase
      .from('users')
      .update({
        nickname,
        password_hash,
        email_verified_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (upErr) return res.status(500).json({ error: 'Failed to update user' });
  } else {
    // Create new user
    const { error: insErr } = await supabase
      .from('users')
      .insert({
        email,
        password_hash,
        nickname,
        email_verified_at: new Date().toISOString()
      });

    if (insErr) return res.status(500).json({ error: 'Failed to create user' });
  }

  // Delete used code (optional, or rely on expiry)
  await supabase.from('email_verification_codes').delete().eq('email', email);

  res.status(201).json({ message: 'User created successfully' });
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

  // Update last_sign_in_at
  await supabase.from('users').update({ last_sign_in_at: new Date().toISOString() }).eq('id', user.id);

  res.json({ token });
});

// Return current user's basic profile
router.get('/me', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { data, error } = await supabase
    .from('users')
    .select('id, email, nickname, avatar_url')
    .eq('id', userId)
    .single();
  if (error || !data) return res.status(500).json({ error: 'Failed to load profile' });

  // Fetch roles
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role, scope_type, scope_id')
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

  res.json({
    id: data.id,
    email: data.email,
    nickname: (data as any).nickname || '',
    avatar_url: (data as any).avatar_url || null,
    role,
    roles
  });
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

router.post('/change-password', async (req: Request, res: Response) => {
  const schema = z.object({
    old_password: z.string(),
    new_password: z.string().min(6)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { data: user, error: selErr } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', userId)
    .single();

  if (selErr || !user) return res.status(500).json({ error: 'Failed to verify user' });

  const ok = await bcrypt.compare(parsed.data.old_password, user.password_hash);
  if (!ok) return res.status(400).json({ error: 'Old password incorrect' });

  const password_hash = await bcrypt.hash(parsed.data.new_password, 10);
  const { error: upErr } = await supabase
    .from('users')
    .update({ password_hash })
    .eq('id', userId);

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

router.post('/profile/avatar', upload.single('avatar'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const userId = getUserId(req);
  if (!userId) {
    // Clean up uploaded file if unauthorized
    fs.unlinkSync(req.file.path);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;

  const { error: upErr } = await supabase
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);

  if (upErr) {
    fs.unlinkSync(req.file.path);
    return res.status(500).json({ error: 'Failed to update avatar' });
  }

  res.json({ message: 'Avatar updated', avatar_url: avatarUrl });
});

// Deletion with email confirmation
router.delete('/account', async (req: Request, res: Response) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { data: user, error: selErr } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();

  if (selErr || !user) return res.status(500).json({ error: 'Failed to fetch user' });

  if (user.email !== parsed.data.email) {
    return res.status(403).json({ error: 'Email does not match' });
  }

  // Delete user (cascade should handle related data if configured, otherwise might need manual cleanup)
  // Assuming cascade is ON for user_id foreign keys in other tables.
  const { error: delErr } = await supabase
    .from('users')
    .delete()
    .eq('id', userId);

  if (delErr) {
    console.error('Delete user error:', delErr);
    return res.status(500).json({ error: 'Failed to delete account' });
  }

  res.json({ message: 'Account deleted' });
});

export default router;
