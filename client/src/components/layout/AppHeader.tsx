export interface AppHeaderProps {
  current: string
  jwt: string | null
  onLogout: () => void
}

export function AppHeader({ current, jwt, onLogout }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-semibold">Study Planner</h1>
        <nav className="flex items-center gap-3 text-sm">
          <a href="#/planner" className={current === '/planner' ? 'text-blue-300' : 'text-slate-300'}>
            Planner
          </a>
          <a href="#/shares" className={current === '/shares' ? 'text-blue-300' : 'text-slate-300'}>
            分享
          </a>
          <a href="#/settings" className={current === '/settings' ? 'text-blue-300' : 'text-slate-300'}>
            设置
          </a>
        </nav>
      </div>
      <div className="text-sm">
        {jwt ? (
          <div className="inline-flex items-center gap-2">
            <span className="rounded-full bg-emerald-900/60 px-2 py-1">已登录</span>
            <button
              className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
              onClick={onLogout}
            >
              退出
            </button>
          </div>
        ) : (
          <span className="rounded-full bg-rose-900/60 px-2 py-1">未登录</span>
        )}
      </div>
    </header>
  )
}
