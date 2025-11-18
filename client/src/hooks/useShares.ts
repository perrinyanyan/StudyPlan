import { useEffect, useState } from 'react'
import type { Share } from '../types'

export interface UseSharesParams {
  jwt: string | null
  headers: () => Record<string, string>
}

export interface UseSharesResult {
  shareScope: 'full' | 'blocks_only'
  setShareScope: (v: 'full' | 'blocks_only') => void
  shareDays: number
  setShareDays: (v: number) => void
  shareMsg: string
  shares: Share[]
  createShare: () => Promise<void>
  deleteShare: (id: Share['id']) => Promise<void>
}

export function useShares({ jwt, headers }: UseSharesParams): UseSharesResult {
  const [shares, setShares] = useState<Share[]>([])
  const [shareScope, setShareScope] = useState<'full' | 'blocks_only'>('full')
  const [shareDays, setShareDays] = useState<number>(7)
  const [shareMsg, setShareMsg] = useState<string>('')

  async function listShares() {
    const r = await fetch('/shares', { headers: headers() })
    const j = await r.json()
    if (!r.ok) {
      setShareMsg('加载分享失败: ' + (j.error || r.status))
      return
    }
    setShares((j.items as Share[]) || [])
  }

  async function createShare() {
    setShareMsg('')
    const payload = { scope: shareScope, expires_in_days: shareDays }
    const r = await fetch('/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) {
      setShareMsg('创建失败: ' + (j.error || r.status))
      return
    }
    const feUrl = `${location.origin}/#/shared/${j.token}`
    setShareMsg('已创建: ' + feUrl)
    await listShares()
  }

  async function deleteShare(id: Share['id']) {
    const r = await fetch(`/shares/${id}`, { method: 'DELETE', headers: headers() })
    if (!r.ok) {
      alert('删除失败')
      return
    }
    await listShares()
  }

  useEffect(() => {
    if (!jwt) return
    listShares()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jwt])

  return {
    shareScope,
    setShareScope,
    shareDays,
    setShareDays,
    shareMsg,
    shares,
    createShare,
    deleteShare,
  }
}
