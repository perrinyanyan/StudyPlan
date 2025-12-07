import { useEffect, useState } from 'react'
import { getApiUrl } from '../../config'

export function ForgotForm() {
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
    const r = await fetch(getApiUrl('/auth/captcha'))
    const j = await r.json().catch(() => ({}))
    if (r.ok && j.id && j.svg) {
      setCaptchaId(j.id)
      setCaptchaSvg(j.svg)
    }
  }

  useEffect(() => {
    loadCaptcha()
  }, [])

  async function sendCode() {
    if (!email.trim()) return alert('请输入邮箱')
    if (!captchaId || !captchaAnswer.trim()) return alert('请输入图形验证码')
    setMsg('')
    setLoading(true)
    try {
      const r = await fetch(getApiUrl('/auth/request-password-reset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, captcha_id: captchaId, captcha_answer: captchaAnswer }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setMsg(j.error || String(r.status))
        return
      }
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
      const r = await fetch(getApiUrl('/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token: code, new_password: newPwd }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setMsg(j.error || String(r.status))
        return
      }
      setMsg('密码已重置，请返回登录，2秒后自动跳转...')
      setTimeout(() => {
        window.location.hash = '#/planner'
      }, 2000)
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
          <h1 className="text-slate-800 dark:text-white text-[28px] md:text-[32px] font-bold tracking-tight">忘记密码</h1>
          <p className="text-slate-600 dark:text-slate-400 text-base font-normal leading-normal pt-1 pb-6">输入您的帐户信息以重置密码</p>
        </div>
        <div className="flex w-full flex-col gap-4">
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="f-email">
              电子邮件地址
            </label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">mail</span>
              <input
                id="f-email"
                type="email"
                placeholder="输入您的电子邮件地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base"
              />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="f-captcha">
              图形验证码
            </label>
            <div className="flex items-center gap-3">
              <div className="relative flex w-full flex-1 items-center">
                <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">barcode_scanner</span>
                <input
                  id="f-captcha"
                  type="text"
                  placeholder="输入图形验证码"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base"
                />
              </div>
              <button
                className="flex h-12 items-center justify-center rounded-lg border border-slate-500 bg-slate-800 px-3 text-sm"
                type="button"
                onClick={loadCaptcha}
              >
                刷新
              </button>
              <div
                className="flex h-12 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-2 dark:border-slate-700 dark:bg-slate-800"
                dangerouslySetInnerHTML={{ __html: captchaSvg }}
              />
            </div>
          </div>
          <button
            className="mt-0 flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            onClick={sendCode}
            disabled={loading}
          >
            获取邮件验证码
          </button>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="f-code">
              邮件验证码
            </label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">mark_email_unread</span>
              <input
                id="f-code"
                type="text"
                placeholder="输入您的邮件验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base"
              />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="f-np">
              新密码
            </label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">lock</span>
              <input
                id="f-np"
                type="password"
                placeholder="输入您的新密码"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base"
              />
            </div>
          </div>
          <div className="flex w-full flex-col">
            <label className="text-slate-700 dark:text-slate-300 text-base font-medium leading-normal pb-2" htmlFor="f-cp">
              确认新密码
            </label>
            <div className="relative flex w-full items-center">
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500">lock_reset</span>
              <input
                id="f-cp"
                type="password"
                placeholder="再次输入您的新密码"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="flex w-full min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500 h-12 px-4 pl-12 text-base"
              />
            </div>
          </div>
          {msg && <div className="text-sm text-slate-300">{msg}</div>}
          <button
            className="mt-1 flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 px-6 text-base font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            onClick={submit}
            disabled={loading}
          >
            重置密码
          </button>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-sm font-normal pt-6">
          记起密码了？{' '}
          <a className="font-medium text-blue-400 underline" href="#/planner">
            返回登录
          </a>
        </p>
      </div>
    </div>
  )
}
