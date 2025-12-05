import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { getApiUrl } from '../config'
import type { UserSettings } from '../types'
import { DEFAULT_TZ_LIST, defaultTimeZone } from '../utils/datetime'

export interface UseSettingsParams {
  jwt: string | null
  headers: () => Record<string, string>
}

export interface UseSettingsResult {
  settings: UserSettings
  setSettings: Dispatch<SetStateAction<UserSettings>>
  settingsMsg: string
  dailyEnabled: boolean
  setDailyEnabled: Dispatch<SetStateAction<boolean>>
  tzOptions: string[]
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
}

export function useSettings({ jwt, headers }: UseSettingsParams): UseSettingsResult {
  const [settings, setSettings] = useState<UserSettings>(() => ({
    daily_summary_time: null,
    timezone: defaultTimeZone(),
    focus_duration_minutes: 25,
    focus_start_sound: 'gentle',
    focus_end_sound: 'gentle',
  }))
  const [settingsMsg, setSettingsMsg] = useState<string>('')
  const [dailyEnabled, setDailyEnabled] = useState<boolean>(false)

  const tzOptions = useMemo(() => {
    const anyIntl: any = Intl as any
    if (anyIntl && typeof anyIntl.supportedValuesOf === 'function') {
      try {
        return anyIntl.supportedValuesOf('timeZone') as string[]
      } catch { }
    }
    return DEFAULT_TZ_LIST
  }, [])

  async function loadSettings() {
    if (!jwt) return
    setSettingsMsg('')
    const r = await fetch(getApiUrl('/settings'), { headers: headers() })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      setSettingsMsg('加载失败: ' + (j.error || r.status))
      return
    }
    const hhmm =
      typeof j.daily_summary_time === 'string' && j.daily_summary_time.length >= 5
        ? j.daily_summary_time.slice(0, 5)
        : null
    setSettings({
      daily_summary_time: hhmm,
      timezone: j.timezone ?? defaultTimeZone(),
      focus_duration_minutes: j.focus_duration_minutes ?? 25,
      focus_start_sound: j.focus_start_sound ?? 'gentle',
      focus_end_sound: j.focus_end_sound ?? 'gentle',
    })
    setDailyEnabled(Boolean(hhmm))
  }

  async function saveSettings() {
    if (!jwt) return
    setSettingsMsg('')
    const payload = {
      daily_summary_time: dailyEnabled
        ? settings.daily_summary_time || '20:00'
        : null,
      timezone: settings.timezone || defaultTimeZone(),
      focus_duration_minutes: settings.focus_duration_minutes,
      focus_start_sound: settings.focus_start_sound,
      focus_end_sound: settings.focus_end_sound,
    }
    const r = await fetch(getApiUrl('/settings'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      setSettingsMsg('保存失败: ' + (j.error || r.status))
      return
    }
    setSettingsMsg('已保存')
  }

  return {
    settings,
    setSettings,
    settingsMsg,
    dailyEnabled,
    setDailyEnabled,
    tzOptions,
    loadSettings,
    saveSettings,
  }
}
