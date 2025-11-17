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

function ScheduleTaskModal({ task, defaultDate, onClose, onSave }: { task: Task; defaultDate: string; onClose: () => void; onSave: (dateStr: string, start: string, end: string) => Promise<boolean> }) {
  const [timeMode, setTimeMode] = useState<'duration' | 'end'>('duration')
  const [start, setStart] = useState<string>('20:00')
  const [duration, setDuration] = useState<string>('')
  const [end, setEnd] = useState<string>('')
  const [dateStr, setDateStr] = useState<string>(defaultDate)

  function parseDurationMin(s: string): number | null {
    const str = s.trim()
    if (!str) return null
    const mm = str.match(/^([0-9]{1,2}):(\d{2})$/)
    if (mm) {
      const h = parseInt(mm[1])
      const m = parseInt(mm[2])
      return h * 60 + m
    }
    let total = 0
    const h = str.match(/(\d+)\s*h/) || str.match(/(\d+)小时/)
    if (h) total += parseInt(h[1]) * 60
    const m = str.match(/(\d+)\s*m/) || str.match(/(\d+)分/)
    if (m) total += parseInt(m[1])
    if (!h && !m) {
      const onlyMin = str.match(/^\d+$/)
      if (onlyMin) return parseInt(str)
      return null
    }
    return total
  }

  function addHHMM(a: string, minutes: number): string {
    const [hh, mm] = a.split(':').map((x) => parseInt(x))
    let t = hh * 60 + mm + minutes
    if (!isFinite(t)) t = 0
    if (t < 0) t = 0
    if (t > 24 * 60 - 1) t = 24 * 60 - 1
    const H = String(Math.floor(t / 60)).padStart(2, '0')
    const M = String(t % 60).padStart(2, '0')
    return `${H}:${M}`
  }

  async function submit() {
    if (!dateStr) { alert('请选择日期'); return }
    let ok = false
    if (timeMode === 'duration') {
      if (!start) { alert('请选择开始时间'); return }
      const est = parseDurationMin(duration || '')
      if (est == null || est <= 0) { alert('请填写正确的预计时长，如 1h 30m 或 90'); return }
      const endTime = addHHMM(start, est)
      ok = await onSave(dateStr, start, endTime)
    } else {
      if (!start || !end) { alert('请选择开始与结束时间'); return }
      if (end <= start) { alert('结束时间必须晚于开始时间'); return }
      ok = await onSave(dateStr, start, end)
    }
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-white text-lg font-semibold">安排任务</h2>
          <button className="text-white/60 hover:text-white" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="px-4 py-4 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
          <div className="space-y-1.5">
            <p className="text-white text-sm font-medium leading-tight">{task.title}</p>
            <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-white/80">
              {task.type && (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task.color || '#9CA3AF' }}></span>
                  <span>{task.type}</span>
                </span>
              )}
              {typeof task.priority === 'number' && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium ${
                    task.priority === 2
                      ? 'bg-red-500/20 text-red-300'
                      : task.priority === 1
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : 'bg-green-500/20 text-green-300'
                  }`}
                >
                  {task.priority === 2 ? '高' : task.priority === 1 ? '中' : '低'}
                </span>
              )}
              {(task.tags || []).map((g) => (
                <span key={g} className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300">#{g}</span>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col">
              <p className="text-xs text-slate-300 pb-1.5">日期</p>
              <input
                type="date"
                className="h-9 rounded-lg border border-slate-600 bg-slate-900/80 text-xs text-white px-2 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </label>
            <div className="flex flex-col">
              <p className="text-xs text-slate-300 pb-1.5">时间模式</p>
              <div className="flex w-fit rounded-lg border border-white/10 bg-white/5 p-1">
                <label>
                  <input className="sr-only peer" name="time-mode2" type="radio" value="duration" checked={timeMode==='duration'} onChange={() => setTimeMode('duration')} />
                  <div className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 peer-checked:bg-[#137fec] peer-checked:text-white cursor-pointer">开始 & 时长</div>
                </label>
                <label>
                  <input className="sr-only peer" name="time-mode2" type="radio" value="end" checked={timeMode==='end'} onChange={() => setTimeMode('end')} />
                  <div className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 peer-checked:bg-[#137fec] peer-checked:text-white cursor-pointer">开始 & 结束</div>
                </label>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="flex flex-col min-w-40 flex-1">
              <p className="text-xs text-slate-300 pb-1.5">开始时间</p>
              <input className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white placeholder-slate-500 px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            {timeMode === 'duration' ? (
              <label className="flex flex-col min-w-40 flex-1">
                <p className="text-xs text-slate-300 pb-1.5">预计时长</p>
                <input className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white placeholder-slate-500 px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60" placeholder="例如, 1h 30m 或 90" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </label>
            ) : (
              <label className="flex flex-col min-w-40 flex-1">
                <p className="text-xs text-slate-300 pb-1.5">结束时间</p>
                <input className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white placeholder-slate-500 px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </label>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-white/10 bg-slate-900">
          <button className="px-4 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600" onClick={onClose}>取消</button>
          <button className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#137fec] hover:bg-[#0f6cc8]" onClick={submit}>安排</button>
        </div>
      </div>
    </div>
  )
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

function fmtHHmm(d: Date) {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function fmtYmdHM(d: Date) {
  return `${todayStr(d)} ${fmtHHmm(d)}`
}

type Task = { id: string | number; title: string; status: string; due_at?: string | null; estimate_min?: number | null; priority?: number | null; type?: string | null; color?: string | null; recurrence_rule?: string | null; scheduling_status?: string | null; tags?: string[] }
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
  const [scheduleFor, setScheduleFor] = useState<Task | null>(null)

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

  function formatYmdWeek(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const w = weekdays[d.getDay()]
    return `${y}年${m}月${day}日 ${w}`
  }

  // Planner UI enhancements
  const [showFutureOnly, setShowFutureOnly] = useState<boolean>(false)
  const [overdueCollapsed, setOverdueCollapsed] = useState<boolean>(true)
  const [nowTick, setNowTick] = useState<number>(Date.now())
  const [hourCollapsed, setHourCollapsed] = useState<Record<number, boolean>>({})
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('ui.sidebar.collapsed') === '1' } catch { return false }
  })
  const [listFilterOverdue, setListFilterOverdue] = useState<'all' | 'yes' | 'no'>('all')
  const [listFilterDone, setListFilterDone] = useState<'all' | 'done' | 'open'>('all')
  const [listFilterType, setListFilterType] = useState<string>('all')
  const [listFilterPriority, setListFilterPriority] = useState<'all' | '2' | '1' | '0'>('all')
  const [listFilterTag, setListFilterTag] = useState<string>('all')
  const [listMenuOpenId, setListMenuOpenId] = useState<string | null>(null)
  const [unschedMenuOpenId, setUnschedMenuOpenId] = useState<string | null>(null)
  const [listEdit, setListEdit] = useState<{ taskId: string; priority: number | null; type: string; tagsInput: string } | null>(null)
  const [listRangeStart, setListRangeStart] = useState<string>(() => todayStr())
  const [listRangeEnd, setListRangeEnd] = useState<string>(() => todayStr(new Date(Date.now() + 6 * 86400000)))
  const [listRangePickerOpen, setListRangePickerOpen] = useState<boolean>(false)
  const [rangeBlocks, setRangeBlocks] = useState<Block[] | null>(null)
  const [rangeBlocksLoading, setRangeBlocksLoading] = useState<boolean>(false)
  const [rangeTasks, setRangeTasks] = useState<Task[] | null>(null)
  const [rangeReloadKey, setRangeReloadKey] = useState<number>(0)
  const [centerAlert, setCenterAlert] = useState<{ title: string; detail?: string } | null>(null)
  const [profile, setProfile] = useState<{ id: string | number; email: string; nickname?: string } | null>(null)
  const [showCreateTask, setShowCreateTask] = useState<boolean>(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [vw, setVw] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const isSmall = vw < 768

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

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const prevAlert = window.alert
    window.alert = (message?: string) => {
      const text = typeof message === 'string' ? message.trim() : ''
      setCenterAlert({ title: text || '提示', detail: text ? undefined : undefined })
      if (text && text.length > 0) {
        setCenterAlert({ title: '提示', detail: text })
      } else {
        setCenterAlert({ title: '提示' })
      }
    }
    return () => {
      window.alert = prevAlert
    }
  }, [])

  const current = route as string
  const pathOnly = current.split('?')[0]
  const plannerView = useMemo(() => {
    if (pathOnly !== '/planner') return 'day'
    const hash = location.hash || ''
    const idx = hash.indexOf('?')
    let v = ''
    if (idx >= 0) {
      const qs = hash.slice(idx + 1)
      const params = new URLSearchParams(qs)
      v = params.get('view') || ''
    }
    return v === 'day' || v === 'week' || v === 'month' || v === 'list' ? v : 'day'
  }, [pathOnly, route])

  useEffect(() => {
    try { localStorage.setItem('ui.sidebar.collapsed', sidebarCollapsed ? '1' : '0') } catch {}
  }, [sidebarCollapsed])

  useEffect(() => {
    if (!jwt) { setProfile(null); return }
    ;(async () => {
      try {
        const r = await fetch('/auth/me', { headers: headers() })
        if (r.ok) {
          const d = await r.json()
          setProfile(d)
        } else {
          setProfile(null)
        }
      } catch {
      }
    })()
  }, [jwt])

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
        fetch(`/tasks/daily?date=${date}&with=tags`, { headers: headers() }).then((r) => r.json()),
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
      const r = await fetch('/tasks?status=open&with=tags', { headers: headers() })
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
    if (pathOnly !== '/planner') return
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathOnly])

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
    if (pathOnly === '/planner' && plannerView === 'list') {
      setRangeReloadKey((k) => k + 1)
    }
  }

  // Load time blocks for list view date range without affecting day/week/month views
  useEffect(() => {
    if (!jwt) return
    if (pathOnly !== '/planner') return
    if (plannerView !== 'list') return
    if (!listRangeStart || !listRangeEnd) return
    if (listRangeStart > listRangeEnd) return
    if (listRangePickerOpen) return
    ;(async () => {
      try {
        setRangeBlocksLoading(true)
        setRangeBlocks(null)
        setRangeTasks(null)
        const r = await fetch(`/blocks/range?start=${listRangeStart}&end=${listRangeEnd}`, { headers: headers() })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) {
          console.error('Failed to load range blocks', j)
          return
        }
        const items = (j.items as Block[]) || []
        setRangeBlocks(items)
        const ids = Array.from(new Set(items.map(b => b.task_id).filter(Boolean))).map(String)
        if (ids.length > 0) {
          const tRes = await fetch(`/tasks/by-ids?ids=${encodeURIComponent(ids.join(','))}&with=tags`, { headers: headers() })
          const tJson = await tRes.json().catch(() => ({}))
          if (!tRes.ok) {
            console.error('Failed to load range tasks', tJson)
          } else {
            setRangeTasks((tJson.items || []) as Task[])
          }
        }
      } catch (e) {
        console.error('Failed to load range blocks', e)
      } finally {
        setRangeBlocksLoading(false)
      }
    })()
  }, [jwt, pathOnly, plannerView, listRangeStart, listRangeEnd, listRangePickerOpen, rangeReloadKey])

  async function updateTaskMeta(id: Task['id'], payload: { priority?: number | null; type?: string | null; color?: string | null; tags?: string[] }) {
    const body: any = {}
    if ('priority' in payload) body.priority = payload.priority
    if ('type' in payload) body.type = payload.type
    if ('color' in payload) body.color = payload.color
    if ('tags' in payload) body.tags = payload.tags
    const r = await fetch(`/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      alert('更新任务信息失败')
      return
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
  }

  async function createTaskAdvanced(payload: { title: string; type?: string; color?: string; type_id?: string; due_at?: string; estimate_min?: number; priority?: number; recurrence_rule?: string; tags?: string[] }): Promise<boolean> {
    const r = await fetch('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      if (r.status === 409) {
        setCenterAlert({ title: '时间冲突', detail: '该时间与其他任务重叠，请调整后再试。' })
      } else {
        alert('创建任务失败 ' + (j.error || r.status))
      }
      return false
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
    if (pathOnly === '/planner' && plannerView === 'list') {
      setRangeReloadKey((k) => k + 1)
    }
    return true
  }

  async function updateTaskAdvanced(id: Task['id'], payload: { title: string; type?: string; color?: string; type_id?: string; due_at?: string; estimate_min?: number; priority?: number; recurrence_rule?: string; tags?: string[] }): Promise<boolean> {
    const r = await fetch(`/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert('更新任务失败 ' + (j.error || r.status))
      return false
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
    if (pathOnly === '/planner' && plannerView === 'list') {
      setRangeReloadKey((k) => k + 1)
    }
    return true
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
    if (pathOnly === '/planner' && plannerView === 'list') {
      setRangeReloadKey((k) => k + 1)
    }
  }

  async function deleteTask(id: Task['id']) {
    const r = await fetch(`/tasks/${id}`, { method: 'DELETE', headers: headers() })
    if (!r.ok) {
      alert('删除任务失败')
      return
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
    if (pathOnly === '/planner' && plannerView === 'list') {
      setRangeReloadKey((k) => k + 1)
    }
  }

  async function addBlock(start: string, end: string, taskId?: string, dateOverride?: string): Promise<boolean> {
    const d = dateOverride || date
    const payload: any = { start_at: toIso(d, start), end_at: toIso(d, end) }
    if (taskId) payload.task_id = taskId
    const r = await fetch('/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      if (r.status === 409) {
        setCenterAlert({ title: '时间冲突', detail: '该时间与其他任务重叠，请调整后再试。' })
      } else {
        alert('创建时间块失败: ' + (j.error || r.status))
      }
      return false
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
    if (pathOnly === '/planner' && plannerView === 'list') {
      setRangeReloadKey((k) => k + 1)
    }
    return true
  }

  async function deleteBlock(id: Block['id']) {
    const r = await fetch(`/blocks/${id}`, { method: 'DELETE', headers: headers() })
    if (!r.ok) {
      alert('删除时间块失败')
      return
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
    if (pathOnly === '/planner' && plannerView === 'list') {
      setRangeReloadKey((k) => k + 1)
    }
  }

  async function scheduleTaskQuick(taskId: string | number) {
    const key = String(taskId)
    const t = schedTimes[key]
    const start = t?.start || ''
    const end = t?.end || ''
    if (!start || !end) { alert('请选择开始/结束时间'); return }
    const ok = await addBlock(start, end, String(taskId))
    if (!ok) return
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
    [ ...(tasks.today || []), ...(tasks.overdue || []), ...(rangeTasks || []) ]
  ), [tasks, rangeTasks])

  const taskTitleMap = useMemo(() => {
    const m: Record<string, string> = {}
    ;(tasks.today || []).forEach((t) => { m[String(t.id)] = t.title })
    ;(tasks.overdue || []).forEach((t) => { m[String(t.id)] = t.title })
    ;(unscheduled || []).forEach((t) => { m[String(t.id)] = t.title })
    ;(rangeTasks || []).forEach((t) => { m[String(t.id)] = t.title })
    return m
  }, [tasks, unscheduled, rangeTasks])

  const taskStatusMap = useMemo(() => {
    const m: Record<string, string> = {}
    ;(tasks.today || []).forEach((t) => { m[String(t.id)] = t.status })
    ;(tasks.overdue || []).forEach((t) => { m[String(t.id)] = t.status })
    ;(rangeTasks || []).forEach((t) => { m[String(t.id)] = t.status })
    return m
  }, [tasks, rangeTasks])

  const taskMetaMap = useMemo(() => {
    const m: Record<string, { priority?: number | null; type?: string | null; tags?: string[]; color?: string | null }> = {}
    ;(tasks.today || []).forEach((t) => {
      m[String(t.id)] = { priority: t.priority ?? null, type: t.type ?? null, tags: t.tags || [], color: t.color ?? null }
    })
    ;(tasks.overdue || []).forEach((t) => {
      m[String(t.id)] = { priority: t.priority ?? null, type: t.type ?? null, tags: t.tags || [], color: t.color ?? null }
    })
    ;(unscheduled || []).forEach((t) => {
      m[String(t.id)] = { priority: t.priority ?? null, type: t.type ?? null, tags: t.tags || [], color: t.color ?? null }
    })
    ;(rangeTasks || []).forEach((t) => {
      m[String(t.id)] = { priority: t.priority ?? null, type: t.type ?? null, tags: t.tags || [], color: t.color ?? null }
    })
    return m
  }, [tasks, unscheduled, rangeTasks])

  const listTypeOptions = useMemo(() => {
    const set = new Set<string>()
    ;(tasks.today || []).forEach((t) => { if (t.type) set.add(t.type) })
    ;(tasks.overdue || []).forEach((t) => { if (t.type) set.add(t.type) })
    ;(unscheduled || []).forEach((t) => { if (t.type) set.add(t.type) })
    return Array.from(set)
  }, [tasks, unscheduled])

  const listTagOptions = useMemo(() => {
    const set = new Set<string>()
    ;(tasks.today || []).forEach((t) => { (t.tags || []).forEach((g) => set.add(g)) })
    ;(tasks.overdue || []).forEach((t) => { (t.tags || []).forEach((g) => set.add(g)) })
    ;(unscheduled || []).forEach((t) => { (t.tags || []).forEach((g) => set.add(g)) })
    return Array.from(set)
  }, [tasks, unscheduled])

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
                  <h3 className="font-semibold mb-2">任务2</h3>
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
                      <div>{new Date(b.start_at).toLocaleTimeString()} — {new Date(b.end_at).toLocaleTimeString()} {(() => {
                        const map: Record<string, string> = {}
                        ;(shared.tasks || []).forEach((t) => { map[String(t.id)] = t.title })
                        const name = b.task_id ? map[String(b.task_id)] : undefined
                        return name ? <span className="ml-2 text-sm text-slate-300">· {name}</span> : null
                      })()}</div>
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

  if (pathOnly === '/signup') {
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

        <section>
          <SignupForm onLogin={doLogin} />
        </section>
      </div>
    )
  }

  if (pathOnly === '/forgot') {
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

        <section>
          <ForgotForm />
        </section>
      </div>
    )
  }

  if (pathOnly === '/shares') {
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

  if (pathOnly === '/settings') {
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
  const HOUR_PX = isSmall ? 48 : 56
  const pxPerMin = HOUR_PX / 60
  const filteredBlocks = isToday && showFutureOnly ? blocks.filter(b => new Date(b.end_at) >= now) : blocks

  // Reset hour collapsed state on date change
  useEffect(() => { setHourCollapsed({}) }, [date])

  // Initialize default collapsed state: hours without displayed blocks are collapsed
  useEffect(() => {
    const defaults: Record<number, boolean> = {}
    for (let h = 0; h < 24; h++) {
      const hourStart = h * 60
      const hourEnd = (h + 1) * 60
      const hasAny = filteredBlocks.some((b) => {
        const s = new Date(b.start_at)
        const e = new Date(b.end_at)
        const startMin = s.getHours() * 60 + s.getMinutes()
        const endMin = e.getHours() * 60 + e.getMinutes()
        return endMin > hourStart && startMin < hourEnd
      })
      defaults[h] = !hasAny
    }
    setHourCollapsed((prev) => {
      const next = { ...prev }
      let changed = false
      for (let h = 0; h < 24; h++) {
        if (!(h in next)) { next[h] = defaults[h]; changed = true }
      }
      return changed ? next : prev
    })
  }, [filteredBlocks])

  function expandAllHours() {
    const all: Record<number, boolean> = {}
    for (let h = 0; h < 24; h++) all[h] = false
    setHourCollapsed(all)
  }

  function collapseAllHours() {
    const all: Record<number, boolean> = {}
    for (let h = 0; h < 24; h++) all[h] = true
    setHourCollapsed(all)
  }

  useEffect(() => {
    if (!isToday) return
    const h = now.getHours()
    setHourCollapsed((s) => (s[h] === false ? s : { ...s, [h]: false }))
  }, [nowTick, isToday])

  return (
    <div
      className="min-h-screen"
      onClick={() => {
        if (listMenuOpenId !== null) setListMenuOpenId(null)
        if (unschedMenuOpenId !== null) setUnschedMenuOpenId(null)
      }}
    >
      {centerAlert && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-6 text-center shadow-2xl">
            <h3 className="text-lg font-semibold text-white">{centerAlert.title}</h3>
            {centerAlert.detail && <p className="mt-2 text-sm text-slate-300">{centerAlert.detail}</p>}
            <button
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#137fec] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f6cc8]"
              onClick={() => setCenterAlert(null)}
            >
              我知道了
            </button>
          </div>
        </div>
      )}
      {pathOnly === '/planner' && !isSmall && (
        <aside className={`fixed inset-y-0 left-0 ${sidebarCollapsed ? 'w-16' : 'w-64'} bg-[#1A2633] text-white border-r border-white/10 p-2 flex flex-col`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400">auto_stories</span>
              {!sidebarCollapsed && <span className="font-bold">Study Planner</span>}
            </div>
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10" onClick={() => setSidebarCollapsed(v => !v)}>
              <span className="material-symbols-outlined">menu_open</span>
            </button>
          </div>
          <div className="mb-2">
            {jwt && profile ? (
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-2 py-2'} rounded-lg hover:bg-white/10`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white font-semibold">
                  {(profile.nickname || profile.email || '?').slice(0, 1).toUpperCase()}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-medium">{profile.nickname || profile.email}</span>
                    <span className="text-xs text-white/60">{profile.email}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-2 py-2'} rounded-lg`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
                  <span className="material-symbols-outlined">person</span>
                </div>
                {!sidebarCollapsed && (
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-medium">未登录</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <nav className="flex-1 overflow-y-auto">
            <ul className="space-y-1">
              <li>
                <a href="#/planner" className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${pathOnly === '/planner' ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/10'}`}>
                  <span className="material-symbols-outlined">view_list</span>
                  {!sidebarCollapsed && <span className="font-medium">规划</span>}
                </a>
              </li>
              <li>
                <a href="#/shares" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10">
                  <span className="material-symbols-outlined">share</span>
                  {!sidebarCollapsed && <span className="font-medium">分享</span>}
                </a>
              </li>
              <li>
                <a href="#/settings" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10">
                  <span className="material-symbols-outlined">settings</span>
                  {!sidebarCollapsed && <span className="font-medium">设置</span>}
                </a>
              </li>
            </ul>
          </nav>
          <div className="pt-2 border-t border-white/10">
            {jwt ? (
              <button className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10" onClick={() => rememberJwt(null)}>
                <span className="material-symbols-outlined">logout</span>
                {!sidebarCollapsed && <span className="font-medium">退出登录</span>}
              </button>
            ) : (
              <div className="text-center text-xs text-white/60 py-2">未登录</div>
            )}
          </div>
        </aside>
      )}
      <div className={(pathOnly === '/planner' && !isSmall) ? (sidebarCollapsed ? 'pl-16' : 'pl-64') : ''}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {pathOnly !== '/planner' && (
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
        )}

      {!jwt ? <LoginForm onLogin={doLogin} msg={msg} /> : (
        <div>
          {pathOnly === '/planner' && (
            <header className="flex items-center justify-between whitespace-nowrap border-b border-white/10 bg-slate-900 px-6 py-3 mb-4 rounded-md">
              <div className="flex items-center gap-4 text-white">
                <span className="material-symbols-outlined text-[#137fec]">auto_stories</span>
                <h1 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">学习规划</h1>
              </div>
              <div className="flex-1 justify-end" />
            </header>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4 text-white">
              {plannerView !== 'list' && (
                <div className="flex items-center rounded-lg border border-white/10 overflow-hidden">
                  <button className="p-2 text-white/80 hover:bg-white/10" onClick={() => setDate(todayStr(new Date(new Date(date).getTime() - 86400000)))}><span className="material-symbols-outlined">chevron_left</span></button>
                  <button className="flex cursor-pointer items-center justify-center h-10 bg-black/20 text-white text-sm font-medium px-4 hover:bg-white/10 border-l border-r border-white/10" onClick={() => setDate(todayStr())}>今日</button>
                  <button className="p-2 text-white/80 hover:bg-white/10" onClick={() => setDate(todayStr(new Date(new Date(date).getTime() + 86400000)))}><span className="material-symbols-outlined">chevron_right</span></button>
                </div>
              )}
              <div className="relative flex items-center gap-2">
                <span className="material-symbols-outlined text-white/80">calendar_today</span>
                {plannerView === 'list' ? (
                  <button
                    type="button"
                    className="text-white tracking-light text-sm sm:text-base font-semibold px-2 py-1 rounded-md bg-black/20 hover:bg-white/10 border border-white/10"
                    onClick={() => setListRangePickerOpen((open) => !open)}
                  >
                    {listRangeStart} ~ {listRangeEnd}
                  </button>
                ) : (
                  <p className="text-white tracking-light text-xl font-bold">{date}</p>
                )}
                {plannerView === 'list' && listRangePickerOpen && (
                  <div className="absolute top-full left-6 mt-2 z-30 w-72 rounded-lg border border-white/10 bg-slate-900 shadow-xl p-3">
                    <div className="flex flex-col gap-2 text-xs text-slate-200">
                      <label className="flex items-center gap-2">
                        <span className="w-10 text-right">开始</span>
                        <input
                          type="date"
                          className="flex-1 h-8 rounded border border-slate-600 bg-slate-900/80 px-2 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                          value={listRangeStart}
                          onChange={(e) => setListRangeStart(e.target.value)}
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span className="w-10 text-right">结束</span>
                        <input
                          type="date"
                          className="flex-1 h-8 rounded border border-slate-600 bg-slate-900/80 px-2 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                          value={listRangeEnd}
                          onChange={(e) => setListRangeEnd(e.target.value)}
                        />
                      </label>
                      <div className="mt-1 flex justify-end gap-2">
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md text-[11px] text-slate-200 bg-slate-800 hover:bg-slate-700"
                          onClick={() => {
                            const start = todayStr()
                            const end = todayStr(new Date(Date.now() + 6 * 86400000))
                            setListRangeStart(start)
                            setListRangeEnd(end)
                          }}
                        >
                          重置为一周
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md text-[11px] text-white bg-[#137fec] hover:bg-[#0f6cc8]"
                          onClick={() => setListRangePickerOpen(false)}
                        >
                          完成
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex h-10 w-full max-w-sm items-center justify-center rounded-lg bg-black/20 p-1">
              {(['day','week','month','list'] as const).map((v) => (
                <button key={v} onClick={() => { location.hash = `#/planner?view=${v}` }} className={`flex-1 h-8 rounded-md text-sm ${plannerView === v ? 'bg-[#137fec] text-white shadow-sm' : 'text-gray-400 hover:bg-white/10'}`}>{v === 'day' ? '日视图' : v === 'week' ? '周视图' : v === 'month' ? '月视图' : '列表视图'}</button>
              ))}
            </div>
          </div>
          {plannerView === 'list' ? (
            <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-6 gap-4 lg:gap-6">
              <div className="md:col-span-3 lg:col-span-4">
                <div className="rounded-xl border border-white/10 bg-slate-800/50 overflow-hidden">
                  <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-sm p-3 border-b border-white/10">
                    <div className="flex flex-wrap gap-3 text-white/90 text-sm">
                      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                        <span className="text-xs text-white/70">类型</span>
                        <select
                          className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                          value={listFilterType}
                          onChange={(e) => setListFilterType(e.target.value)}
                        >
                          <option value="all" className="text-slate-900">所有</option>
                          {listTypeOptions.map((name) => (
                            <option key={name} value={name} className="text-slate-900">{name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                        <span className="text-xs text-white/70">优先</span>
                        <select
                          className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                          value={listFilterPriority}
                          onChange={(e) => setListFilterPriority(e.target.value as any)}
                        >
                          <option value="all" className="text-slate-900">所有</option>
                          <option value="2" className="text-slate-900">高</option>
                          <option value="1" className="text-slate-900">中</option>
                          <option value="0" className="text-slate-900">低</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                        <span className="text-xs text-white/70">标签</span>
                        <select
                          className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                          value={listFilterTag}
                          onChange={(e) => setListFilterTag(e.target.value)}
                        >
                          <option value="all" className="text-slate-900">所有</option>
                          {listTagOptions.map((name) => (
                            <option key={name} value={name} className="text-slate-900">{name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                        <span className="text-xs text-white/70">逾期</span>
                        <select
                          className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                          value={listFilterOverdue}
                          onChange={(e) => setListFilterOverdue(e.target.value as any)}
                        >
                          <option value="all" className="text-slate-900">所有</option>
                          <option value="yes" className="text-slate-900">是</option>
                          <option value="no" className="text-slate-900">否</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                        <span className="text-xs text-white/70">完成</span>
                        <select
                          className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                          value={listFilterDone}
                          onChange={(e) => setListFilterDone(e.target.value as any)}
                        >
                          <option value="all" className="text-slate-900">所有</option>
                          <option value="done" className="text-slate-900">已完成</option>
                          <option value="open" className="text-slate-900">未完成</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 p-3 text-white">
                    {(() => {
                      const baseBlocks = rangeBlocks !== null ? rangeBlocks : blocks
                      let arr = [...baseBlocks].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
                      if (listFilterOverdue !== 'all') {
                        arr = arr.filter((b) => (new Date(b.end_at).getTime() < now.getTime()) === (listFilterOverdue === 'yes'))
                      }
                      if (listFilterDone !== 'all') {
                        arr = arr.filter((b) => {
                          const st = b.task_id ? taskStatusMap[String(b.task_id)] : 'open'
                          return listFilterDone === 'done' ? st === 'done' : st !== 'done'
                        })
                      }
                      if (listFilterType !== 'all' || listFilterPriority !== 'all' || listFilterTag !== 'all') {
                        arr = arr.filter((b) => {
                          if (!b.task_id) return false
                          const taskIdStr = String(b.task_id)
                          const meta = taskMetaMap[taskIdStr]
                          if (!meta) return false
                          if (listFilterPriority !== 'all') {
                            const p = meta.priority ?? null
                            if (String(p ?? '') !== listFilterPriority) return false
                          }
                          if (listFilterType !== 'all') {
                            const t = meta.type || ''
                            if (t !== listFilterType) return false
                          }
                          if (listFilterTag !== 'all') {
                            const tags = meta.tags || []
                            if (!tags.includes(listFilterTag)) return false
                          }
                          return true
                        })
                      }
                      if (rangeBlocksLoading && rangeBlocks === null) return <div className="text-sm text-white/60">加载中...</div>
                      if (arr.length === 0) return <div className="text-sm text-white/60">该日期范围内暂无条目</div>

                      const sections: { key: string; date: Date; items: typeof arr }[] = []
                      for (const b of arr) {
                        const d = new Date(b.start_at)
                        const key = todayStr(d)
                        let sec = sections.find((s2) => s2.key === key)
                        if (!sec) {
                          sec = { key, date: d, items: [] as typeof arr }
                          sections.push(sec)
                        }
                        sec.items.push(b)
                      }

                      return sections.map((section) => (
                        <div key={section.key} className="space-y-2">
                          <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                            <span className="inline-flex h-5 w-1 rounded-full bg-slate-400" />
                            <span>{formatYmdWeek(section.date)}</span>
                          </div>
                          <div className="space-y-2">
                            {section.items.map((b) => {
                              const s = new Date(b.start_at)
                              const e = new Date(b.end_at)
                              const name = b.task_id ? taskTitleMap[String(b.task_id)] : undefined
                              const over = e.getTime() < now.getTime()
                              const status = b.task_id ? taskStatusMap[String(b.task_id)] : 'open'
                              const blockId = String(b.id)
                              const taskIdStr = b.task_id ? String(b.task_id) : null
                              const meta = taskIdStr ? taskMetaMap[taskIdStr] : undefined
                              const prio = meta?.priority ?? null
                              const prioLabel = prio === 2 ? '高' : prio === 1 ? '中' : prio === 0 ? '低' : null
                              const prioClass =
                                prio === 2
                                  ? 'bg-red-500/20 text-red-300'
                                  : prio === 1
                                  ? 'bg-yellow-500/20 text-yellow-300'
                                  : prio === 0
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-slate-500/20 text-slate-300'
                              const type = meta?.type || null
                              const tags = meta?.tags || []
                              const isMenuOpen = listMenuOpenId === blockId
                              const isEditing = !!(listEdit && taskIdStr && listEdit.taskId === taskIdStr)
                              const isCurrentNow = todayStr(s) === todayStr(now) && s <= now && now < e

                              return (
                                <div
                                  key={blockId}
                                  className={`relative flex flex-col gap-1 rounded-lg bg-white/5 p-2.5 border ${
                                    isCurrentNow ? 'border-amber-400 ring-2 ring-amber-400 bg-amber-500/10' : 'border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className="w-1.5 h-10 rounded-full"
                                      style={{ backgroundColor: (meta?.color || '#60A5FA') + 'CC' }}
                                    ></div>
                                    <div className="flex items-center justify-between w-full text-sm">
                                      <div className="flex flex-col flex-1">
                                        <div className="flex items-center gap-1">
                                          {status === 'done' && (
                                            <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[0.65rem] font-medium text-emerald-300">
                                              完成
                                            </span>
                                          )}
                                          <p className={`font-medium ${status === 'done' ? 'line-through opacity-60' : ''}`}>{name || '时间块'}</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-white/80">
                                          {type && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1">
                                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta?.color || '#9CA3AF' }}></span>
                                              <span>{type}</span>
                                            </span>
                                          )}
                                          {tags.map((g) => (
                                            <span key={g} className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300">#{g}</span>
                                          ))}
                                        </div>
                                      </div>
                                      <div className={`flex items-center text-white/80 gap-2 text-xs ${status === 'done' ? 'opacity-60' : ''}`}>
                                        {isCurrentNow && (
                                          <button
                                            className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-400"
                                            onClick={() => {
                                              const title = name || '当前时间段任务'
                                              setCenterAlert({ title: '专注模式', detail: `请专注完成：${title}` })
                                            }}
                                          >
                                            <span className="material-symbols-outlined text-sm">center_focus_strong</span>
                                            <span>专注</span>
                                          </button>
                                        )}
                                        {over && (
                                          <span className="inline-flex items-center gap-1 rounded-md bg-red-500/80 px-2 py-1 font-bold text-white text-xs">
                                            <span className="material-symbols-outlined text-sm">error</span>
                                            逾期
                                          </span>
                                        )}
                                        <p className="whitespace-nowrap">{fmtHHmm(s)} - {fmtHHmm(e)}</p>
                                        {prioLabel && (
                                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium ${prioClass}`}>
                                            <span>{prioLabel}</span>
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 pl-3">
                                        {taskIdStr && (
                                          <div className="relative">
                                            <button
                                              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setListMenuOpenId(isMenuOpen ? null : blockId)
                                              }}
                                            >
                                              <span className="material-symbols-outlined text-lg">more_vert</span>
                                            </button>
                                            {isMenuOpen && (
                                              <div className="absolute right-0 mt-1 w-28 rounded-md bg-slate-900 border border-slate-700 shadow-lg z-20">
                                                <button
                                                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                                                  onClick={() => {
                                                    if (!taskIdStr) return
                                                    const candidates: Task[] = []
                                                    ;(tasks.today || []).forEach((x) => candidates.push(x))
                                                    ;(tasks.overdue || []).forEach((x) => candidates.push(x))
                                                    ;(unscheduled || []).forEach((x) => candidates.push(x))
                                                    ;(rangeTasks || []).forEach((x) => candidates.push(x))
                                                    const t = candidates.find((x) => String(x.id) === taskIdStr)
                                                    if (t) {
                                                      setEditTask(t)
                                                    }
                                                    setListMenuOpenId(null)
                                                  }}
                                                >
                                                  修改
                                                </button>
                                                <button
                                                  className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                                                  onClick={async () => {
                                                    if (!taskIdStr) return
                                                    setListMenuOpenId(null)
                                                    await completeTask(taskIdStr)
                                                  }}
                                                >
                                                  完成
                                                </button>
                                                <button
                                                  className="block w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-slate-800"
                                                  onClick={async () => {
                                                    if (!taskIdStr) return
                                                    setListMenuOpenId(null)
                                                    await deleteTask(taskIdStr)
                                                  }}
                                                >
                                                  删除
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  {isEditing && taskIdStr && listEdit && (
                                    <div className="mt-1 ml-5 flex flex-wrap items-center gap-2 text-xs text-slate-200">
                                      <select
                                        className="px-2 py-1 rounded bg-slate-800 border border-slate-600"
                                        value={listEdit.priority == null ? '' : String(listEdit.priority)}
                                        onChange={(e) => {
                                          const v = e.target.value
                                          setListEdit((prev) =>
                                            prev && prev.taskId === taskIdStr ? { ...prev, priority: v === '' ? null : Number(v) } : prev
                                          )
                                        }}
                                      >
                                        <option value="">优先级(无)</option>
                                        <option value="2">高</option>
                                        <option value="1">中</option>
                                        <option value="0">低</option>
                                      </select>
                                      <input
                                        className="px-2 py-1 rounded bg-slate-800 border border-slate-600 flex-1 min-w-[6rem]"
                                        placeholder="任务类型"
                                        value={listEdit.type}
                                        onChange={(e) =>
                                          setListEdit((prev) =>
                                            prev && prev.taskId === taskIdStr ? { ...prev, type: e.target.value } : prev
                                          )
                                        }
                                      />
                                      <input
                                        className="px-2 py-1 rounded bg-slate-800 border border-slate-600 flex-1 min-w-[8rem]"
                                        placeholder="标签，用空格或逗号分隔"
                                        value={listEdit.tagsInput}
                                        onChange={(e) =>
                                          setListEdit((prev) =>
                                            prev && prev.taskId === taskIdStr
                                              ? { ...prev, tagsInput: e.target.value }
                                              : prev
                                          )
                                        }
                                      />
                                      <button
                                        className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                                        onClick={() => setListEdit(null)}
                                      >
                                        取消
                                      </button>
                                      <button
                                        className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500"
                                        onClick={async () => {
                                          if (!taskIdStr || !listEdit || listEdit.taskId !== taskIdStr) return
                                          const tags = listEdit.tagsInput
                                            .split(/[\s,]+/)
                                            .map((s2) => s2.trim().toLowerCase())
                                            .filter(Boolean)
                                          await updateTaskMeta(taskIdStr, {
                                            priority: listEdit.priority,
                                            type: listEdit.type.trim() ? listEdit.type.trim() : null,
                                            tags,
                                          })
                                          setListEdit(null)
                                        }}
                                      >
                                        保存
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 lg:col-span-2">
                <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h2 className="font-semibold mb-3">任务池</h2>
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm text-slate-300">未排程任务</h3>
                      <button className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={fetchUnscheduled}>刷新</button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {unscheduled.length === 0 && <div className="text-xs text-slate-400">暂无未排程任务</div>}
                      {unscheduled.map((t) => (
                        <div key={String(t.id)} className="bg-white/5 p-3 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: (t.color || '#4B5563') + '80' }}></div>
                            <div className="flex-1 space-y-1.5">
                              <p className="text-white text-sm font-medium leading-tight">{t.title}</p>
                              <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-white/80">
                                {t.type && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || '#9CA3AF' }}></span>
                                    <span>{t.type}</span>
                                  </span>
                                )}
                                {typeof t.priority === 'number' && (
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium ${
                                      t.priority === 2
                                        ? 'bg-red-500/20 text-red-300'
                                        : t.priority === 1
                                        ? 'bg-yellow-500/20 text-yellow-300'
                                        : 'bg-green-500/20 text-green-300'
                                    }`}
                                  >
                                    {t.priority === 2 ? '高' : t.priority === 1 ? '中' : '低'}
                                  </span>
                                )}
                                {(t.tags || []).map((g) => (
                                  <span key={g} className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300">#{g}</span>
                                ))}
                              </div>
                            </div>
                            <div className="relative">
                              <button
                                className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const idStr = String(t.id)
                                  setUnschedMenuOpenId(prev => prev === idStr ? null : idStr)
                                }}
                              >
                                <span className="material-symbols-outlined text-lg">more_vert</span>
                              </button>
                              {unschedMenuOpenId === String(t.id) && (
                                <div className="absolute right-0 mt-1 w-28 rounded-md bg-slate-900 border border-slate-700 shadow-lg z-20">
                                  <button
                                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                                    onClick={() => {
                                      setEditTask(t)
                                      setUnschedMenuOpenId(null)
                                    }}
                                  >
                                    修改
                                  </button>
                                  <button
                                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                                    onClick={() => {
                                      setUnschedMenuOpenId(null)
                                      setScheduleFor(t)
                                    }}
                                  >
                                    安排
                                  </button>
                                  <button
                                    className="block w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-slate-800"
                                    onClick={async () => {
                                      setUnschedMenuOpenId(null)
                                      await deleteTask(t.id)
                                    }}
                                  >
                                    删除
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {listEdit && listEdit.taskId === String(t.id) && (
                            <div className="mt-2 ml-5 flex flex-wrap items-center gap-2 text-xs text-slate-200">
                              <select
                                className="px-2 py-1 rounded bg-slate-800 border border-slate-600"
                                value={listEdit.priority == null ? '' : String(listEdit.priority)}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setListEdit((prev) => prev && prev.taskId === String(t.id) ? { ...prev, priority: v === '' ? null : Number(v) } : prev)
                                }}
                              >
                                <option value="">优先级(无)</option>
                                <option value="2">高</option>
                                <option value="1">中</option>
                                <option value="0">低</option>
                              </select>
                              <input
                                className="px-2 py-1 rounded bg-slate-800 border border-slate-600 flex-1 min-w-[6rem]"
                                placeholder="任务类型"
                                value={listEdit.type}
                                onChange={(e) => setListEdit((prev) => prev && prev.taskId === String(t.id) ? { ...prev, type: e.target.value } : prev)}
                              />
                              <input
                                className="px-2 py-1 rounded bg-slate-800 border border-slate-600 flex-1 min-w-[8rem]"
                                placeholder="标签，用空格或逗号分隔"
                                value={listEdit.tagsInput}
                                onChange={(e) => setListEdit((prev) => prev && prev.taskId === String(t.id) ? { ...prev, tagsInput: e.target.value } : prev)}
                              />
                              <button
                                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                                onClick={() => setListEdit(null)}
                              >
                                取消
                              </button>
                              <button
                                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500"
                                onClick={async () => {
                                  if (!listEdit || listEdit.taskId !== String(t.id)) return
                                  const tags = listEdit.tagsInput.split(/[\s,]+/).map(s2 => s2.trim().toLowerCase()).filter(Boolean)
                                  await updateTaskMeta(String(t.id), {
                                    priority: listEdit.priority,
                                    type: listEdit.type.trim() ? listEdit.type.trim() : null,
                                    tags,
                                  })
                                  setListEdit(null)
                                }}
                              >
                                保存
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#137fec] py-2.5 text-sm font-bold text-white hover:bg-[#0f6cc8]" onClick={() => setShowCreateTask(true)}>
                    <span className="material-symbols-outlined text-xl">add_circle</span>
                    添加新任务
                  </button>
                </section>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-6 gap-4 lg:gap-6">
              <div className="md:col-span-2 lg:col-span-2">
                <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h2 className="font-semibold mb-3">任务</h2>
                  <button className="mt-1 inline-flex items-center gap-2 rounded-lg bg-[#137fec] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f6cc8]" onClick={() => setShowCreateTask(true)}>
                    <span className="material-symbols-outlined text-base">add_circle</span>
                    添加新任务
                  </button>
                  <hr className="my-3 border-slate-700" />
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm text-slate-300">未排程任务池</h3>
                      <button className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={fetchUnscheduled}>刷新</button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {unscheduled.length === 0 && <div className="text-xs text-slate-400">暂无未排程任务</div>}
                      {unscheduled.map((t) => (
                        <div key={String(t.id)} className="bg-white/5 p-3 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: (t.color || '#4B5563') + '80' }}></div>
                            <div className="flex-1 space-y-1.5">
                              <p className="text-white text-sm font-medium leading-tight">{t.title}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {t.type && (
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: (t.color || '#888') + '33', color: t.color || '#888' }}>{t.type}</span>
                                )}
                                {typeof t.priority === 'number' && (
                                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${t.priority===2 ? 'text-red-400' : t.priority===1 ? 'text-yellow-400' : 'text-green-400'}`}>
                                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '\'FILL\' 1' }}>{t.priority===2 ? 'priority_high' : t.priority===1 ? 'drag_handle' : 'arrow_downward'}</span>
                                    {t.priority===2 ? '高' : t.priority===1 ? '中' : '低'}
                                  </span>
                                )}
                                {(t.tags || []).map((g) => (
                                  <span key={g} className="text-xs bg-gray-500/20 text-gray-300 px-2 py-0.5 rounded-full">{g}</span>
                                ))}
                              </div>
                            </div>
                            <div className="relative">
                              <button
                                className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const idStr = String(t.id)
                                  setUnschedMenuOpenId(prev => prev === idStr ? null : idStr)
                                }}
                              >
                                <span className="material-symbols-outlined text-lg">more_vert</span>
                              </button>
                              {unschedMenuOpenId === String(t.id) && (
                                <div className="absolute right-0 mt-1 w-28 rounded-md bg-slate-900 border border-slate-700 shadow-lg z-20">
                                  <button
                                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                                    onClick={() => {
                                      const taskIdStr = String(t.id)
                                      const current = taskMetaMap[taskIdStr] || {}
                                      setListEdit({
                                        taskId: taskIdStr,
                                        priority: current.priority ?? null,
                                        type: current.type || '',
                                        tagsInput: (current.tags || []).join(' '),
                                      })
                                      setUnschedMenuOpenId(null)
                                    }}
                                  >
                                    修改
                                  </button>
                                  <button
                                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                                    onClick={() => {
                                      setUnschedMenuOpenId(null)
                                      setScheduleFor(t)
                                    }}
                                  >
                                    安排
                                  </button>
                                  <button
                                    className="block w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-slate-800"
                                    onClick={async () => {
                                      setUnschedMenuOpenId(null)
                                      await deleteTask(t.id)
                                    }}
                                  >
                                    删除
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {listEdit && listEdit.taskId === String(t.id) && (
                            <div className="mt-2 ml-5 flex flex-wrap items-center gap-2 text-xs text-slate-200">
                              <select
                                className="px-2 py-1 rounded bg-slate-800 border border-slate-600"
                                value={listEdit.priority == null ? '' : String(listEdit.priority)}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setListEdit((prev) => prev && prev.taskId === String(t.id) ? { ...prev, priority: v === '' ? null : Number(v) } : prev)
                                }}
                              >
                                <option value="">优先级(无)</option>
                                <option value="2">高</option>
                                <option value="1">中</option>
                                <option value="0">低</option>
                              </select>
                              <input
                                className="px-2 py-1 rounded bg-slate-800 border border-slate-600 flex-1 min-w-[6rem]"
                                placeholder="任务类型"
                                value={listEdit.type}
                                onChange={(e) => setListEdit((prev) => prev && prev.taskId === String(t.id) ? { ...prev, type: e.target.value } : prev)}
                              />
                              <input
                                className="px-2 py-1 rounded bg-slate-800 border border-slate-600 flex-1 min-w-[8rem]"
                                placeholder="标签，用空格或逗号分隔"
                                value={listEdit.tagsInput}
                                onChange={(e) => setListEdit((prev) => prev && prev.taskId === String(t.id) ? { ...prev, tagsInput: e.target.value } : prev)}
                              />
                              <button
                                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                                onClick={() => setListEdit(null)}
                              >
                                取消
                              </button>
                              <button
                                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500"
                                onClick={async () => {
                                  if (!listEdit || listEdit.taskId !== String(t.id)) return
                                  const tags = listEdit.tagsInput.split(/[\s,]+/).map(s2 => s2.trim().toLowerCase()).filter(Boolean)
                                  await updateTaskMeta(String(t.id), {
                                    priority: listEdit.priority,
                                    type: listEdit.type.trim() ? listEdit.type.trim() : null,
                                    tags,
                                  })
                                  setListEdit(null)
                                }}
                              >
                                保存
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <h3 className="text-sm text-slate-300 mb-2">今天</h3>
                  <div className="flex flex-col gap-2">
                    {(tasks.today || []).map((t) => (
                      <TaskItem
                        key={String(t.id)}
                        t={t}
                        highlight={currentTaskId != null && String(t.id) === String(currentTaskId)}
                        onDone={() => completeTask(t.id)}
                        onDelete={() => deleteTask(t.id)}
                        onMetaChange={(p) => updateTaskMeta(t.id, p)}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-4 mb-2">
                    <h3 className="text-sm text-slate-300">逾期</h3>
                    <button className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={() => setOverdueCollapsed(v => !v)}>{overdueCollapsed ? '展开' : '收起'}</button>
                  </div>
                  {!overdueCollapsed && (
                    <div className="flex flex-col gap-2">
                      {(tasks.overdue || []).map((t) => (
                        <TaskItem
                          key={String(t.id)}
                          t={t}
                          overdue
                          onDone={() => completeTask(t.id)}
                          onDelete={() => deleteTask(t.id)}
                          onMetaChange={(p) => updateTaskMeta(t.id, p)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
              <div className="md:col-span-3 lg:col-span-4">
                <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h2 className="font-semibold mb-3">时间块（日视图）</h2>
                  
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={showFutureOnly} onChange={(e) => setShowFutureOnly(e.target.checked)} />
                      <span>仅显示未来时段</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={expandAllHours}>展开全部</button>
                      <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600" onClick={collapseAllHours}>折叠全部</button>
                    </div>
                  </div>
                  <AddBlock tasks={tasksFlat} onAdd={addBlock} />
                  <hr className="my-3 border-slate-700" />
                  {isToday && currentBlock && (
                    <div className="mb-3 p-3 rounded border border-amber-400 bg-amber-900/20 text-amber-200">
                      <div className="text-sm">当前时段</div>
                      <div className="text-base">
                        {fmtHHmm(new Date(currentBlock.start_at))} — {fmtHHmm(new Date(currentBlock.end_at))}
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
                  <div className="border border-slate-700 rounded-lg overflow-hidden mb-3">
                    {Array.from({ length: 24 }).map((_, h) => {
                      const hourStart = h * 60
                      const hourEnd = (h + 1) * 60
                      const blocksInHour = filteredBlocks.filter((b) => {
                        const s = new Date(b.start_at)
                        const e = new Date(b.end_at)
                        const startMin = s.getHours() * 60 + s.getMinutes()
                        const endMin = e.getHours() * 60 + e.getMinutes()
                        return endMin > hourStart && startMin < hourEnd
                      })
                      const isCurrentHour = isToday && h === now.getHours()
                      if (blocksInHour.length === 0 && !isCurrentHour) return null
                      let collapsed = (hourCollapsed as any)[h]
                      if (collapsed === undefined) collapsed = false
                      if (isCurrentHour) collapsed = false
                      return (
                        <div key={h} className="border-t border-slate-800">
                          <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-400 bg-slate-900">
                            <div>{String(h).padStart(2, '0')}:00</div>
                            <div className="text-slate-500">{blocksInHour.length > 0 ? `${blocksInHour.length} 段` : '空'}</div>
                          </div>
                          {!collapsed && (
                            <div className="relative bg-slate-900" style={{ height: `${HOUR_PX}px` }}>
                              {isCurrentHour && (
                                <div className="absolute left-0 right-0 border-t border-rose-500" style={{ top: `${now.getMinutes() * pxPerMin}px` }} />
                              )}
                              {blocksInHour.map((b) => {
                                const s = new Date(b.start_at)
                                const e = new Date(b.end_at)
                                const startMin = s.getHours() * 60 + s.getMinutes()
                                const endMin = e.getHours() * 60 + e.getMinutes()
                                const topMin = Math.max(hourStart, startMin) - hourStart
                                const bottomMin = Math.min(hourEnd, endMin) - hourStart
                                const top = topMin * pxPerMin
                                const height = Math.max(2, (bottomMin - topMin) * pxPerMin)
                                const isCur = currentBlock && String((currentBlock as any).id) === String(b.id)
                                return (
                                  <div key={String(b.id)} className={`absolute left-1 right-1 rounded border ${isCur ? 'border-amber-400 ring-2 ring-amber-400' : 'border-blue-500'} bg-blue-600/40`} style={{ top, height }}>
                                    <div className="px-2 py-1 text-xs">
                                      {fmtHHmm(s)} — {fmtHHmm(e)} {(() => { const name = b.task_id ? taskTitleMap[String(b.task_id)] : undefined; return name ? <span className="ml-2">· {name}</span> : null })()}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
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
                            {fmtHHmm(new Date(b.start_at))} — {fmtHHmm(new Date(b.end_at))}
                            {(() => { const name = b.task_id ? taskTitleMap[String(b.task_id)] : undefined; return name ? <span className="ml-2 text-sm text-slate-300">· {name}</span> : null })()}
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
          {showCreateTask && (
            <CreateTaskModal
              defaultDate={date}
              onClose={() => setShowCreateTask(false)}
              onSave={createTaskAdvanced}
              authHeaders={headers()}
              availableTags={listTagOptions}
            />
          )}
          {editTask && (
            <CreateTaskModal
              defaultDate={date}
              onClose={() => setEditTask(null)}
              onSave={(p) => updateTaskAdvanced(editTask.id, p)}
              authHeaders={headers()}
              availableTags={listTagOptions}
              initialTask={editTask}
            />
          )}
          {scheduleFor && (
            <ScheduleTaskModal
              task={scheduleFor}
              defaultDate={date}
              onClose={() => setScheduleFor(null)}
              onSave={async (dateStr, start, end) => {
                const ok = await addBlock(start, end, String(scheduleFor.id), dateStr)
                if (!ok) return false
                await Promise.all([fetchDaily(), fetchUnscheduled()])
                setScheduleFor(null)
                return true
              }}
            />
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  )
}

function LoginForm({ onLogin, msg }: { onLogin: (email: string, password: string) => void; msg: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [showPwd, setShowPwd] = useState(false)

  function submit() {
    if (!email.trim()) return alert('请输入邮箱')
    if (!password) return alert('请输入密码')
    onLogin(email, password)
  }

  return (
    <div className="relative flex w-full justify-center">
      <div className="flex w-full max-w-md flex-col items-center rounded-xl border border-slate-200/50 bg-white/50 p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900/50 md:p-10" style={{ fontFamily: 'Lexend, sans-serif' }}>
        <div className="flex items-center gap-2 pb-6">
          <span className="material-symbols-outlined text-4xl text-blue-400">auto_stories</span>
          <p className="text-3xl font-bold text-slate-800 dark:text-white">StudyFlow</p>
        </div>
        <div className="text-center">
          <h1 className="text-slate-800 dark:text-white text-[28px] md:text-[32px] font-bold tracking-tight">欢迎回来</h1>
          <p className="text-slate-600 dark:text-slate-400 text-base font-normal leading-normal pt-1 pb-6">专注学习，从这里开始</p>
        </div>
        <div className="flex w-full flex-col gap-4">
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="email">邮箱</label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">mail</span>
              <input id="email" type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base" />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="password">密码</label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">lock</span>
              <input id="password" type={showPwd ? 'text' : 'password'} placeholder="请输入密码" value={password}
                onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 pr-12 text-base" />
              <button aria-label="切换密码可见" type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-0 flex h-12 w-12 items-center justify-center text-slate-400 hover:text-slate-300 dark:text-slate-500">
                <span className="material-symbols-outlined">{showPwd ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          <div className="flex justify-between pt-1 text-sm">
            <a className="text-blue-400 hover:text-blue-300 font-medium underline" href="#/signup">注册</a>
            <a className="text-blue-400 hover:text-blue-300 font-medium underline" href="#/forgot">忘记密码？</a>
          </div>
          {msg && <div className="-mt-2 text-rose-300 text-sm">{msg}</div>}
          <button className="flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900" onClick={submit}>登录</button>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm font-normal pt-6">还没有账户？ <a className="font-medium text-blue-400 underline" href="#/signup">注册</a></p>
      </div>
    </div>
  )
}

function SignupForm({ onLogin }: { onLogin: (email: string, password: string) => void }) {
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  async function sendCode() {
    if (!email.trim()) return alert('请输入邮箱')
    if (!nickname.trim()) return alert('请输入昵称')
    if (!password) return alert('请输入密码')
    if (password !== confirm) return alert('两次输入的密码不一致')
    setMsg('')
    setLoading(true)
    try {
      const r = await fetch('/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, nickname }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(j.error || String(r.status)); return }
      setMsg('验证码已发送至邮箱，请查收')
    } finally {
      setLoading(false)
    }
  }

  async function submit() {
    if (!code.trim()) return alert('请输入邮箱验证码')
    setMsg('')
    setLoading(true)
    try {
      const vr = await fetch('/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: code }) })
      const vj = await vr.json().catch(() => ({}))
      if (!vr.ok) { setMsg(vj.error || String(vr.status)); return }
      await onLogin(email, password)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex w-full justify-center">
      <div className="flex w-full max-w-md flex-col items-center rounded-xl border border-slate-200/50 bg-white/50 p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900/50 md:p-10" style={{ fontFamily: 'Lexend, sans-serif' }}>
        <div className="flex items-center gap-2 pb-6">
          <span className="material-symbols-outlined text-4xl text-blue-400">auto_stories</span>
          <p className="text-3xl font-bold text-slate-800 dark:text-white">StudyFlow</p>
        </div>
        <div className="text-center">
          <h1 className="text-slate-800 dark:text-white text-[28px] md:text-[32px] font-bold tracking-tight">创建您的账户</h1>
          <p className="text-slate-600 dark:text-slate-400 text-base font-normal leading-normal pt-1 pb-6">开启您的学业成功之路</p>
        </div>
        <div className="flex w-full flex-col gap-4">
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="s-email">电子邮件地址</label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">mail</span>
              <input id="s-email" type="email" placeholder="输入您的电子邮件地址" value={email} onChange={(e) => setEmail(e.target.value)} className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base" />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="s-nickname">昵称</label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">badge</span>
              <input id="s-nickname" type="text" placeholder="输入您的昵称" value={nickname} onChange={(e) => setNickname(e.target.value)} className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base" />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="s-password">密码</label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">lock</span>
              <input id="s-password" type={showPwd ? 'text' : 'password'} placeholder="输入您的密码" value={password} onChange={(e) => setPassword(e.target.value)} className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 pr-12 text-base" />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-0 flex h-12 w-12 items-center justify-center text-slate-400 hover:text-slate-300 dark:text-slate-500"><span className="material-symbols-outlined">{showPwd ? 'visibility_off' : 'visibility'}</span></button>
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="s-confirm">确认密码</label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">lock</span>
              <input id="s-confirm" type={showPwd ? 'text' : 'password'} placeholder="再次输入您的密码" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 pr-12 text-base" />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="s-code">邮箱验证码</label>
            <div className="flex items-center gap-3">
              <div className="relative flex w-full flex-1 items-center">
                <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">mark_email_unread</span>
                <input id="s-code" type="text" placeholder="输入邮箱验证码" value={code} onChange={(e) => setCode(e.target.value)} className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base" />
              </div>
              <button className="flex h-12 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500 bg-blue-500/10 px-4 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20" onClick={sendCode} disabled={loading}>获取验证码</button>
            </div>
          </div>
          {msg && <div className="text-sm text-slate-300">{msg}</div>}
          <button className="mt-1 flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50" onClick={submit} disabled={loading}>注册</button>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm font-normal pt-6">已经有账户了？ <a className="font-medium text-blue-400 underline" href="#/planner">返回登录</a></p>
      </div>
    </div>
  )
}

function ForgotForm() {
  const [email, setEmail] = useState('')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaSvg, setCaptchaSvg] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [code, setCode] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadCaptcha() {
    const r = await fetch('/auth/captcha')
    const j = await r.json().catch(() => ({}))
    if (r.ok && j.id && j.svg) { setCaptchaId(j.id); setCaptchaSvg(j.svg) }
  }
  useEffect(() => { loadCaptcha() }, [])

  async function sendCode() {
    if (!email.trim()) return alert('请输入邮箱')
    if (!captchaId || !captchaAnswer.trim()) return alert('请输入图形验证码')
    setMsg('')
    setLoading(true)
    try {
      const r = await fetch('/auth/request-password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, captcha_id: captchaId, captcha_answer: captchaAnswer }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(j.error || String(r.status)); return }
      setMsg('邮件验证码已发送，请查收')
    } finally {
      setLoading(false)
    }
  }

  async function submit() {
    if (!code.trim()) return alert('请输入邮件验证码')
    if (!newPwd) return alert('请输入新密码')
    if (newPwd !== confirm) return alert('两次输入的密码不一致')
    setMsg('')
    setLoading(true)
    try {
      const r = await fetch('/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: code, new_password: newPwd }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(j.error || String(r.status)); return }
      setMsg('密码已重置，请返回登录')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex w-full justify-center">
      <div className="flex w-full max-w-md flex-col items-center rounded-xl border border-slate-200/50 bg-white/50 p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900/50 md:p-10" style={{ fontFamily: 'Lexend, sans-serif' }}>
        <div className="flex items-center gap-2 pb-6">
          <span className="material-symbols-outlined text-4xl text-blue-400">auto_stories</span>
          <p className="text-3xl font-bold text-slate-800 dark:text-white">StudyFlow</p>
        </div>
        <div className="text-center">
          <h1 className="text-slate-800 dark:text-white text-[28px] md:text-[32px] font-bold tracking-tight">忘记密码</h1>
          <p className="text-slate-600 dark:text-slate-400 text-base font-normal leading-normal pt-1 pb-6">输入您的帐户信息以重置密码</p>
        </div>
        <div className="flex w-full flex-col gap-4">
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="f-email">电子邮件地址</label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">mail</span>
              <input id="f-email" type="email" placeholder="输入您的电子邮件地址" value={email} onChange={(e) => setEmail(e.target.value)} className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base" />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="f-captcha">图形验证码</label>
            <div className="flex items-center gap-3">
              <div className="relative flex w-full flex-1 items-center">
                <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">barcode_scanner</span>
                <input id="f-captcha" type="text" placeholder="输入图形验证码" value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base" />
              </div>
              <button className="flex h-12 items-center justify-center rounded-lg border border-slate-500 bg-slate-800 px-3 text-sm" type="button" onClick={loadCaptcha}>刷新</button>
              <div className="flex h-12 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-2 dark:border-slate-700 dark:bg-slate-800" dangerouslySetInnerHTML={{ __html: captchaSvg }} />
            </div>
          </div>
          <button className="mt-0 flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50" onClick={sendCode} disabled={loading}>获取邮件验证码</button>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="f-code">邮件验证码</label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">mark_email_unread</span>
              <input id="f-code" type="text" placeholder="输入您的邮件验证码" value={code} onChange={(e) => setCode(e.target.value)} className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base" />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="f-np">新密码</label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">lock</span>
              <input id="f-np" type="password" placeholder="输入您的新密码" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base" />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="f-cp">确认新密码</label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">lock_reset</span>
              <input id="f-cp" type="password" placeholder="再次输入您的新密码" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base" />
            </div>
          </div>
          {msg && <div className="text-sm text-slate-300">{msg}</div>}
          <button className="mt-1 flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50" onClick={submit} disabled={loading}>重置密码</button>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm font-normal pt-6">记起密码了？ <a className="font-medium text-blue-400 underline" href="#/planner">返回登录</a></p>
      </div>
    </div>
  )
}

function TaskItem({ t, overdue, highlight, onDone, onDelete, onMetaChange }: { t: Task; overdue?: boolean; highlight?: boolean; onDone: () => void; onDelete: () => void; onMetaChange: (p: { priority?: number | null; type?: string | null; tags?: string[] }) => void }) {
  const [editing, setEditing] = useState(false)
  const [prio, setPrio] = useState<number | null>(t.priority ?? null)
  const [type, setType] = useState<string>(t.type || '')
  const [tagsInput, setTagsInput] = useState<string>((t.tags || []).join(' '))

  function saveMeta() {
    const tags = tagsInput.split(/[\s,]+/).map(s => s.trim().toLowerCase()).filter(Boolean)
    onMetaChange({
      priority: prio,
      type: type.trim() ? type.trim() : null,
      tags,
    })
    setEditing(false)
  }

  const prioLabel = prio === 2 ? '高' : prio === 1 ? '中' : prio === 0 ? '低' : null
  const prioClass =
    prio === 2
      ? 'bg-red-500/20 text-red-300'
      : prio === 1
      ? 'bg-yellow-500/20 text-yellow-300'
      : prio === 0
      ? 'bg-green-500/20 text-green-300'
      : 'bg-slate-500/20 text-slate-300'
  const isDone = t.status === 'done'

  return (
    <div className={`p-3 rounded border ${highlight ? 'border-amber-400 ring-2 ring-amber-400' : 'border-slate-700'} bg-slate-900 flex items-start justify-between gap-3 ${isDone ? 'opacity-60' : ''}`}>
      <div className="flex-1">
        <div className={`text-sm text-white font-medium ${isDone ? 'line-through' : ''}`}>{t.title}</div>
        <div className="text-xs text-slate-300 mt-1 flex flex-wrap gap-2 items-center">
          <span>状态: {t.status}</span>
          {t.due_at ? <span>截止: {new Date(t.due_at).toLocaleString()}</span> : null}
          {overdue ? <span className="text-rose-300">逾期</span> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-white/80">
          {t.type && (
            <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || '#9CA3AF' }}></span>
              <span>{t.type}</span>
            </span>
          )}
          {prioLabel && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium ${prioClass}`}>
              <span>优先级: {prioLabel}</span>
            </span>
          )}
          {(t.tags || []).map((g) => (
            <span key={g} className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300">#{g}</span>
          ))}
        </div>
        {editing && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-200">
            <select
              className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-xs"
              value={prio == null ? '' : String(prio)}
              onChange={(e) => {
                const v = e.target.value
                setPrio(v === '' ? null : Number(v))
              }}
            >
              <option value="">优先级(无)</option>
              <option value="2">高</option>
              <option value="1">中</option>
              <option value="0">低</option>
            </select>
            <input
              className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-xs flex-1 min-w-[6rem]"
              placeholder="任务类型"
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
            <input
              className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-xs flex-1 min-w-[8rem]"
              placeholder="标签，用空格或逗号分隔"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 items-end">
        {!editing ? (
          <>
            <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs" onClick={() => setEditing(true)}>编辑</button>
            <div className="flex gap-1 mt-1">
              <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs" onClick={onDone}>完成</button>
              <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs" onClick={onDelete}>删除</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-1 mt-1">
              <button className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs" onClick={() => setEditing(false)}>取消</button>
              <button className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs" onClick={saveMeta}>保存</button>
            </div>
          </>
        )}
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

function CreateTaskModal({ defaultDate, onClose, onSave, authHeaders, availableTags, initialTask }: { defaultDate: string; onClose: () => void; onSave: (p: { title: string; type?: string; color?: string; type_id?: string; due_at?: string; estimate_min?: number; priority?: number; recurrence_rule?: string; tags?: string[] }) => Promise<boolean>; authHeaders: Record<string, string>; availableTags: string[]; initialTask?: Task | null }) {
  const isEdit = !!initialTask

  function toInputLocal(d: Date): string {
    return `${todayStr(d)}T${fmtHHmm(d)}`
  }

  const [title, setTitle] = useState(initialTask ? initialTask.title : '')
  type TypeRow = { id: string; name: string; color: string }
  const [types, setTypes] = useState<TypeRow[]>([])
  const [typeIdx, setTypeIdx] = useState<number>(-1)
  const [timeMode, setTimeMode] = useState<'duration' | 'end' | 'undecided'>(() => {
    if (!initialTask) return 'duration'
    if (initialTask.due_at && typeof initialTask.estimate_min === 'number' && initialTask.estimate_min > 0) return 'duration'
    if (initialTask.due_at) return 'end'
    return 'undecided'
  })
  const [startAt, setStartAt] = useState<string>(() => {
    if (!initialTask || !initialTask.due_at) return `${defaultDate}T20:00`
    const end = new Date(initialTask.due_at)
    let start = end
    if (typeof initialTask.estimate_min === 'number' && initialTask.estimate_min > 0) {
      start = new Date(end.getTime() - initialTask.estimate_min * 60000)
    }
    return toInputLocal(start)
  })
  const [duration, setDuration] = useState<string>(() => {
    if (!initialTask || typeof initialTask.estimate_min !== 'number') return ''
    return String(initialTask.estimate_min)
  })
  const [endAt, setEndAt] = useState<string>(() => {
    if (!initialTask || !initialTask.due_at) return ''
    const end = new Date(initialTask.due_at)
    return toInputLocal(end)
  })
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(() => {
    if (!initialTask || initialTask.priority == null) return 'medium'
    return initialTask.priority === 2 ? 'high' : initialTask.priority === 1 ? 'medium' : 'low'
  })
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>(() => {
    if (!initialTask || !initialTask.recurrence_rule) return 'none'
    if (initialTask.recurrence_rule === 'DAILY') return 'daily'
    if (initialTask.recurrence_rule === 'WEEKLY') return 'weekly'
    if (initialTask.recurrence_rule === 'MONTHLY') return 'monthly'
    return 'none'
  })
  const [tags, setTags] = useState<string[]>(() => initialTask?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [typeModalOpen, setTypeModalOpen] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeColor, setNewTypeColor] = useState('#4FD1C5')
  const TYPE_COLOR_OPTIONS = ['#4FD1C5', '#A78BFA', '#68D391', '#F6AD55', '#E89EC1', '#50E3C2']

  async function loadTypes(selectId?: string) {
    try {
      const r = await fetch('/task-types', { headers: authHeaders })
      const j = await r.json().catch(() => ({}))
      if (r.ok && Array.isArray(j.items)) {
        const list = (j.items as any[]).map((x) => ({ id: String(x.id), name: String(x.name), color: String(x.color) })) as TypeRow[]
        setTypes(list)
        if (selectId) {
          const k = list.findIndex((t) => String(t.id) === String(selectId))
          setTypeIdx(k >= 0 ? k : (list.length > 0 ? 0 : -1))
        } else if (typeIdx === -1 && list.length > 0) {
          setTypeIdx(0)
        }
      }
    } catch {}
  }

  useEffect(() => { loadTypes() }, [])

  useEffect(() => {
    if (!initialTask) return
    if (typeIdx !== -1) return
    if (types.length === 0) return
    if (!initialTask.type) return
    const k = types.findIndex((t) => t.name === initialTask.type)
    if (k >= 0) setTypeIdx(k)
  }, [initialTask, types, typeIdx])

  // 当使用“开始 & 结束”模式时，如果尚未设置结束时间，则默认使用与开始时间相同的日期时间
  // 一旦用户手动设置了结束时间，后续修改开始时间将不会再自动修改结束时间
  useEffect(() => {
    if (timeMode !== 'end') return
    if (!startAt) return
    setEndAt((prev) => (prev ? prev : startAt))
  }, [timeMode, startAt])

  async function addType(name: string, color: string): Promise<boolean> {
    const trimmed = name.trim()
    if (!trimmed) { alert('请输入类型名称'); return false }
    try {
      const r = await fetch('/task-types', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ name: trimmed, color }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { alert('创建类型失败: ' + (j.error || r.status)); return false }
      await loadTypes(String(j.id))
      return true
    } catch {
      alert('创建类型失败')
      return false
    }
  }

  async function submitNewType() {
    const ok = await addType(newTypeName, newTypeColor)
    if (!ok) return
    setTypeModalOpen(false)
    setNewTypeName('')
  }

  function parseDurationMin(s: string): number | null {
    const str = s.trim()
    if (!str) return null
    const mm = str.match(/^([0-9]{1,2}):(\d{2})$/)
    if (mm) {
      const h = parseInt(mm[1])
      const m = parseInt(mm[2])
      return h * 60 + m
    }
    let total = 0
    const h = str.match(/(\d+)\s*h/) || str.match(/(\d+)小时/)
    if (h) total += parseInt(h[1]) * 60
    const m = str.match(/(\d+)\s*m/) || str.match(/(\d+)分/)
    if (m) total += parseInt(m[1])
    if (!h && !m) {
      const onlyMin = str.match(/^\d+$/)
      if (onlyMin) return parseInt(str)
      return null
    }
    return total
  }

  async function submit() {
    if (!title.trim()) { alert('请输入任务名称'); return }
    let dueISO: string | undefined
    let estimateMin: number | undefined
    if (timeMode === 'duration') {
      if (!startAt.trim()) { alert('请选择开始时间'); return }
      const est = parseDurationMin(duration || '')
      if (est == null || est <= 0) { alert('请填写正确的预计时长，如 1h 30m 或 90'); return }
      const start = new Date(startAt)
      const end = new Date(start.getTime() + est * 60000)
      dueISO = end.toISOString()
      estimateMin = est
    } else if (timeMode === 'end') {
      if (!startAt.trim() || !endAt.trim()) { alert('请选择开始与结束时间'); return }
      const s = new Date(startAt)
      const e = new Date(endAt)
      if (e <= s) { alert('结束时间必须晚于开始时间'); return }
      dueISO = e.toISOString()
      estimateMin = Math.round((e.getTime() - s.getTime()) / 60000)
    } else {
      // 未定：不设置 due_at / estimate_min，进入未排程任务池
      dueISO = undefined
      estimateMin = undefined
    }
    const prio = priority === 'high' ? 2 : priority === 'medium' ? 1 : 0
    const recur = recurrence === 'daily' ? 'DAILY' : recurrence === 'weekly' ? 'WEEKLY' : recurrence === 'monthly' ? 'MONTHLY' : undefined
    const finalTags = tagInput.trim() ? Array.from(new Set([...tags, tagInput.trim().toLowerCase()])) : tags
    const selectedType = typeIdx >= 0 ? types[typeIdx] : undefined
    const basePayload = {
      title: title.trim(),
      due_at: dueISO,
      estimate_min: estimateMin,
      priority: prio,
      recurrence_rule: recur,
      tags: finalTags,
    } as any

    const payload = isEdit
      ? {
          ...basePayload,
          type: selectedType ? selectedType.name : undefined,
          color: selectedType ? selectedType.color : undefined,
        }
      : {
          ...basePayload,
          type_id: selectedType ? selectedType.id : undefined,
        }

    const ok = await onSave(payload)
    if (!ok) return
    onClose()
  }

  function addTagFromInput() {
    const t = tagInput.trim()
    if (!t) return
    if (!tags.includes(t)) setTags((arr) => [...arr, t])
    setTagInput('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-white text-lg font-semibold">{isEdit ? '编辑任务' : '创建新任务'}</h2>
          <button className="text-white/60 hover:text-white" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
          <label className="flex flex-col">
            <p className="text-sm font-medium text-white pb-1.5">任务名称</p>
            <input className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white placeholder-slate-500 px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60" placeholder="例如，完成TOEFL阅读第一部分" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <div className="flex flex-col">
            <p className="text-sm font-medium text-white pb-1.5">任务类型</p>
            <div className="flex flex-wrap gap-3 items-center">
              {types.map((t, i) => (
                <label key={i} className="flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer border-white/10 bg-white/5 has-[:checked]:bg-[#137fec]/20 has-[:checked]:border-[#137fec]/50">
                  <input className="form-radio text-[#137fec] focus:ring-[#137fec]/50" name="task-type" type="radio" checked={typeIdx===i} onChange={() => setTypeIdx(i)} />
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }}></span>
                  <span className="text-sm font-medium text-slate-200">{t.name}</span>
                </label>
              ))}
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-dashed border-slate-500 hover:border-[#137fec] text-slate-300 hover:text-[#137fec]"
                type="button"
                onClick={() => {
                  setNewTypeName('')
                  setNewTypeColor(TYPE_COLOR_OPTIONS[0])
                  setTypeModalOpen(true)
                }}
              >
                <span className="material-symbols-outlined text-lg">add</span>
                <span className="text-sm font-medium">添加新类型</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">时间</p>
              <div className="flex w-fit rounded-lg border border-white/10 bg-white/5 p-1">
                <label>
                  <input className="sr-only peer" name="time-mode" type="radio" value="duration" checked={timeMode==='duration'} onChange={() => setTimeMode('duration')} />
                  <div className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 peer-checked:bg-[#137fec] peer-checked:text-white cursor-pointer">开始 & 时长</div>
                </label>
                <label>
                  <input className="sr-only peer" name="time-mode" type="radio" value="end-time" checked={timeMode==='end'} onChange={() => setTimeMode('end')} />
                  <div className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 peer-checked:bg-[#137fec] peer-checked:text-white cursor-pointer">开始 & 结束</div>
                </label>
                <label>
                  <input className="sr-only peer" name="time-mode" type="radio" value="undecided" checked={timeMode==='undecided'} onChange={() => setTimeMode('undecided')} />
                  <div className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 peer-checked:bg-[#137fec] peer-checked:text-white cursor-pointer">未定</div>
                </label>
              </div>
            </div>
            {timeMode !== 'undecided' ? (
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex flex-col min-w-40 flex-1">
                  <p className="text-xs text-slate-300 pb-1.5">开始时间</p>
                  <input className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
                </label>
                {timeMode === 'duration' ? (
                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-xs text-slate-300 pb-1.5">预计时长</p>
                    <input className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white placeholder-slate-500 px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60" placeholder="例如, 1h 30m 或 90" value={duration} onChange={(e) => setDuration(e.target.value)} />
                  </label>
                ) : (
                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-xs text-slate-300 pb-1.5">结束时间</p>
                    <input className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
                  </label>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400">时间未定：保存后会进入未排程任务池</div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col min-w-40 flex-1">
              <p className="text-sm font-medium text-white pb-1.5">优先级</p>
              <div className="flex w-full rounded-lg border border-white/10 p-1 bg-white/5">
                <label className="flex-1">
                  <input className="sr-only peer" name="priority" type="radio" value="high" checked={priority==='high'} onChange={() => setPriority('high')} />
                  <div className="w-full text-center px-4 py-2.5 rounded-md text-sm font-medium text-slate-300 peer-checked:bg-red-500/20 peer-checked:text-red-400 cursor-pointer">高</div>
                </label>
                <label className="flex-1">
                  <input className="sr-only peer" name="priority" type="radio" value="medium" checked={priority==='medium'} onChange={() => setPriority('medium')} />
                  <div className="w-full text-center px-4 py-2.5 rounded-md text-sm font-medium text-slate-300 peer-checked:bg-orange-500/20 peer-checked:text-orange-400 cursor-pointer">中</div>
                </label>
                <label className="flex-1">
                  <input className="sr-only peer" name="priority" type="radio" value="low" checked={priority==='low'} onChange={() => setPriority('low')} />
                  <div className="w-full text-center px-4 py-2.5 rounded-md text-sm font-medium text-slate-300 peer-checked:bg-[#137fec]/20 peer-checked:text-sky-400 cursor-pointer">低</div>
                </label>
              </div>
            </div>
            <div className="flex flex-col min-w-40 flex-1">
              <p className="text-sm font-medium text-white pb-1.5">重复</p>
              <select className="form-select h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60" value={recurrence} onChange={(e) => setRecurrence(e.target.value as any)}>
                <option value="none">不重复</option>
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-white">标签</p>
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableTags.map((name) => {
                  const active = tags.includes(name)
                  return (
                    <button
                      key={name}
                      type="button"
                      className={`px-2 py-1 rounded-full text-xs border ${
                        active
                          ? 'bg-[#137fec]/20 border-[#137fec] text-[#137fec]'
                          : 'border-slate-600 text-slate-300 hover:border-[#137fec] hover:text-[#137fec]'
                      }`}
                      onClick={() =>
                        setTags((prev) =>
                          prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
                        )
                      }
                    >
                      #{name}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex items-center flex-wrap gap-2 w-full min-h-14 rounded-lg border border-slate-700 bg-slate-900/70 p-2 focus-within:ring-2 focus-within:ring-[#137fec]/60 focus-within:border-[#137fec]">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1.5 bg-[#137fec]/20 text-[#137fec] text-sm font-medium px-2 py-1 rounded">
                  #{t}
                  <button className="text-[#137fec]/70 hover:text-[#137fec]" type="button" onClick={() => setTags((arr) => arr.filter((x) => x !== t))}>
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </span>
              ))}
              <input className="form-input flex-1 bg-transparent border-0 focus:ring-0 p-1.5 text-white placeholder:text-slate-500" placeholder="添加一个标签..." value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTagFromInput() } }} />
            </div>
          </label>
        </div>
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-white/10 bg-slate-900">
          <button className="px-4 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600" onClick={onClose}>取消</button>
          <button className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#137fec] hover:bg-[#0f6cc8]" onClick={submit}>保存任务</button>
        </div>
      </div>
      {typeModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-medium text-white">添加任务类型</h3>
              <button
                className="text-white/60 hover:text-white"
                type="button"
                onClick={() => setTypeModalOpen(false)}
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="px-4 py-4 space-y-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-slate-300">类型名称</span>
                <input
                  className="h-9 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                  placeholder="例如：阅读、练习、复习..."
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                />
              </label>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-slate-300">颜色</span>
                <div className="flex flex-wrap gap-2">
                  {TYPE_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`w-7 h-7 rounded-full border-2 ${
                        newTypeColor === c ? 'border-white ring-2 ring-[#137fec]' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewTypeColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/10 bg-slate-900">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600"
                onClick={() => setTypeModalOpen(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#137fec] hover:bg-[#0f6cc8]"
                onClick={submitNewType}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
