import { useEffect, useState } from 'react'

export interface UseAuthResult {
  jwt: string | null
  profile: { id: string | number; email: string; nickname?: string } | null
  loginMsg: string
  rememberJwt: (token: string | null) => void
  doLogin: (email: string, password: string) => Promise<void>
  headers: () => Record<string, string>
}

export function useAuth(): UseAuthResult {
  const [jwt, setJwt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('jwt')
  })
  const [profile, setProfile] = useState<{ id: string | number; email: string; nickname?: string } | null>(null)
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

  useEffect(() => {
    if (!jwt) {
      setProfile(null)
      return
    }
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
        setProfile(null)
      }
    })()
  }, [jwt])

  return { jwt, profile, loginMsg, rememberJwt, doLogin, headers }
}
