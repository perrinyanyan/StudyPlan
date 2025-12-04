import { useState } from 'react'

export interface UsePushNotificationsParams {
  headers: () => Record<string, string>
}

export interface UsePushNotificationsResult {
  pushMsg: string
  swReady: boolean
  isSubscribed: boolean
  ensureSW: () => Promise<ServiceWorkerRegistration | null>
  subscribePush: () => Promise<boolean>
  unsubscribePush: () => Promise<void>
  testPush: () => Promise<void>
}

export function usePushNotifications({ headers }: UsePushNotificationsParams): UsePushNotificationsResult {
  const [pushMsg, setPushMsg] = useState<string>('')
  const [swReady, setSwReady] = useState<boolean>(false)
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false)

  async function ensureSW(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      setPushMsg('当前环境不支持 Service Worker')
      return null
    }
    if (!('serviceWorker' in navigator)) {
      setPushMsg('当前浏览器不支持 Service Worker')
      return null
    }
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg) {
      setSwReady(true)
      const sub = await reg.pushManager.getSubscription()
      setIsSubscribed(!!sub)
      return reg
    }
    const r = await navigator.serviceWorker.register('/sw.js')
    setSwReady(true)
    return r
  }

  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = typeof atob === 'function' ? atob(base64) : window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
    return outputArray
  }

  async function subscribePush(): Promise<boolean> {
    setPushMsg('')
    try {
      const reg = await ensureSW()
      if (!reg) return false
      const keyResp = await fetch('/push/public-key')
      const { key } = await keyResp.json()
      if (!key) {
        setPushMsg('VAPID 公钥未配置')
        return false
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as unknown as ArrayBuffer,
      })
      const payload = {
        endpoint: sub.endpoint,
        keys: (sub.toJSON() as any).keys,
        userAgent: navigator.userAgent,
      }
      const r = await fetch('/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        setPushMsg('订阅保存失败: ' + (j.error || r.status))
        return false
      }
      setPushMsg('订阅成功')
      setIsSubscribed(true)
      return true
    } catch (e: any) {
      setPushMsg('订阅失败: ' + (e?.message || String(e)))
      return false
    }
  }

  async function testPush(): Promise<void> {
    setPushMsg('')
    const r = await fetch('/notifications/test', { method: 'POST', headers: headers() })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setPushMsg('触发失败: ' + (j.error || r.status))
      return
    }
    setPushMsg('已触发测试通知')
  }

  async function unsubscribePush(): Promise<void> {
    setPushMsg('')
    try {
      const reg = await ensureSW()
      if (!reg) return

      const sub = await reg.pushManager.getSubscription()
      if (!sub) {
        setPushMsg('当前未订阅')
        setIsSubscribed(false)
        return
      }

      // Unsubscribe from server first
      await fetch('/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      })

      // Then unsubscribe from browser
      await sub.unsubscribe()

      setPushMsg('已取消订阅')
      setIsSubscribed(false)
    } catch (e: any) {
      setPushMsg('取消订阅失败: ' + (e?.message || String(e)))
    }
  }

  return {
    pushMsg,
    swReady,
    isSubscribed,
    ensureSW,
    subscribePush,
    unsubscribePush,
    testPush,
  }
}
