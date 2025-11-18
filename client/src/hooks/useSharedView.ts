import { useEffect, useState } from 'react'
import type { SharedData } from '../types'
import { todayStr } from '../utils/datetime'

export interface UseSharedViewParams {
  headers: () => Record<string, string>
}

export interface UseSharedViewResult {
  shareToken: string | null
  shareDate: string
  setShareDate: (v: string) => void
  shareLoading: boolean
  shareError: string
  sharedData: SharedData | null
  copyShared: (jwt: string | null) => Promise<void>
}

function shareTokenFromPath(): string | null {
  const url = new URL(location.href)
  const q = url.searchParams.get('shared')
  if (q) return q
  const hash = location.hash || ''
  let m = hash.match(/^#\/shared\/([^\/?#]+)/)
  if (m) return m[1]
  m = location.pathname.match(/^\/shared\/([^\/?#]+)/)
  return m ? m[1] : null
}

export function useSharedView({ headers }: UseSharedViewParams): UseSharedViewResult {
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareDate, setShareDate] = useState<string>(() => todayStr())
  const [shareLoading, setShareLoading] = useState<boolean>(false)
  const [shareError, setShareError] = useState<string>('')
  const [sharedData, setSharedData] = useState<SharedData | null>(null)

  async function fetchSharedData(token: string) {
    setShareLoading(true)
    setShareError('')
    try {
      const r = await fetch(`/shared/${token}?date=${shareDate}`, { headers: headers() })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        setSharedData(null)
        setShareError('加载失败: ' + (j.error || r.status))
        return
      }
      setSharedData(j as SharedData)
    } finally {
      setShareLoading(false)
    }
  }

  async function copyShared(jwt: string | null) {
    if (!shareToken) return
    if (!jwt) {
      setShareError('请先登录后再复制到自己的计划')
      return
    }
    const r = await fetch(`/shared/${shareToken}/copy?date=${shareDate}`, {
      method: 'POST',
      headers: headers(),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      setShareError('复制失败: ' + (j.error || r.status))
      return
    }
    setShareError('已复制')
  }

  useEffect(() => {
    const tok = shareTokenFromPath()
    setShareToken(tok)
    if (tok) setShareDate(todayStr())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (shareToken) fetchSharedData(shareToken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken, shareDate])

  return {
    shareToken,
    shareDate,
    setShareDate,
    shareLoading,
    shareError,
    sharedData,
    copyShared,
  }
}
