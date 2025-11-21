import { useEffect, useMemo, useState } from 'react'

import { LoginForm } from './components/auth/LoginForm'
import { SignupForm } from './components/auth/SignupForm'
import { ForgotForm } from './components/auth/ForgotForm'
import { PlannerScreen } from './components/planner/PlannerScreen'
import { AppHeader } from './components/layout/AppHeader'
import { SettingsPage } from './components/settings/SettingsPage'
import { SharesPage } from './components/shares/SharesPage'
import { SharedPage } from './components/shares/SharedPage'
import { RoleManagementPage } from './components/admin/RoleManagementPage'
import { PlanLibraryPage } from './components/plans/PlanLibraryPage'
import type { Task, Block, DailyTasks, FetchState } from './types'
import { todayStr, fmtHHmm, defaultTimeZone, formatYmdWeek } from './utils/datetime'
import { usePlanner } from './hooks/usePlanner'
import { useShares } from './hooks/useShares'
import { useSharedView } from './hooks/useSharedView'
import { useSettings } from './hooks/useSettings'
import { usePushNotifications } from './hooks/usePushNotifications'
import { useAuth } from './hooks/useAuth'

export default function App() {
  const { jwt, profile, loginMsg, rememberJwt, doLogin, headers } = useAuth()
  const [date, setDate] = useState<string>(() => todayStr())
  const [tasks, setTasks] = useState<DailyTasks>({})
  const [blocks, setBlocks] = useState<Block[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('idle')

  // Shares
  const {
    shareScope,
    setShareScope,
    shareDays,
    setShareDays,
    shareMsg,
    shares,
    createShare,
    deleteShare,
  } = useShares({ jwt, headers })

  // Push
  const { pushMsg, swReady, ensureSW, subscribePush, testPush } = usePushNotifications({ headers })

  // Unscheduled pool
  const [unscheduled, setUnscheduled] = useState<Task[]>([])
  const [scheduleFor, setScheduleFor] = useState<Task | null>(null)

  // User settings
  const {
    settings,
    setSettings,
    settingsMsg,
    dailyEnabled,
    setDailyEnabled,
    tzOptions,
    loadSettings,
    saveSettings,
  } = useSettings({ jwt, headers })

  // Planner UI enhancements
  const [showFutureOnly, setShowFutureOnly] = useState<boolean>(false)
  const [overdueCollapsed, setOverdueCollapsed] = useState<boolean>(true)
  const [nowTick, setNowTick] = useState<number>(Date.now())
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
  const [rangeReloadKey, setRangeReloadKey] = useState<number>(0)
  const [centerAlert, setCenterAlert] = useState<{ title: string; detail?: string } | null>(null)
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

  const {
    shareToken,
    shareDate,
    setShareDate,
    shareLoading,
    shareError,
    sharedData,
    copyShared,
  } = useSharedView({ headers })

  const {
    isToday,
    now,
    currentBlock,
    currentTaskId,
    HOUR_PX,
    pxPerMin,
    filteredBlocks,
    hourCollapsed,
    expandAllHours,
    collapseAllHours,
    toggleHourCollapsed,
    tasksFlat,
    taskTitleMap,
    taskStatusMap,
    taskMetaMap,
    listTypeOptions,
    listTagOptions,
    fetchDaily,
    fetchUnscheduled,
    rangeBlocks,
    rangeBlocksLoading,
    rangeTasks,
    updateTaskMeta,
    createTaskAdvanced,
    updateTaskAdvanced,
    completeTask,
    deleteTask,
    addBlock,
    deleteBlock,
  } = usePlanner({
    date,
    tasks,
    blocks,
    unscheduled,
    nowTick,
    showFutureOnly,
    isSmall,
    jwt,
    pathOnly,
    plannerView,
    headers,
    listRangeStart,
    listRangeEnd,
    listRangePickerOpen,
    rangeReloadKey,
    setTasks,
    setBlocks,
    setFetchState,
    setUnscheduled,
    setRangeReloadKey,
    setCenterAlert,
  })

  useEffect(() => {
    try { localStorage.setItem('ui.sidebar.collapsed', sidebarCollapsed ? '1' : '0') } catch { }
  }, [sidebarCollapsed])

  useEffect(() => {
    fetchDaily()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt, date])

  useEffect(() => {
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

  if (shareToken) {
    return (
      <SharedPage
        shareDate={shareDate}
        setShareDate={setShareDate}
        shareLoading={shareLoading}
        shareError={shareError}
        shared={sharedData}
        copyShared={() => copyShared(jwt)}
        jwt={jwt}
      />
    )
  }

  if (pathOnly === '/signup') {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <AppHeader current={current} jwt={jwt} onLogout={() => rememberJwt(null)} />

        <section>
          <SignupForm onLogin={doLogin} />
        </section>
      </div>
    )
  }

  if (pathOnly === '/forgot') {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <AppHeader current={current} jwt={jwt} onLogout={() => rememberJwt(null)} />

        <section>
          <ForgotForm />
        </section>
      </div>
    )
  }

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
            <h3 className="text-lg font-semibold text-white">
              {centerAlert.title}
            </h3>
            {centerAlert.detail && (
              <p className="mt-2 text-sm text-slate-300">
                {centerAlert.detail}
              </p>
            )}
            <button
              className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#137fec] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f6cc8]"
              onClick={() => setCenterAlert(null)}
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {(pathOnly === '/planner' || pathOnly === '/plans' || pathOnly === '/admin/roles' || pathOnly === '/settings' || pathOnly === '/shares') && !isSmall && (
        <aside
          className={`fixed inset-y-0 left-0 ${sidebarCollapsed ? 'w-16' : 'w-64'
            } bg-[#1A2633] text-white border-r border-white/10 p-2 flex flex-col`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-400">
                auto_stories
              </span>
              {!sidebarCollapsed && <span className="font-bold">Study Planner</span>}
            </div>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
              onClick={() => setSidebarCollapsed((v) => !v)}
            >
              <span className="material-symbols-outlined">menu_open</span>
            </button>
          </div>
          <div className="mb-2">
            {jwt && profile ? (
              <div
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-2 py-2'
                  } rounded-lg hover:bg-white/10`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white font-semibold">
                  {(profile.nickname || profile.email || '?')
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-medium">
                      {profile.nickname || profile.email}
                    </span>
                    <span className="text-xs text-white/60">
                      {profile.email}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div
                className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3 px-2 py-2'
                  } rounded-lg`}
              >
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
                <a
                  href="#/planner"
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${pathOnly === '/planner'
                    ? 'bg-white/10 text-white'
                    : 'text-white/80 hover:bg-white/10'
                    }`}
                >
                  <span className="material-symbols-outlined">view_list</span>
                  {!sidebarCollapsed && <span className="font-medium">规划</span>}
                </a>
              </li>
              <li>
                <a
                  href="#/plans"
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${pathOnly === '/plans'
                    ? 'bg-white/10 text-white'
                    : 'text-white/80 hover:bg-white/10'
                    }`}
                >
                  <span className="material-symbols-outlined">library_books</span>
                  {!sidebarCollapsed && <span className="font-medium">计划库</span>}
                </a>
              </li>
              <li>
                <a
                  href="#/shares"
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${pathOnly === '/shares'
                    ? 'bg-white/10 text-white'
                    : 'text-white/80 hover:bg-white/10'
                    }`}
                >
                  <span className="material-symbols-outlined">share</span>
                  {!sidebarCollapsed && <span className="font-medium">分享</span>}
                </a>
              </li>
              <li>
                <a
                  href="#/settings"
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${pathOnly === '/settings'
                    ? 'bg-white/10 text-white'
                    : 'text-white/80 hover:bg-white/10'
                    }`}
                >
                  <span className="material-symbols-outlined">settings</span>
                  {!sidebarCollapsed && <span className="font-medium">设置</span>}
                </a>
              </li>
              {profile?.role === 'system_admin' && (
                <li>
                  <a
                    href="#/admin/roles"
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${pathOnly === '/admin/roles'
                      ? 'bg-white/10 text-white'
                      : 'text-white/80 hover:bg-white/10'
                      }`}
                  >
                    <span className="material-symbols-outlined">admin_panel_settings</span>
                    {!sidebarCollapsed && <span className="font-medium">角色管理</span>}
                  </a>
                </li>
              )}
            </ul>
          </nav>
          <div className="pt-2 border-t border-white/10">
            {jwt ? (
              <button
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                onClick={() => rememberJwt(null)}
              >
                <span className="material-symbols-outlined">logout</span>
                {!sidebarCollapsed && (
                  <span className="font-medium">退出登录</span>
                )}
              </button>
            ) : (
              <div className="text-center text-xs text-white/60 py-2">
                未登录
              </div>
            )}
          </div>
        </aside>
      )}

      <div
        className={
          (pathOnly === '/planner' || pathOnly === '/plans' || pathOnly === '/admin/roles' || pathOnly === '/settings' || pathOnly === '/shares') && !isSmall
            ? sidebarCollapsed
              ? 'pl-16'
              : 'pl-64'
            : ''
        }
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          {pathOnly !== '/planner' && pathOnly !== '/plans' && pathOnly !== '/admin/roles' && pathOnly !== '/settings' && pathOnly !== '/shares' && (
            <header className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-6">
                <h1 className="text-xl font-semibold">Study Planner</h1>
                <nav className="flex items-center gap-3 text-sm">
                  <a
                    href="#/planner"
                    className={
                      current === '/planner' ? 'text-blue-300' : 'text-slate-300'
                    }
                  >
                    Planner
                  </a>
                  <a
                    href="#/shares"
                    className={
                      current === '/shares' ? 'text-blue-300' : 'text-slate-300'
                    }
                  >
                    分享
                  </a>
                  <a
                    href="#/settings"
                    className={
                      current === '/settings' ? 'text-blue-300' : 'text-slate-300'
                    }
                  >
                    设置
                  </a>
                </nav>
              </div>
              <div className="text-sm">
                {jwt ? (
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-emerald-900/60 px-2 py-1">
                      已登录
                    </span>
                    <button
                      className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                      onClick={() => rememberJwt(null)}
                    >
                      退出
                    </button>
                  </div>
                ) : (
                  <span className="rounded-full bg-rose-900/60 px-2 py-1">
                    未登录
                  </span>
                )}
              </div>
            </header>
          )}

          {!jwt ? (
            <LoginForm onLogin={doLogin} msg={loginMsg} />
          ) : pathOnly === '/plans' ? (
            <PlanLibraryPage />
          ) : pathOnly === '/admin/roles' ? (
            <RoleManagementPage
              jwt={jwt}
              headers={headers}
              currentUserRole={profile?.role}
            />
          ) : pathOnly === '/settings' ? (
            <SettingsPage
              swReady={swReady}
              pushMsg={pushMsg}
              dailyEnabled={dailyEnabled}
              settings={settings}
              settingsMsg={settingsMsg}
              tzOptions={tzOptions}
              tzPlaceholder={defaultTimeZone()}
              ensureSW={ensureSW}
              subscribePush={subscribePush}
              testPush={testPush}
              saveSettings={saveSettings}
              setDailyEnabled={setDailyEnabled}
              setSettings={setSettings}
            />
          ) : pathOnly === '/shares' ? (
            <SharesPage
              jwt={jwt}
              shareScope={shareScope}
              shareDays={shareDays}
              shareMsg={shareMsg}
              shares={shares}
              setShareScope={setShareScope as any}
              setShareDays={setShareDays}
              createShare={createShare}
              deleteShare={deleteShare}
            />
          ) : (
            <PlannerScreen
              plannerView={plannerView}
              date={date}
              listRangeStart={listRangeStart}
              listRangeEnd={listRangeEnd}
              listRangePickerOpen={listRangePickerOpen}
              state={{
                listFilterType,
                listFilterPriority,
                listFilterTag,
                listFilterOverdue,
                listFilterDone,
                listTypeOptions,
                listTagOptions,
                rangeBlocks,
                blocks,
                now,
                rangeBlocksLoading,
                taskStatusMap,
                taskTitleMap,
                taskMetaMap,
                listMenuOpenId,
                listEdit,
                tasks,
                unscheduled,
                rangeTasks,
                unschedMenuOpenId,
                currentTaskId,
                overdueCollapsed,
                showFutureOnly,
                tasksFlat,
                isToday,
                currentBlock,
                filteredBlocks,
                hourCollapsed,
                HOUR_PX,
                pxPerMin,
                fetchState,
                showCreateTask,
                editTask,
                scheduleFor,
              }}
              actions={{
                setDate,
                setListRangeStart,
                setListRangeEnd,
                setListRangePickerOpen,
                todayStr,
                setListFilterType,
                setListFilterPriority,
                setListFilterTag,
                setListFilterOverdue,
                setListFilterDone,
                setListMenuOpenId,
                setListEdit,
                setCenterAlert,
                updateTaskMeta,
                completeTask,
                deleteTask,
                fmtHHmm,
                formatYmdWeek,
                fetchUnscheduled,
                setUnschedMenuOpenId,
                setEditTask,
                setScheduleFor,
                setShowCreateTask,
                addBlock,
                deleteBlock,
                expandAllHours,
                collapseAllHours,
                setOverdueCollapsed,
                setShowFutureOnly,
                fetchDaily,
                createTaskAdvanced,
                updateTaskAdvanced,
                headers,
                toggleHourCollapsed,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}