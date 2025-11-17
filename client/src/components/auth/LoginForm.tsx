import { useState } from 'react'

export function LoginForm({ onLogin, msg }: { onLogin: (email: string, password: string) => void; msg: string }) {
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
      <div
        className="flex w-full max-w-md flex-col items-center rounded-xl border border-slate-200/50 bg-white/50 p-6 shadow-sm dark:border-slate-800/50 dark:bg-slate-900/50 md:p-10"
        style={{ fontFamily: 'Lexend, sans-serif' }}
      >
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
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="email">
              邮箱
            </label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">mail</span>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit()
                }}
                className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base"
              />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="password">
              密码
            </label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">lock</span>
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit()
                }}
                className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 pr-12 text-base"
              />
              <button
                aria-label="切换密码可见"
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-0 flex h-12 w-12 items-center justify-center text-slate-400 hover:text-slate-300 dark:text-slate-500"
              >
                <span className="material-symbols-outlined">{showPwd ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          <div className="flex justify-between pt-1 text-sm">
            <a className="text-blue-400 hover:text-blue-300 font-medium underline" href="#/signup">
              注册
            </a>
            <a className="text-blue-400 hover:text-blue-300 font-medium underline" href="#/forgot">
              忘记密码？
            </a>
          </div>
          {msg && <div className="-mt-2 text-rose-300 text-sm">{msg}</div>}
          <button
            className="flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            onClick={submit}
          >
            登录
          </button>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm font-normal pt-6">
          还没有账户？{' '}
          <a className="font-medium text-blue-400 underline" href="#/signup">
            注册
          </a>
        </p>
      </div>
    </div>
  )
}
