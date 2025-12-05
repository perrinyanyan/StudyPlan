import { useEffect, useState } from 'react'

import { UserRole } from '../types'

export interface UseAuthResult {
  jwt: string | null
  profile: {
    id: string | number;
    email: string;
    nickname?: string;
    avatar_url?: string;
    role?: UserRole;
    roles?: {
      role: UserRole;
      scope_type: 'global' | 'school' | 'class';
      scope_id: string | null;
      class_name?: string;
    }[];
  } | null
  loginMsg: string
  rememberJwt: (token: string | null) => void
  doLogin: (email: string, password: string) => Promise<void>
  headers: () => Record<string, string>
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ error?: string; message?: string }>
  updateNickname: (nickname: string, captchaId: string, captchaAnswer: string) => Promise<{ error?: string; message?: string }>
  updateAvatar: (file: File) => Promise<{ error?: string; message?: string; avatar_url?: string }>
}

export function useAuth(): UseAuthResult {
  const [jwt, setJwt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('jwt')
  })
  const [profile, setProfile] = useState<{
    id: string | number;
    email: string;
    nickname?: string;
    avatar_url?: string;
    role?: UserRole;
    roles?: {
      role: UserRole;
      scope_type: 'global' | 'school' | 'class';
      scope_id: string | null;
      class_name?: string;
    }[];
  } | null>(null)
  const [loginMsg, setLoginMsg] = useState<string>('')

  function headers(): Record<string, string> {
    return jwt ? { Authorization: `Bearer ${jwt}` } : {}
  }

  function rememberJwt(token: string | null) {
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('jwt', token)
      else localStorage.removeItem('jwt')
    }
    setJwt(token)
  }

  async function doLogin(email: string, password: string) {
    setLoginMsg('')
    const r = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setLoginMsg(`登录失败: ${j.error || r.status}`)
      return
    }
    const j = (await r.json()) as { token: string }
    rememberJwt(j.token)
  }

  async function changePassword(oldPassword: string, newPassword: string) {
    if (!jwt) return { error: 'Not logged in' }
    const r = await fetch('/auth/change-password', {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    })
    return r.json()
  }

  async function updateNickname(nickname: string, captchaId: string, captchaAnswer: string) {
    if (!jwt) return { error: 'Not logged in' }
    const r = await fetch('/auth/profile/nickname', {
      method: 'PATCH',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, captcha_id: captchaId, captcha_answer: captchaAnswer }),
    })
    const data = await r.json()
    if (r.ok) {
      setProfile((p) => p ? { ...p, nickname } : p)
    }
    return data
  }

  async function updateAvatar(file: File) {
    if (!jwt) return { error: 'Not logged in' }
    const formData = new FormData()
    formData.append('avatar', file)

    const r = await fetch('/auth/profile/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` }, // No Content-Type for FormData
      body: formData,
    })
    const data = await r.json()
    if (r.ok && data.avatar_url) {
      setProfile((p) => p ? { ...p, avatar_url: data.avatar_url } : p)
    }
    return data
  }

  useEffect(() => {
    if (!jwt) {
      setProfile(null)
      return
    }
    ; (async () => {
      try {
        const r = await fetch('/auth/me', { headers: headers() })
        if (r.ok) {
          const d = await r.json()
          setProfile(d)
        } else {
          setProfile(null)
        }
      } catch {
        setProfile(null)
      }
    })()
  }, [jwt])

  return { jwt, profile, loginMsg, rememberJwt, doLogin, headers, changePassword, updateNickname, updateAvatar }
}
