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
import settingsRouter from './routes/settings.js';
import { getOpenApiSpec } from './openapi.js';
import { validateEnv } from './utils/env-check.js';

const app = express();
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 'loopback');
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
app.use('/settings', settingsRouter);
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
    res.type('html').send(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>登录 · Study Planner</title><style>*,*:before,*:after{box-sizing:border-box}body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:0;background:#0b1020;color:#e6edf3}a{color:#7aa2ff;text-decoration:none}.container{max-width:920px;margin:40px auto;padding:24px}.card{background:#0f172a;border:1px solid #1f2a44;border-radius:12px;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.2)}.title{margin:0 0 16px 0;font-size:20px}.row{display:flex;gap:16px;flex-wrap:wrap}.col{flex:1 1 280px}.field{margin:10px 0}.label{font-size:12px;opacity:.9}.input{width:100%;padding:10px 12px;margin-top:6px;background:#0b1222;border:1px solid #243454;border-radius:8px;color:#e6edf3;outline:none}.input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.2)}.btn{display:inline-flex;align-items:center;gap:8px;border:1px solid #2a3a5a;background:#13233a;color:#e6edf3;border-radius:8px;padding:10px 14px;cursor:pointer}.btn:hover{background:#163050}.btn.primary{background:#2563eb;border-color:#2563eb}.btn.primary:hover{background:#1d4ed8}.muted{opacity:.8}.grid{display:grid;grid-template-columns:1fr;gap:12px}.area{width:100%;min-height:84px;padding:10px 12px;background:#0b1222;border:1px solid #243454;border-radius:8px;color:#e6edf3}.pre{white-space:pre-wrap;background:#0b1222;border:1px solid #243454;border-radius:8px;padding:10px}.pill{display:inline-block;padding:2px 8px;border-radius:999px;background:#1f2a44;margin-left:8px}.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}</style></head><body><div class="container"><div class="header"><h1 style="margin:0;font-size:20px">Study Planner Dev</h1><div class="muted"><a href="/">Home</a> · <a href="/docs" target="_blank">Docs</a> · <a href="/openapi.json" target="_blank">OpenAPI</a></div></div><div class="row"><div class="col"><div class="card"><h2 class="title">登录<span id="loginState" class="pill">未登录</span></h2><div class="field"><div class="label">邮箱</div><input id="email" type="email" class="input" placeholder="you@example.com"/></div><div class="field"><div class="label">密码</div><div style="display:flex;gap:8px"><input id="password" type="password" class="input" placeholder="••••••••"/><button class="btn" id="togglePwd" type="button">显示</button></div></div><div class="field" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="btn-login" type="button">登录</button><button class="btn" id="btn-logout" type="button">登出</button><a class="btn" href="/subscribe.html" target="_blank">Web Push</a><a class="btn" href="/docs" target="_blank">Swagger</a></div></div></div><div class="col"><div class="card"><h2 class="title">JWT Token</h2><div class="grid"><textarea id="token" class="area" placeholder="登录后显示..." readonly></textarea><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="btn-copy" type="button">复制 Token</button><button class="btn" id="btn-clear" type="button">清空</button></div></div></div></div></div><div class="row"><div class="col"><div class="card"><h2 class="title">解码后的载荷</h2><pre id="claims" class="pre">(无)</pre></div></div><div class="col"><div class="card"><h2 class="title">受保护接口测试</h2><div class="field"><div class="label">示例：GET /shares<span class="muted">（需 Bearer）</span></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="btn-test" type="button">请求</button><span id="testStatus" class="muted"></span></div></div><pre id="testOut" class="pre">(未请求)</pre></div></div></div></div><script>const qs=(s)=>document.querySelector(s);const stateEl=qs('#loginState');const tokenEl=qs('#token');const claimsEl=qs('#claims');const testOut=qs('#testOut');const testStatus=qs('#testStatus');const status=()=>{const t=tokenEl.value.trim();stateEl.textContent=t?'已登录':'未登录';stateEl.style.background=t?'#1a3d24':'#3a1f24'};const saveToken=(t)=>{localStorage.setItem('jwt',t)};const loadToken=()=>localStorage.getItem('jwt')||'';const clearToken=()=>{localStorage.removeItem('jwt');tokenEl.value='';claimsEl.textContent='(无)';status()};function decodeJWT(t){try{const p=t.split('.')[1];const json=JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));const exp=json.exp?new Date(json.exp*1000).toISOString():'(无)';json._exp_iso=exp;claimsEl.textContent=JSON.stringify(json,null,2)}catch(e){claimsEl.textContent='无法解码: '+(e.message||e)}}async function login(){const email=qs('#email').value.trim();const password=qs('#password').value;try{const resp=await fetch('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});const data=await resp.json();if(!resp.ok)throw new Error(data.error||'登录失败');tokenEl.value=data.token;saveToken(data.token);decodeJWT(data.token);status()}catch(e){alert('登录失败: '+(e.message||e))}}async function testProtected(){const t=tokenEl.value.trim();if(!t){alert('请先登录');return}testStatus.textContent='请求中...';try{const resp=await fetch('/shares',{headers:{'Authorization':'Bearer '+t}});const data=await resp.json();testOut.textContent=JSON.stringify(data,null,2);testStatus.textContent=resp.ok?'OK':'错误 '+resp.status}catch(e){testOut.textContent=String(e);testStatus.textContent='异常'}}qs('#btn-login').addEventListener('click',login);qs('#btn-copy').addEventListener('click',()=>{navigator.clipboard.writeText(tokenEl.value||'')});qs('#btn-clear').addEventListener('click',clearToken);qs('#btn-test').addEventListener('click',testProtected);qs('#btn-logout').addEventListener('click',clearToken);qs('#togglePwd').addEventListener('click',()=>{const p=qs('#password');const s=p.getAttribute('type')==='password'?'text':'password';p.setAttribute('type',s);qs('#togglePwd').textContent=s==='text'?'隐藏':'显示'});window.addEventListener('load',()=>{const t=loadToken();if(t){tokenEl.value=t;decodeJWT(t)}status()});</script></body></html>`);
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
