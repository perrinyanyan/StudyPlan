import { useState, useRef, useEffect } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { UserSettings } from '../../types'
import { useAuth } from '../../hooks/useAuth'

export interface SettingsPageProps {
  swReady: boolean
  pushMsg: string
  dailyEnabled: boolean
  settings: UserSettings
  settingsMsg: string
  tzOptions: string[]
  tzPlaceholder: string
  ensureSW: () => void
  subscribePush: () => void
  testPush: () => void
  saveSettings: () => void | Promise<void>
  setDailyEnabled: (value: boolean) => void
  setSettings: Dispatch<SetStateAction<UserSettings>>
}

export function SettingsPage({
  swReady,
  pushMsg,
  dailyEnabled,
  settings,
  settingsMsg,
  tzOptions,
  tzPlaceholder,
  ensureSW,
  subscribePush,
  testPush,
  saveSettings,
  setDailyEnabled,
  setSettings,
}: SettingsPageProps) {
  const { profile, changePassword, updateNickname, updateAvatar } = useAuth()

  // Password Change State
  const [pwdData, setPwdData] = useState({ old: '', new: '', confirm: '' })
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  // Nickname Change State
  const [nickData, setNickData] = useState('')
  const [captcha, setCaptcha] = useState<{ id: string; svg: string } | null>(null)
  const [captchaAns, setCaptchaAns] = useState('')
  const [nickMsg, setNickMsg] = useState('')
  const [nickLoading, setNickLoading] = useState(false)

  // Avatar State
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarMsg, setAvatarMsg] = useState('')

  useEffect(() => {
    if (profile?.nickname) setNickData(profile.nickname)
  }, [profile])

  const refreshCaptcha = async () => {
    const r = await fetch('/auth/captcha')
    const data = await r.json()
    setCaptcha(data)
    setCaptchaAns('')
  }

  const handlePasswordChange = async () => {
    if (pwdData.new !== pwdData.confirm) {
      setPwdMsg('新密码两次输入不一致')
      return
    }
    setPwdLoading(true)
    setPwdMsg('')
    try {
      const res = await changePassword(pwdData.old, pwdData.new)
      if (res.error) {
        setPwdMsg(res.error)
      } else {
        setPwdMsg('密码修改成功')
        setPwdData({ old: '', new: '', confirm: '' })
      }
    } catch (e) {
      setPwdMsg('修改失败')
    } finally {
      setPwdLoading(false)
    }
  }

  const handleNicknameChange = async () => {
    if (!captcha) {
      await refreshCaptcha()
      return
    }
    setNickLoading(true)
    setNickMsg('')
    try {
      const res = await updateNickname(nickData, captcha.id, captchaAns)
      if (res.error) {
        setNickMsg(res.error)
        await refreshCaptcha()
      } else {
        setNickMsg('昵称修改成功')
        setCaptcha(null)
      }
    } catch (e) {
      setNickMsg('修改失败')
    } finally {
      setNickLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarMsg('上传中...')
    try {
      const res = await updateAvatar(file)
      if (res.error) {
        setAvatarMsg(res.error)
      } else {
        setAvatarMsg('头像更新成功')
      }
    } catch (e) {
      setAvatarMsg('上传失败')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">设置</h1>
        <p className="text-slate-400">管理您的个人资料、安全设置和通知偏好</p>
      </header>

      {/* Profile Section */}
      <section className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm transition-all hover:border-slate-600/50">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <span className="material-symbols-outlined">person</span>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">个人资料</h2>
              <p className="text-sm text-slate-400">管理您的公开信息</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 group-hover:border-blue-500 transition-colors">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl">person</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-500 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-medium text-white mb-1">头像</h3>
              <p className="text-sm text-slate-400 mb-2">支持 JPG, PNG, GIF 格式，最大 5MB</p>
              {avatarMsg && <p className="text-sm text-blue-400">{avatarMsg}</p>}
            </div>
          </div>

          <div className="h-px bg-slate-700/50" />

          {/* Nickname */}
          <div className="max-w-md">
            <label className="text-base font-medium text-slate-200 block mb-2">昵称</label>
            <div className="flex gap-3 mb-3">
              <input
                type="text"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                value={nickData}
                onChange={(e) => setNickData(e.target.value)}
                placeholder="设置您的昵称"
              />
              {!captcha && (
                <button
                  onClick={refreshCaptcha}
                  className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
                >
                  修改
                </button>
              )}
            </div>

            {captcha && (
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 animate-fade-in">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="bg-white rounded h-10 px-2 flex items-center"
                    dangerouslySetInnerHTML={{ __html: captcha.svg }}
                  />
                  <button onClick={refreshCaptcha} className="text-slate-400 hover:text-white">
                    <span className="material-symbols-outlined">refresh</span>
                  </button>
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none"
                    placeholder="输入验证码"
                    value={captchaAns}
                    onChange={(e) => setCaptchaAns(e.target.value)}
                  />
                  <button
                    onClick={handleNicknameChange}
                    disabled={nickLoading}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
                  >
                    {nickLoading ? '保存中...' : '确认修改'}
                  </button>
                </div>
              </div>
            )}
            {nickMsg && <p className="mt-2 text-sm text-blue-400">{nickMsg}</p>}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm transition-all hover:border-slate-600/50">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <span className="material-symbols-outlined">lock</span>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">账户安全</h2>
              <p className="text-sm text-slate-400">更新您的密码</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="max-w-md space-y-4">
            <div>
              <label className="text-sm text-slate-400 block mb-1">当前密码</label>
              <input
                type="password"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                value={pwdData.old}
                onChange={(e) => setPwdData({ ...pwdData, old: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">新密码</label>
              <input
                type="password"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                value={pwdData.new}
                onChange={(e) => setPwdData({ ...pwdData, new: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">确认新密码</label>
              <input
                type="password"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                value={pwdData.confirm}
                onChange={(e) => setPwdData({ ...pwdData, confirm: e.target.value })}
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              {pwdMsg && <span className="text-sm text-blue-400">{pwdMsg}</span>}
              <button
                onClick={handlePasswordChange}
                disabled={pwdLoading || !pwdData.old || !pwdData.new}
                className="px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors disabled:opacity-50 ml-auto"
              >
                {pwdLoading ? '更新中...' : '更新密码'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm transition-all hover:border-slate-600/50">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <span className="material-symbols-outlined">notifications</span>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">推送通知</h2>
              <p className="text-sm text-slate-400">管理 Web Push 通知状态</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/50 border border-slate-700/30">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${swReady ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-slate-500'}`} />
              <span className="text-sm font-medium text-slate-200">
                Service Worker 状态: {swReady ? '已就绪' : '未注册'}
              </span>
            </div>
            <button
              onClick={ensureSW}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            >
              重新检测
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={subscribePush}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!swReady}
            >
              <span className="material-symbols-outlined text-[20px]">notifications_active</span>
              订阅通知
            </button>
            <button
              onClick={testPush}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!swReady}
            >
              <span className="material-symbols-outlined text-[20px]">send</span>
              发送测试通知
            </button>
          </div>

          {pushMsg && (
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/30 text-sm text-slate-300 flex items-start gap-2">
              <span className="material-symbols-outlined text-blue-400 text-[18px] mt-0.5">info</span>
              {pushMsg}
            </div>
          )}
        </div>
      </section>

      {/* Preferences Section */}
      <section className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm transition-all hover:border-slate-600/50">
        <div className="p-6 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <span className="material-symbols-outlined">tune</span>
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">偏好设置</h2>
              <p className="text-sm text-slate-400">自定义您的使用体验</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Daily Summary */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <label className="text-base font-medium text-slate-200 block mb-1">每日总结通知</label>
              <p className="text-sm text-slate-400">在指定时间接收当天的任务总结</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="time"
                className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!dailyEnabled}
                value={settings.daily_summary_time || ''}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, daily_summary_time: e.target.value || null }))
                }
              />
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={dailyEnabled}
                  onChange={(e) => setDailyEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          <div className="h-px bg-slate-700/50" />

          {/* Timezone */}
          <div>
            <label className="text-base font-medium text-slate-200 block mb-2">时区设置</label>
            <div className="relative max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">
                public
              </span>
              <input
                list="tz-list"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                value={settings.timezone || ''}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, timezone: e.target.value || null }))
                }
                placeholder={tzPlaceholder}
              />
              <datalist id="tz-list">
                {tzOptions.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              用于正确显示时间和发送通知
            </p>
          </div>

          <div className="h-px bg-slate-700/50" />

          {/* Focus Duration */}
          <div>
            <label className="text-base font-medium text-slate-200 block mb-2">默认专注时长</label>
            <div className="flex items-center gap-3 max-w-md">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">
                  timer
                </span>
                <input
                  type="number"
                  min="1"
                  max="180"
                  className="w-full pl-10 pr-16 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                  value={settings.focus_duration_minutes || 25}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    setSettings((s) => ({ ...s, focus_duration_minutes: isNaN(val) ? null : val }))
                  }}
                  placeholder="25"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  分钟
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              点击任务专注按钮时使用的默认时长 (1-180分钟)
            </p>
          </div>
        </div>

        <div className="p-6 bg-slate-900/30 border-t border-slate-700/50 flex items-center justify-end gap-4">
          {settingsMsg && (
            <span className="text-sm text-emerald-400 animate-fade-in">
              {settingsMsg}
            </span>
          )}
          <button
            onClick={saveSettings}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/20 transition-all active:scale-95 hover:shadow-blue-500/30"
          >
            保存更改
          </button>
        </div>
      </section>
    </div>
  )
}
