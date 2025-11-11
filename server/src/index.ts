import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import authRouter from './routes/auth.js';
import tasksRouter from './routes/tasks.js';
import blocksRouter from './routes/blocks.js';
import coursesRouter from './routes/courses.js';
import focusRouter from './routes/focus.js';
import pushRouter from './routes/push.js';
import notificationsRouter from './routes/notifications.js';
import { startNotificationScheduler } from './scheduler/notifications.js';
import sharesRouter from './routes/shares.js';
import sharedRouter from './routes/shared.js';
import classesRouter from './routes/classes.js';
import { getOpenApiSpec } from './openapi.js';
import { validateEnv } from './utils/env-check.js';

const app = express();
validateEnv();
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
if (process.env.NODE_ENV === 'production') {
  const mod = 'helmet';
  import(mod).then(m => app.use(m.default()));
  const cmp = 'compression';
  import(cmp).then(m => app.use(m.default()));
}
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
app.use('/classes', classesRouter);
app.use('/push/subscribe', pushSubLimiter);
app.use('/push', pushRouter);
app.use('/notifications', notificationsRouter);
app.use('/shares', sharesRouter);
app.use('/shared', sharedRouter);
if (process.env.NODE_ENV !== 'production') {
  import('./routes/dev.js').then(m => app.use('/dev', m.default));
}

app.get('/openapi.json', (_req, res) => {
  res.json(getOpenApiSpec());
});

if (process.env.NODE_ENV !== 'production') {
  app.get('/docs', (_req, res) => {
    res.type('html').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>API Docs</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>window.onload=()=>{SwaggerUIBundle({url:'/openapi.json',dom_id:'#swagger-ui'});};</script></body></html>`);
  });
  app.get('/login', (_req, res) => {
    res.type('html').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>登录</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:24px;line-height:1.5}input,button{padding:8px 12px;margin:4px 0}#log{white-space:pre-wrap;background:#fafafa;border:1px solid #eee;padding:12px;border-radius:8px;min-height:80px}</style></head><body><h1>登录</h1><div><label>邮箱</label><br/><input id="email" type="email" style="width:320px"/></div><div><label>密码</label><br/><input id="password" type="password" style="width:320px"/></div><div><button id="btn-login">登录</button> <span id="status"></span></div><h3>结果</h3><div id="log"></div><script>const statusEl=document.getElementById('status');const logEl=document.getElementById('log');function log(m){const d=document.createElement('div');d.textContent='['+new Date().toLocaleTimeString()+'] '+m;logEl.appendChild(d)}async function login(){const email=document.getElementById('email').value.trim();const password=document.getElementById('password').value;try{const resp=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const data=await resp.json();if(!resp.ok)throw new Error(data.error||'登录失败');statusEl.textContent='已登录';statusEl.style.color='#0a8';log('token: '+data.token)}catch(e){statusEl.textContent='登录失败';statusEl.style.color='#c00';log('错误: '+e.message)}}document.getElementById('btn-login').addEventListener('click',()=>login());</script></body></html>`);
  });
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = typeof err?.status === 'number' ? err.status : 500;
  const prod = process.env.NODE_ENV === 'production';
  const body = prod
    ? { error: status === 500 ? 'Internal Server Error' : String(err?.message || 'Error') }
    : { error: String(err?.message || 'Error'), stack: String(err?.stack || '') };
  res.status(status).json(body);
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port} (dev mode)`);
  startNotificationScheduler();

});
