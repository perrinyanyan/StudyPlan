import { useEffect, useMemo, useState } from 'react'

const DEFAULT_TZ_LIST = [
  'UTC',
  'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Singapore', 'Asia/Taipei', 'Asia/Tokyo', 'Asia/Seoul', 'Asia/Bangkok', 'Asia/Kolkata',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid', 'Europe/Moscow',
  'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Toronto', 'America/Sao_Paulo',
  'Australia/Sydney', 'Pacific/Auckland'
]

function defaultTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return tz || 'Asia/Shanghai'
  } catch {
    return 'Asia/Shanghai'
  }
}

function todayStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toIso(dateStr: string, timeStr?: string) {
  const t = (timeStr || '00:00') + ':00'
  const local = new Date(`${dateStr}T${t}`)
  return local.toISOString()
}

type Task = { id: string | number; title: string; status: string; due_at?: string | null; scheduling_status?: string | null }
type Block = { id: string | number; start_at: string; end_at: string; task_id?: string | number | null }

type DailyTasks = { today?: Task[]; overdue?: Task[] }

type FetchState = 'idle' | 'loading' | 'error'

export default function App() {
  const [jwt, setJwt] = useState<string | null>(() => localStorage.getItem('jwt'))
  const [date, setDate] = useState<string>(() => todayStr())
  const [tasks, setTasks] = useState<DailyTasks>({})
  const [blocks, setBlocks] = useState<Block[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [msg, setMsg] = useState<string>('')

  // Shares
  type Share = { id: string | number; token: string; scope: 'full' | 'blocks_only'; expires_at: string }
  const [shares, setShares] = useState<Share[]>([])
  const [shareScope, setShareScope] = useState<'full' | 'blocks_only'>('full')
  const [shareDays, setShareDays] = useState<number>(7)
  const [shareMsg, setShareMsg] = useState<string>('')

  // Push
  const [pushMsg, setPushMsg] = useState<string>('')
  const [swReady, setSwReady] = useState<boolean>(false)

  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareDate, setShareDate] = useState<string>(() => todayStr())
  const [shareLoading, setShareLoading] = useState<boolean>(false)
  const [shareError, setShareError] = useState<string>('')
  type SharedBlock = { start_at: string; end_at: string; task_id?: string | number | null }
  type SharedData = { share: { scope: 'full' | 'blocks_only'; expires_at: string }; tasks?: Task[]; blocks: SharedBlock[] }
  const [shared, setShared] = useState<SharedData | null>(null)

  // Unscheduled pool
  const [unscheduled, setUnscheduled] = useState<Task[]>([])
  const [schedTimes, setSchedTimes] = useState<Record<string, { start: string; end: string }>>({})

  // User settings
  type UserSettings = { daily_summary_time: string | null; timezone: string | null }
  const [settings, setSettings] = useState<UserSettings>(() => ({ daily_summary_time: null, timezone: defaultTimeZone() }))
  const [settingsMsg, setSettingsMsg] = useState<string>('')
  const [dailyEnabled, setDailyEnabled] = useState<boolean>(false)
  const tzOptions = useMemo(() => {
    const anyIntl: any = Intl as any
    if (anyIntl && typeof anyIntl.supportedValuesOf === 'function') {
      try { return anyIntl.supportedValuesOf('timeZone') as string[] } catch {}
    }
    return DEFAULT_TZ_LIST
  }, [])

  // Planner UI enhancements
  const [hourHeight, setHourHeight] = useState<number>(48) // px per hour
  const [showFutureOnly, setShowFutureOnly] = useState<boolean>(false)
  const [overdueCollapsed, setOverdueCollapsed] = useState<boolean>(true)
  const [nowTick, setNowTick] = useState<number>(Date.now())

  const [route, setRoute] = useState<string>(() => {
    const h = location.hash || '#/planner'
    const p = h.replace(/^#/, '')
    return p || '/planner'
  })
  useEffect(() => {
    const onHash = () => {
      const h = location.hash || '#/planner'
      const p = h.replace(/^#/, '')
      setRoute(p || '/planner')
      const tok = shareTokenFromPath()
      setShareToken(tok)
      if (tok) setShareDate(todayStr())
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const current = route as string

  function headers(): Record<string, string> {
    return jwt ? { Authorization: `Bearer ${jwt}` } : {}
  }

  function rememberJwt(token: string | null) {
    if (token) localStorage.setItem('jwt', token)
    else localStorage.removeItem('jwt')
    setJwt(token)
  }

  async function doLogin(email: string, password: string) {
    setMsg('')
    const r = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setMsg(`登录失败: ${j.error || r.status}`)
      return
    }
    const j = (await r.json()) as { token: string }
    rememberJwt(j.token)
  }

  async function fetchDaily() {
    if (!jwt) return
    setFetchState('loading')
    try {
      const [t, b] = await Promise.all([
        fetch(`/tasks/daily?date=${date}`, { headers: headers() }).then((r) => r.json()),
        fetch(`/blocks/daily?date=${date}`, { headers: headers() }).then((r) => r.json()),
      ])
      setTasks(t)
      setBlocks((b?.items as Block[]) || [])
      setFetchState('idle')
    } catch (e) {
      setFetchState('error')
    }
  }

  async function fetchUnscheduled() {
    if (!jwt) return
    try {
      const r = await fetch('/tasks?status=open', { headers: headers() })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return
      const items = (j.items || []) as Task[]
      setUnscheduled(items.filter((t) => (t.scheduling_status || 'unscheduled') !== 'scheduled'))
    } catch {}
  }

  useEffect(() => {
    fetchDaily()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt, date])

  useEffect(() => {
    if (jwt) listShares()
    if (jwt) fetchUnscheduled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt])

  useEffect(() => {
    if (route !== '/planner') return
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route])

  useEffect(() => {
    if (route === '/settings' && jwt) loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, jwt])

  function shareTokenFromPath() {
    const url = new URL(location.href)
    const q = url.searchParams.get('shared')
    if (q) return q
    const hash = location.hash || ''
    let m = hash.match(/^#\/shared\/([^\/?#]+)/)
    if (m) return m[1]
    m = location.pathname.match(/^\/shared\/([^\/?#]+)/)
    return m ? m[1] : null
  }

  useEffect(() => {
    const tok = shareTokenFromPath()
    setShareToken(tok)
    if (tok) setShareDate(todayStr())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (shareToken) fetchSharedData(shareToken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken, shareDate])

  async function addTask(title: string, dueTime?: string) {
    const payload: any = { title }
    if (dueTime) payload.due_at = toIso(date, dueTime)
    const r = await fetch('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert('创建任务失败 ' + (j.error || r.status))
      return
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
  }

  async function completeTask(id: Task['id']) {
    const r = await fetch(`/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ status: 'done' }),
    })
    if (!r.ok) {
      alert('更新任务失败')
      return
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
  }

  async function deleteTask(id: Task['id']) {
    const r = await fetch(`/tasks/${id}`, { method: 'DELETE', headers: headers() })
    if (!r.ok) {
      alert('删除任务失败')
      return
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
  }

  async function addBlock(start: string, end: string, taskId?: string) {
    const payload: any = { start_at: toIso(date, start), end_at: toIso(date, end) }
    if (taskId) payload.task_id = taskId
    const r = await fetch('/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert('创建时间块失败: ' + (j.error || r.status))
      return
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
  }

  async function deleteBlock(id: Block['id']) {
    const r = await fetch(`/blocks/${id}`, { method: 'DELETE', headers: headers() })
    if (!r.ok) {
      alert('删除时间块失败')
      return
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
  }

  async function scheduleTaskQuick(taskId: string | number) {
    const key = String(taskId)
    const t = schedTimes[key]
    const start = t?.start || ''
    const end = t?.end || ''
    if (!start || !end) { alert('请选择开始/结束时间'); return }
    await addBlock(start, end, String(taskId))
    setSchedTimes((s) => ({ ...s, [key]: { start: '', end: '' } }))
  }

  // Shares
  async function listShares() {
    const r = await fetch('/shares', { headers: headers() })
    const j = await r.json()
    if (!r.ok) {
      setShareMsg('加载分享失败: ' + (j.error || r.status))
      return
    }
    setShares((j.items as Share[]) || [])
  }

  async function createShare() {
    setShareMsg('')
    const payload = { scope: shareScope, expires_in_days: shareDays }
    const r = await fetch('/shares', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() }, body: JSON.stringify(payload) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      setShareMsg('创建失败: ' + (j.error || r.status))
      return
    }
    const feUrl = `${location.origin}/#/shared/${j.token}`
    setShareMsg('已创建: ' + feUrl)
    await listShares()
  }

  async function deleteShare(id: Share['id']) {
    const r = await fetch(`/shares/${id}`, { method: 'DELETE', headers: headers() })
    if (!r.ok) {
      alert('删除失败')
      return
    }
    await listShares()
  }

  // Push
  async function ensureSW() {
    if (!('serviceWorker' in navigator)) { setPushMsg('当前浏览器不支持 Service Worker'); return null }
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) { setSwReady(true); return reg }
    const r = await navigator.serviceWorker.register('/sw.js')
    setSwReady(true)
    return r
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
    return outputArray
  }

  async function subscribePush() {
    setPushMsg('')
    try {
      const reg = await ensureSW()
      if (!reg) return
      const keyResp = await fetch('/push/public-key')
      const { key } = await keyResp.json()
      if (!key) { setPushMsg('VAPID 公钥未配置'); return }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) })
      const payload = { endpoint: sub.endpoint, keys: (sub.toJSON() as any).keys, userAgent: navigator.userAgent }
      const r = await fetch('/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers() }, body: JSON.stringify(payload) })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setPushMsg('订阅保存失败: ' + (j.error || r.status)); return }
      setPushMsg('订阅成功')
    } catch (e: any) {
      setPushMsg('订阅失败: ' + (e?.message || String(e)))
    }
  }

  async function testPush() {
    setPushMsg('')
    const r = await fetch('/notifications/test', { method: 'POST', headers: headers() })
    if (!r.ok) { const j = await r.json().catch(() => ({})); setPushMsg('触发失败: ' + (j.error || r.status)); return }
    setPushMsg('已触发测试通知')
  }

  async function loadSettings() {
    setSettingsMsg('')
    const r = await fetch('/settings', { headers: headers() })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setSettingsMsg('加载失败: ' + (j.error || r.status)); return }
    const hhmm = typeof j.daily_summary_time === 'string' && j.daily_summary_time.length >= 5 ? j.daily_summary_time.slice(0,5) : null
    setSettings({ daily_summary_time: hhmm, timezone: (j.timezone ?? defaultTimeZone()) })
    setDailyEnabled(Boolean(hhmm))
  }

  async function saveSettings() {
    setSettingsMsg('')
    const payload = { daily_summary_time: dailyEnabled ? (settings.daily_summary_time || '20:00') : null, timezone: settings.timezone || defaultTimeZone() }
    const r = await fetch('/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers() }, body: JSON.stringify(payload) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setSettingsMsg('保存失败: ' + (j.error || r.status)); return }
    setSettingsMsg('已保存')
  }

  async function fetchSharedData(tok: string) {
    setShareLoading(true)
    setShareError('')
    try {
      const q = shareDate ? `?date=${shareDate}` : ''
      const r = await fetch(`/shared/${tok}${q}`)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setShareError(j.error || String(r.status))
        setShared(null)
      } else {
        setShared(j as SharedData)
      }
    } catch (e: any) {
      setShareError(e?.message || String(e))
      setShared(null)
    } finally {
      setShareLoading(false)
    }
  }

  async function copyShared() {
    if (!shareToken) return
    const r = await fetch(`/shared/${shareToken}/copy?date=${shareDate}`, { method: 'POST', headers: headers() })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setShareError('复制失败: ' + (j.error || r.status)); return }
    setShareError('已复制')
  }

  const tasksFlat = useMemo(() => (
    [ ...(tasks.today || []), ...(tasks.overdue || []) ]
  ), [tasks])

  if (shareToken) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Shared Plan</h1>
          <div className="text-sm">
            <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => { location.href = '/' }}>返回 Planner</button>
          </div>
        </header>
        <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => setShareDate(todayStr(new Date(new Date(shareDate).getTime() - 86400000)))}>前一天</button>
            <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => setShareDate(todayStr())}>今天</button>
            <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => setShareDate(todayStr(new Date(new Date(shareDate).getTime() + 86400000)))}>后一天</button>
            <input type="date" className="px-2 py-1 rounded bg-slate-900 border border-slate-700" value={shareDate} onChange={(e) => setShareDate(e.target.value)} />
          </div>
          {shareLoading && <div className="text-slate-300">加载中...</div>}
          {shareError && <div className="text-rose-300">{shareError}</div>}
          {shared && (
            <div className="space-y-4">
              <div className="text-sm text-slate-300">scope: {shared.share.scope} · 过期: {new Date(shared.share.expires_at).toLocaleString()}</div>
              {shared.share.scope === 'full' && (
                <div>
                  <h3 className="font-semibold mb-2">任务</h3>
                  <div className="flex flex-col gap-2">
                    {(shared.tasks || []).map((t) => (
                      <div key={String(t.id)} className="p-3 rounded border border-slate-700 bg-slate-900">
                        <div>{t.title}</div>
                        <div className="text-xs text-slate-300 mt-1 flex gap-2">
                          <span>状态: {t.status}</span>
                          {t.due_at ? <span>截止: {new Date(t.due_at).toLocaleString()}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="font-semibold mb-2">时间块</h3>
                <div className="flex flex-col gap-2">
                  {(shared.blocks || []).map((b, i) => (
                    <div key={i} className="p-3 rounded border border-slate-700 bg-slate-900">
                      <div>{new Date(b.start_at).toLocaleTimeString()} — {new Date(b.end_at).toLocaleTimeString()} {b.task_id ? <span className="ml-2 text-sm text-slate-300">· 任务 {String(b.task_id)}</span> : null}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <button className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50" onClick={copyShared} disabled={!jwt}>复制到我的计划</button>
                {!jwt && <span className="ml-2 text-sm text-slate-300">请先登录</span>}
              </div>
            </div>
          )}
        </section>
      </div>
    )
  }

  if (route === '/shares') {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold">Study Planner</h1>
            <nav className="flex items-center gap-3 text-sm">
              <a href="#/planner" className={current === '/planner' ? 'text-blue-300' : 'text-slate-300'}>Planner</a>
              <a href="#/shares" className={current === '/shares' ? 'text-blue-300' : 'text-slate-300'}>分享</a>
              <a href="#/settings" className={current === '/settings' ? 'text-blue-300' : 'text-slate-300'}>设置</a>
            </nav>
          </div>
          <div className="text-sm">
            {jwt ? (
              <div className="inline-flex items-center gap-2">
                <span className="rounded-full bg-emerald-900/60 px-2 py-1">已登录</span>
                <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => rememberJwt(null)}>退出</button>
              </div>
            ) : (
              <span className="rounded-full bg-rose-900/60 px-2 py-1">未登录</span>
            )}
          </div>
        </header>

        {!jwt ? <LoginForm onLogin={doLogin} msg={msg} /> : (
          <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <h2 className="font-semibold mb-3">我的分享</h2>
            <div className="flex items-center gap-2 mb-2">
              <select className="px-2 py-2 rounded bg-slate-900 border border-slate-700" value={shareScope} onChange={(e) => setShareScope(e.target.value as any)}>
                <option value="full">完整（任务+时间块）</option>
                <option value="blocks_only">仅时间块</option>
              </select>
              <input type="number" min={1} max={365} className="w-28 px-2 py-2 rounded bg-slate-900 border border-slate-700" value={shareDays}
                onChange={(e) => setShareDays(Number(e.target.value || 7))} />
              <button className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500" onClick={createShare} disabled={!jwt}>创建分享链接</button>
            </div>
            {shareMsg && <div className="text-sm text-slate-300 mb-2">{shareMsg}</div>}
            <div className="flex flex-col gap-2">
              {shares.map((s) => (
                <div key={String(s.id)} className="p-3 rounded border border-slate-700 bg-slate-900 flex items-center justify-between">
                  <div>
                    <div>scope: {s.scope} <span className="ml-2 text-xs text-slate-300">过期: {new Date(s.expires_at).toLocaleString()}</span></div>
                    <a className="text-sm text-blue-300" href={`${location.origin}/#/shared/${s.token}`} target="_blank" rel="noreferrer">
                      {location.origin}/#/shared/{s.token}
                    </a>
                  </div>
                  <div>
                    <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => deleteShare(s.id)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  if (route === '/settings') {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold">Study Planner</h1>
            <nav className="flex items-center gap-3 text-sm">
              <a href="#/planner" className={current === '/planner' ? 'text-blue-300' : 'text-slate-300'}>Planner</a>
              <a href="#/shares" className={current === '/shares' ? 'text-blue-300' : 'text-slate-300'}>分享</a>
              <a href="#/settings" className={current === '/settings' ? 'text-blue-300' : 'text-slate-300'}>设置</a>
            </nav>
          </div>
          <div className="text-sm">
            {jwt ? (
              <div className="inline-flex items-center gap-2">
                <span className="rounded-full bg-emerald-900/60 px-2 py-1">已登录</span>
                <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => rememberJwt(null)}>退出</button>
              </div>
            ) : (
              <span className="rounded-full bg-rose-900/60 px-2 py-1">未登录</span>
            )}
          </div>
        </header>

        {!jwt ? <LoginForm onLogin={doLogin} msg={msg} /> : (
          <div className="space-y-4">
            <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h2 className="font-semibold mb-3">通知 / Web Push</h2>
              <div className="flex items-center gap-2 mb-2">
                <span className={`rounded px-2 py-1 ${swReady ? 'bg-emerald-900/60' : 'bg-slate-700'}`}>SW: {swReady ? '已就绪' : '未注册'}</span>
                <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => ensureSW()}>注册/检测</button>
                <button className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50" onClick={subscribePush} disabled={!jwt}>订阅</button>
                <button className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50" onClick={testPush} disabled={!jwt}>触发测试通知</button>
              </div>
              {pushMsg && <div className="text-sm text-slate-300">{pushMsg}</div>}
            </section>

            <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h2 className="font-semibold mb-3">用户设置</h2>
              <div className="flex items-center gap-3 mb-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={dailyEnabled} onChange={(e) => setDailyEnabled(e.target.checked)} />
                  <span>每日总结通知</span>
                </label>
                <input type="time" className="px-2 py-1 rounded bg-slate-900 border border-slate-700 disabled:opacity-50" disabled={!dailyEnabled}
                  value={settings.daily_summary_time || ''}
                  onChange={(e) => setSettings(s => ({ ...s, daily_summary_time: e.target.value || null }))} />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-sm">时区</div>
                <input list="tz-list" className="px-3 py-2 rounded bg-slate-900 border border-slate-700 w-64" value={settings.timezone || ''}
                  onChange={(e) => setSettings(s => ({ ...s, timezone: e.target.value || null }))} placeholder={defaultTimeZone()} />
                <datalist id="tz-list">
                  {tzOptions.map((z) => (<option key={z} value={z} />))}
                </datalist>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500" onClick={saveSettings}>保存</button>
                {settingsMsg && <div className="text-sm text-slate-300">{settingsMsg}</div>}
              </div>
            </section>
          </div>
        )}
      </div>
    )
  }

  // Planner derived values
  const isToday = date === todayStr()
  const now = new Date(nowTick)
  const currentBlock = isToday ? blocks.find(b => new Date(b.start_at) <= now && now < new Date(b.end_at)) : undefined
  const currentTaskId = currentBlock?.task_id
  const pxPerMin = hourHeight / 60
  const filteredBlocks = isToday && showFutureOnly ? blocks.filter(b => new Date(b.end_at) >= now) : blocks

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold">Study Planner</h1>
          <nav className="flex items-center gap-3 text-sm">
            <a href="#/planner" className={current === '/planner' ? 'text-blue-300' : 'text-slate-300'}>Planner</a>
            <a href="#/shares" className={current === '/shares' ? 'text-blue-300' : 'text-slate-300'}>分享</a>
            <a href="#/settings" className={current === '/settings' ? 'text-blue-300' : 'text-slate-300'}>设置</a>
          </nav>
        </div>
        <div className="text-sm">
          {jwt ? (
            <div className="inline-flex items-center gap-2">
              <span className="rounded-full bg-emerald-900/60 px-2 py-1">已登录</span>
              <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => rememberJwt(null)}>退出</button>
            </div>
          ) : (
            <span className="rounded-full bg-rose-900/60 px-2 py-1">未登录</span>
          )}
        </div>
      </header>

      {!jwt ? <LoginForm onLogin={doLogin} msg={msg} /> : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2">
            <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h2 className="font-semibold mb-3">任务</h2>
              <AddTask onAdd={addTask} />
              <hr className="my-3 border-slate-700" />
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm text-slate-300">未排程任务池</h3>
                  <button className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={fetchUnscheduled}>刷新</button>
                </div>
                <div className="flex flex-col gap-2">
                  {unscheduled.length === 0 && <div className="text-xs text-slate-400">暂无未排程任务</div>}
                  {unscheduled.map((t) => (
                    <div key={String(t.id)} className="p-2 rounded border border-slate-700 bg-slate-900">
                      <div className="text-sm mb-2">{t.title}</div>
                      <div className="flex items-center gap-2">
                        <input type="time" className="w-28 px-2 py-1 rounded bg-slate-900 border border-slate-700" value={schedTimes[String(t.id)]?.start || ''}
                          onChange={(e) => setSchedTimes((s) => ({ ...s, [String(t.id)]: { start: e.target.value, end: s[String(t.id)]?.end || '' } }))} />
                        <span className="text-slate-400">—</span>
                        <input type="time" className="w-28 px-2 py-1 rounded bg-slate-900 border border-slate-700" value={schedTimes[String(t.id)]?.end || ''}
                          onChange={(e) => setSchedTimes((s) => ({ ...s, [String(t.id)]: { start: s[String(t.id)]?.start || '', end: e.target.value } }))} />
                        <button className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500" onClick={() => scheduleTaskQuick(t.id)}>排程到 {date}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <h3 className="text-sm text-slate-300 mb-2">今天</h3>
              <div className="flex flex-col gap-2">
                {(tasks.today || []).map((t) => (
                  <TaskItem key={String(t.id)} t={t} highlight={currentTaskId != null && String(t.id) === String(currentTaskId)} onDone={() => completeTask(t.id)} onDelete={() => deleteTask(t.id)} />
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 mb-2">
                <h3 className="text-sm text-slate-300">逾期</h3>
                <button className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => setOverdueCollapsed(v => !v)}>{overdueCollapsed ? '展开' : '收起'}</button>
              </div>
              {!overdueCollapsed && (
                <div className="flex flex-col gap-2">
                  {(tasks.overdue || []).map((t) => (
                    <TaskItem key={String(t.id)} t={t} overdue onDone={() => completeTask(t.id)} onDelete={() => deleteTask(t.id)} />
                  ))}
                </div>
              )}
            </section>
          </div>
          <div className="md:col-span-3">
            <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <h2 className="font-semibold mb-3">时间块（日视图）</h2>
              <div className="flex items-center gap-2 mb-3">
                <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => setDate(todayStr(new Date(new Date(date).getTime() - 86400000)))}>前一天</button>
                <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => setDate(todayStr())}>今天</button>
                <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => setDate(todayStr(new Date(new Date(date).getTime() + 86400000)))}>后一天</button>
                <input type="date" className="px-2 py-1 rounded bg-slate-900 border border-slate-700" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-sm">缩放</div>
                <input type="range" min={24} max={120} step={4} value={hourHeight} onChange={(e) => setHourHeight(parseInt(e.target.value || '48'))} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showFutureOnly} onChange={(e) => setShowFutureOnly(e.target.checked)} />
                  <span>仅显示未来时段</span>
                </label>
              </div>
              <AddBlock tasks={tasksFlat} onAdd={addBlock} />
              <hr className="my-3 border-slate-700" />
              {isToday && currentBlock && (
                <div className="mb-3 p-3 rounded border border-amber-400 bg-amber-900/20 text-amber-200">
                  <div className="text-sm">当前时段</div>
                  <div className="text-base">
                    {new Date(currentBlock.start_at).toLocaleTimeString()} — {new Date(currentBlock.end_at).toLocaleTimeString()}
                  </div>
                  <div className="text-sm mt-1">剩余：{(() => {
                    const ms = new Date(currentBlock.end_at).getTime() - now.getTime()
                    if (ms <= 0) return '已结束'
                    const mm = Math.floor(ms / 60000)
                    const ss = Math.floor((ms % 60000) / 1000)
                    const hh = Math.floor(mm / 60)
                    const m2 = mm % 60
                    return hh > 0 ? `${hh}小时${m2}分${String(ss).padStart(2, '0')}秒` : `${m2}分${String(ss).padStart(2, '0')}秒`
                  })()}</div>
                </div>
              )}
              <div className="relative border border-slate-700 rounded-lg bg-slate-900 overflow-hidden mb-3" style={{ height: `${24 * hourHeight}px` }}>
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="absolute left-0 right-0 border-t border-slate-800" style={{ top: `${h * hourHeight}px` }}>
                    <div className="absolute left-2 -translate-y-1/2 text-[10px] text-slate-400">{String(h).padStart(2, '0')}:00</div>
                  </div>
                ))}
                {isToday && (
                  <div className="absolute left-0 right-0 border-t border-rose-500" style={{ top: `${(now.getHours() * 60 + now.getMinutes()) * pxPerMin}px` }} />
                )}
                {filteredBlocks.map((b) => {
                  const s = new Date(b.start_at)
                  const e = new Date(b.end_at)
                  let startMin = s.getHours() * 60 + s.getMinutes()
                  let endMin = e.getHours() * 60 + e.getMinutes()
                  startMin = Math.max(0, Math.min(1440, startMin))
                  endMin = Math.max(0, Math.min(1440, endMin))
                  const top = startMin * pxPerMin
                  const height = Math.max(2, (endMin - startMin) * pxPerMin)
                  const isCur = currentBlock && String((currentBlock as any).id) === String(b.id)
                  return (
                    <div key={String(b.id)} className={`absolute left-1 right-1 rounded border ${isCur ? 'border-amber-400 ring-2 ring-amber-400' : 'border-blue-500'} bg-blue-600/40`} style={{ top, height }}>
                      <div className="px-2 py-1 text-xs">
                        {s.toLocaleTimeString()} — {e.toLocaleTimeString()} {b.task_id ? <span className="ml-2">· 任务 {String(b.task_id)}</span> : null}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-col gap-2">
                {fetchState === 'error' && <div className="text-rose-300">加载失败</div>}
                {blocks.map((b) => (
                  <div key={String(b.id)} className="p-3 rounded border border-slate-700 bg-slate-900 flex items-center justify-between">
                    <div>
                      <div>
                        {new Date(b.start_at).toLocaleTimeString()} — {new Date(b.end_at).toLocaleTimeString()}
                        {b.task_id ? <span className="ml-2 text-sm text-slate-300">· 任务 {String(b.task_id)}</span> : null}
                      </div>
                    </div>
                    <div>
                      <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => deleteBlock(b.id)}>删除</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            
          </div>
        </div>
      )}
    </div>
  )
}

function LoginForm({ onLogin, msg }: { onLogin: (email: string, password: string) => void; msg: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <section className="max-w-md mx-auto bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <h2 className="font-semibold mb-4">登录</h2>
      <div className="space-y-3">
        <div>
          <div className="text-sm">邮箱</div>
          <input className="mt-1 w-full px-3 py-2 rounded bg-slate-900 border border-slate-700" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <div className="text-sm">密码</div>
          <input type="password" className="mt-1 w-full px-3 py-2 rounded bg-slate-900 border border-slate-700" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
        </div>
        {msg && <div className="text-rose-300 text-sm">{msg}</div>}
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500" onClick={() => onLogin(email, password)}>登录</button>
        </div>
      </div>
    </section>
  )
}

function TaskItem({ t, overdue, highlight, onDone, onDelete }: { t: Task; overdue?: boolean; highlight?: boolean; onDone: () => void; onDelete: () => void }) {
  return (
    <div className={`p-3 rounded border ${highlight ? 'border-amber-400 ring-2 ring-amber-400' : 'border-slate-700'} bg-slate-900 flex items-center justify-between`}>
      <div>
        <div>{t.title}</div>
        <div className="text-xs text-slate-300 mt-1 flex gap-2">
          <span>状态: {t.status}</span>
          {t.due_at ? <span>截止: {new Date(t.due_at).toLocaleString()}</span> : null}
          {overdue ? <span className="text-rose-300">逾期</span> : null}
        </div>
      </div>
      <div className="flex gap-2">
        <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={onDone}>完成</button>
        <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={onDelete}>删除</button>
      </div>
    </div>
  )
}

function AddTask({ onAdd }: { onAdd: (title: string, dueTime?: string) => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  return (
    <div className="flex items-center gap-2">
      <input className="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-700" placeholder="任务标题" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="time" className="w-36 px-2 py-2 rounded bg-slate-900 border border-slate-700" value={due} onChange={(e) => setDue(e.target.value)} />
      <button className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500" onClick={() => { if (!title.trim()) return alert('请输入任务标题'); onAdd(title, due || undefined); setTitle(''); setDue('') }}>添加</button>
    </div>
  )
}

function AddBlock({ tasks, onAdd }: { tasks: Task[]; onAdd: (start: string, end: string, taskId?: string) => void }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [taskId, setTaskId] = useState('')
  return (
    <div className="flex items-center gap-2">
      <input type="time" className="w-36 px-2 py-2 rounded bg-slate-900 border border-slate-700" value={start} onChange={(e) => setStart(e.target.value)} />
      <input type="time" className="w-36 px-2 py-2 rounded bg-slate-900 border border-slate-700" value={end} onChange={(e) => setEnd(e.target.value)} />
      <select className="w-56 px-2 py-2 rounded bg-slate-900 border border-slate-700" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
        <option value="">无关联任务</option>
        {tasks.map((t) => (
          <option key={String(t.id)} value={String(t.id)}>{t.title}</option>
        ))}
      </select>
      <button className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500" onClick={() => { if (!start || !end) return alert('请选择开始/结束时间'); onAdd(start, end, taskId || undefined); setStart(''); setEnd(''); setTaskId('') }}>添加时间块</button>
    </div>
  )
}
