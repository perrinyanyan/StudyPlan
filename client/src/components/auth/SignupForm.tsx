import { useState } from 'react'
import { getApiUrl } from '../../config'

export function SignupForm({ onLogin }: { onLogin: (email: string, password: string) => void }) {
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  async function sendCode() {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email.trim() || !emailPattern.test(email)) return alert('请输入有效的邮箱地址')
    setMsg('')
    setLoading(true)
    try {
      const r = await fetch(getApiUrl('/auth/send-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setMsg(j.error || String(r.status))
        return
      }
      setMsg('验证码已发送至邮箱，请查收')
    } finally {
      setLoading(false)
    }
  }

  async function submit() {
    if (!email.trim()) return alert('请输入邮箱')
    if (!nickname.trim()) return alert('请输入昵称')
    if (!password) return alert('请输入密码')
    if (password !== confirm) return alert('两次输入的密码不一致')
    if (!code.trim()) return alert('请输入邮箱验证码')

    setMsg('')
    setLoading(true)
    try {
      const r = await fetch(getApiUrl('/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname, code }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setMsg(j.error || String(r.status))
        return
      }
      // Signup successful (user created and verified), now auto login
      await onLogin(email, password)
      // Redirect to planner/home explicitly
      window.location.hash = '#/planner'  // Using hash as seen in the 'Back to login' link
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-slate-800 dark:text-white text-[28px] md:text-[32px] font-bold tracking-tight">创建您的账户</h1>
          <p className="text-slate-600 dark:text-slate-400 text-base font-normal leading-normal pt-1 pb-6">开启您的学业成功之路</p>
        </div>
        <div className="flex w-full flex-col gap-4">
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="s-email">
              电子邮件地址
            </label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">mail</span>
              <input
                id="s-email"
                type="email"
                placeholder="输入您的电子邮件地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base"
              />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="s-nickname">
              昵称
            </label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">badge</span>
              <input
                id="s-nickname"
                type="text"
                placeholder="输入您的昵称"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base"
              />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="s-password">
              密码
            </label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">lock</span>
              <input
                id="s-password"
                type={showPwd ? 'text' : 'password'}
                placeholder="输入您的密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 pr-12 text-base"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-0 flex h-12 w-12 items-center justify-center text-slate-400 hover:text-slate-300 dark:text-slate-500"
              >
                <span className="material-symbols-outlined">{showPwd ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="s-confirm">
              确认密码
            </label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">lock</span>
              <input
                id="s-confirm"
                type={showPwd ? 'text' : 'password'}
                placeholder="再次输入您的密码"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 pr-12 text-base"
              />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="s-code">
              邮箱验证码
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex w-full flex-1 items-center">
                <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">mark_email_unread</span>
                <input
                  id="s-code"
                  type="text"
                  placeholder="输入邮箱验证码"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base"
                />
              </div>
              <button
                className="flex h-12 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500 bg-blue-500/10 px-4 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20"
                onClick={sendCode}
                disabled={loading}
              >
                获取验证码
              </button>
            </div>
          </div>
          {msg && <div className="text-sm text-slate-300">{msg}</div>}
          <button
            className="mt-1 flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            onClick={submit}
            disabled={loading}
          >
            注册
          </button>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm font-normal pt-6">
          已经有账户了？{' '}
          <a className="font-medium text-blue-400 underline" href="#/planner">
            返回登录
          </a>
        </p>
      </div>
    </div>
  )
}
