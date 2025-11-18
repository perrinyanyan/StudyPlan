import type { Dispatch, SetStateAction } from 'react'
import type { UserSettings } from '../../types'

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
  return (
    <div className="space-y-4">
      <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <h2 className="font-semibold mb-3">通知 / Web Push</h2>
        <div className="flex items-center gap-2 mb-2">
          <span className={`rounded px-2 py-1 ${swReady ? 'bg-emerald-900/60' : 'bg-slate-700'}`}>
            SW: {swReady ? '已就绪' : '未注册'}
          </span>
          <button
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
            onClick={ensureSW}
          >
            注册/检测
          </button>
          <button
            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
            onClick={subscribePush}
          >
            订阅
          </button>
          <button
            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
            onClick={testPush}
          >
            触发测试通知
          </button>
        </div>
        {pushMsg && <div className="text-sm text-slate-300">{pushMsg}</div>}
      </section>

      <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <h2 className="font-semibold mb-3">用户设置</h2>
        <div className="flex items-center gap-3 mb-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dailyEnabled}
              onChange={(e) => setDailyEnabled(e.target.checked)}
            />
            <span>每日总结通知</span>
          </label>
          <input
            type="time"
            className="px-2 py-1 rounded bg-slate-900 border border-slate-700 disabled:opacity-50"
            disabled={!dailyEnabled}
            value={settings.daily_summary_time || ''}
            onChange={(e) =>
              setSettings((s) => ({ ...s, daily_summary_time: e.target.value || null }))
            }
          />
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div className="text-sm">时区</div>
          <input
            list="tz-list"
            className="px-3 py-2 rounded bg-slate-900 border border-slate-700 w-64"
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
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500"
            onClick={saveSettings}
          >
            保存
          </button>
          {settingsMsg && <div className="text-sm text-slate-300">{settingsMsg}</div>}
        </div>
      </section>
    </div>
  )
}
