import type { Share } from '../../types'

export type ShareItem = Share

export interface SharesPageProps {
  jwt: string | null
  shareScope: 'full' | 'blocks_only'
  shareDays: number
  shareMsg: string
  shares: ShareItem[]
  setShareScope: (value: 'full' | 'blocks_only') => void
  setShareDays: (value: number) => void
  createShare: () => void | Promise<void>
  deleteShare: (id: string | number) => void | Promise<void>
}

export function SharesPage({
  jwt,
  shareScope,
  shareDays,
  shareMsg,
  shares,
  setShareScope,
  setShareDays,
  createShare,
  deleteShare,
}: SharesPageProps) {
  return (
    <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <h2 className="font-semibold mb-3">我的分享</h2>
      <div className="flex items-center gap-2 mb-2">
        <select
          className="px-2 py-2 rounded bg-slate-900 border border-slate-700"
          value={shareScope}
          onChange={(e) => setShareScope(e.target.value as 'full' | 'blocks_only')}
        >
          <option value="full">完整（任务+时间块）</option>
          <option value="blocks_only">仅时间块</option>
        </select>
        <input
          type="number"
          min={1}
          max={365}
          className="w-28 px-2 py-2 rounded bg-slate-900 border border-slate-700"
          value={shareDays}
          onChange={(e) => setShareDays(Number(e.target.value || 7))}
        />
        <button
          className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500"
          onClick={createShare}
          disabled={!jwt}
        >
          创建分享链接
        </button>
      </div>
      {shareMsg && <div className="text-sm text-slate-300 mb-2">{shareMsg}</div>}
      <div className="flex flex-col gap-2">
        {shares.map((s) => (
          <div
            key={String(s.id)}
            className="p-3 rounded border border-slate-700 bg-slate-900 flex items-center justify-between"
          >
            <div>
              <div>
                scope: {s.scope}{' '}
                <span className="ml-2 text-xs text-slate-300">
                  过期: {new Date(s.expires_at).toLocaleString()}
                </span>
              </div>
              <a
                className="text-sm text-blue-300"
                href={`${location.origin}/#/shared/${s.token}`}
                target="_blank"
                rel="noreferrer"
              >
                {location.origin}/#/shared/{s.token}
              </a>
            </div>
            <div>
              <button
                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                onClick={() => deleteShare(s.id)}
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
