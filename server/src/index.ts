import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth.js';
import tasksRouter from './routes/tasks.js';
import blocksRouter from './routes/blocks.js';
import coursesRouter from './routes/courses.js';
import focusRouter from './routes/focus.js';
import pushRouter from './routes/push.js';
import notificationsRouter from './routes/notifications.js';
import { startNotificationScheduler } from './scheduler/notifications.js';

const app = express();
// CORS allowlist via env CORS_ALLOW_ORIGINS (comma separated). If unset, allow all.
const allowlist = (process.env.CORS_ALLOW_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowlist.length === 0) return cb(null, true);
    if (allowlist.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static('public'));
}

// Rate limits
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const captchaLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const pushSubLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth/captcha', captchaLimiter);
app.use('/auth', authLimiter, authRouter);
app.use('/tasks', tasksRouter);
app.use('/blocks', blocksRouter);
app.use('/courses', coursesRouter);
app.use('/focus', focusRouter);
app.use('/push/subscribe', pushSubLimiter);
app.use('/push', pushRouter);
app.use('/notifications', notificationsRouter);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port} (dev mode)`);
  startNotificationScheduler();
});
