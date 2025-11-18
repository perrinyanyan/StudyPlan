import type { SharedData } from '../../types'
import { todayStr } from '../../utils/datetime'

export interface SharedPageProps {
  shareDate: string
  setShareDate: (value: string) => void
  shareLoading: boolean
  shareError: string
  shared: SharedData | null
  copyShared: () => void | Promise<void>
  jwt: string | null
}

export function SharedPage({ shareDate, setShareDate, shareLoading, shareError, shared, copyShared, jwt }: SharedPageProps) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Shared Plan</h1>
        <div className="text-sm">
          <button
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
            onClick={() => {
              location.href = '/'
            }}
          >
            返回 Planner
          </button>
        </div>
      </header>
      <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <button
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
            onClick={() =>
              setShareDate(
                todayStr(new Date(new Date(shareDate).getTime() - 86400000)),
              )
            }
          >
            前一天
          </button>
          <button
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
            onClick={() => setShareDate(todayStr())}
          >
            今天
          </button>
          <button
            className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
            onClick={() =>
              setShareDate(
                todayStr(new Date(new Date(shareDate).getTime() + 86400000)),
              )
            }
          >
            后一天
          </button>
          <input
            type="date"
            className="px-2 py-1 rounded bg-slate-900 border border-slate-700"
            value={shareDate}
            onChange={(e) => setShareDate(e.target.value)}
          />
        </div>
        {shareLoading && <div className="text-slate-300">加载中...</div>}
        {shareError && <div className="text-rose-300">{shareError}</div>}
        {shared && (
          <div className="space-y-4">
            <div className="text-sm text-slate-300">
              scope: {shared.share.scope} · 过期:{' '}
              {new Date(shared.share.expires_at).toLocaleString()}
            </div>
            {shared.share.scope === 'full' && (
              <div>
                <h3 className="font-semibold mb-2">任务2</h3>
                <div className="flex flex-col gap-2">
                  {(shared.tasks || []).map((t) => (
                    <div
                      key={String(t.id)}
                      className="p-3 rounded border border-slate-700 bg-slate-900"
                    >
                      <div>{t.title}</div>
                      <div className="text-xs text-slate-300 mt-1 flex gap-2">
                        <span>状态: {t.status}</span>
                        {t.due_at ? (
                          <span>截止: {new Date(t.due_at).toLocaleString()}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <h3 className="font-semibold mb-2">时间块</h3>
              <div className="flex flex-col gap-2">
                {(shared.blocks || []).map((b, i) => (
                  <div
                    key={i}
                    className="p-3 rounded border border-slate-700 bg-slate-900"
                  >
                    <div>
                      {new Date(b.start_at).toLocaleTimeString()} —{' '}
                      {new Date(b.end_at).toLocaleTimeString()}{' '}
                      {(() => {
                        const map: Record<string, string> = {}
                        ;(shared.tasks || []).forEach((t) => {
                          map[String(t.id)] = t.title
                        })
                        const name = b.task_id ? map[String(b.task_id)] : undefined
                        return name ? (
                          <span className="ml-2 text-sm text-slate-300">
                            · {name}
                          </span>
                        ) : null
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <button
                className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
                onClick={copyShared}
                disabled={!jwt}
              >
                复制到我的计划
              </button>
              {!jwt && (
                <span className="ml-2 text-sm text-slate-300">请先登录</span>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
