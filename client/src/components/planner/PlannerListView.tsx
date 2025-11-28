import type { Task } from '../../types'

export interface PlannerListViewProps {
  state: any
  actions: any
}

export function PlannerListView({ state, actions }: PlannerListViewProps) {
  const { unscheduled, unschedMenuOpenId, listEdit, taskMetaMap } = state || {}
  const { fetchUnscheduled, setUnschedMenuOpenId, setListEdit, setEditTask, setScheduleFor, deleteTask, setShowCreateTask, updateTaskAdvanced } = actions || {}

  const list: Task[] = unscheduled || []

  return (
    <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <h2 className="font-semibold mb-3">任务池</h2>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm text-slate-300">未排程任务</h3>
          <button
            className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
            onClick={() => fetchUnscheduled && fetchUnscheduled()}
          >
            刷新
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {list.length === 0 && <div className="text-xs text-slate-400">暂无未排程任务</div>}
          {list.map((t, index) => {
            const isLast = index === list.length - 1
            const menuPositionClass = isLast ? 'bottom-full mb-1' : 'top-full mt-1'
            return (
              <div key={String(t.id)} className="bg-white/5 p-3 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: (t.color || '#4B5563') + '80' }}></div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      {t.recurrence_rule?.includes('PINNED') && (
                        <span className="material-symbols-outlined text-[14px] text-amber-400 rotate-45">push_pin</span>
                      )}
                      <p className="text-white text-sm font-medium leading-tight">{t.title}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-white/80">
                      {t.type && (
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || '#9CA3AF' }}></span>
                          <span>{t.type}</span>
                        </span>
                      )}
                      {typeof t.priority === 'number' && (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium ${t.priority === 2
                            ? 'bg-red-500/20 text-red-300'
                            : t.priority === 1
                              ? 'bg-yellow-500/20 text-yellow-300'
                              : 'bg-green-500/20 text-green-300'
                            }`}
                        >
                          {t.priority === 2 ? '高' : t.priority === 1 ? '中' : '低'}
                        </span>
                      )}
                      {(t.tags || []).map((g) => (
                        <span key={g} className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300">#{g}</span>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!setUnschedMenuOpenId) return
                        const idStr = String(t.id)
                        setUnschedMenuOpenId((prev: string | null) => (prev === idStr ? null : idStr))
                      }}
                    >
                      <span className="material-symbols-outlined text-lg">more_vert</span>
                    </button>
                    {unschedMenuOpenId === String(t.id) && (
                      <div
                        className={`absolute right-0 w-28 rounded-md bg-slate-900 border border-slate-700 shadow-lg z-20 ${menuPositionClass}`}
                      >
                        <button
                          className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                          onClick={() => {
                            setEditTask && setEditTask(t)
                            setUnschedMenuOpenId && setUnschedMenuOpenId(null)
                          }}
                        >
                          修改
                        </button>
                        <button
                          className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                          onClick={async () => {
                            if (!updateTaskAdvanced) return
                            setUnschedMenuOpenId && setUnschedMenuOpenId(null)
                            const isPinned = t.recurrence_rule?.includes('PINNED')
                            let newRule = t.recurrence_rule || 'POOL'
                            if (isPinned) {
                              newRule = newRule.replace(';PINNED', '').replace('PINNED', '')
                              if (newRule === '') newRule = 'POOL' // Fallback if it was just PINNED
                            } else {
                              newRule += ';PINNED'
                            }
                            // Clean up potential double semicolons or leading/trailing
                            newRule = newRule.replace(/;;/g, ';').replace(/^;/, '').replace(/;$/, '')

                            await updateTaskAdvanced(t.id, {
                              title: t.title,
                              recurrence_rule: newRule
                            })
                          }}
                        >
                          {t.recurrence_rule?.includes('PINNED') ? '取消固定' : '固定'}
                        </button>
                        <button
                          className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                          onClick={() => {
                            setUnschedMenuOpenId && setUnschedMenuOpenId(null)
                            setScheduleFor && setScheduleFor(t)
                          }}
                        >
                          安排
                        </button>
                        <button
                          className="block w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-slate-800"
                          onClick={async () => {
                            if (!deleteTask) return
                            setUnschedMenuOpenId && setUnschedMenuOpenId(null)
                            await deleteTask(t.id)
                          }}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {listEdit && listEdit.taskId === String(t.id) && (
                  <div className="mt-2 ml-5 flex flex-wrap items-center gap-2 text-xs text-slate-200">
                    <select
                      className="px-2 py-1 rounded bg-slate-800 border border-slate-600"
                      value={listEdit.priority == null ? '' : String(listEdit.priority)}
                      onChange={(e) => {
                        const v = e.target.value
                        setListEdit &&
                          setListEdit((prev: any) =>
                            prev && prev.taskId === String(t.id)
                              ? { ...prev, priority: v === '' ? null : Number(v) }
                              : prev,
                          )
                      }}
                    >
                      <option value="">优先级(无)</option>
                      <option value="2">高</option>
                      <option value="1">中</option>
                      <option value="0">低</option>
                    </select>
                    <input
                      className="px-2 py-1 rounded bg-slate-800 border border-slate-600 flex-1 min-w-[6rem]"
                      placeholder="任务类型"
                      value={listEdit.type}
                      onChange={(e) =>
                        setListEdit &&
                        setListEdit((prev: any) =>
                          prev && prev.taskId === String(t.id)
                            ? { ...prev, type: e.target.value }
                            : prev,
                        )
                      }
                    />
                    <input
                      className="px-2 py-1 rounded bg-slate-800 border border-slate-600 flex-1 min-w-[8rem]"
                      placeholder="标签，用空格或逗号分隔"
                      value={listEdit.tagsInput}
                      onChange={(e) =>
                        setListEdit &&
                        setListEdit((prev: any) =>
                          prev && prev.taskId === String(t.id)
                            ? { ...prev, tagsInput: e.target.value }
                            : prev,
                        )
                      }
                    />
                    <button
                      className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                      onClick={() => setListEdit && setListEdit(null)}
                    >
                      取消
                    </button>
                    <button
                      className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500"
                      onClick={async () => {
                        if (!listEdit || listEdit.taskId !== String(t.id) || !actions.updateTaskMeta) return
                        const tags = listEdit.tagsInput
                          .split(/[\s,]+/)
                          .map((s2: string) => s2.trim().toLowerCase())
                          .filter(Boolean)
                        await actions.updateTaskMeta(String(t.id), {
                          priority: listEdit.priority,
                          type: listEdit.type.trim() ? listEdit.type.trim() : null,
                          tags,
                        })
                        setListEdit && setListEdit(null)
                      }}
                    >
                      保存
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <button
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#137fec] py-2.5 text-sm font-bold text-white hover:bg-[#0f6cc8]"
        onClick={() => setShowCreateTask && setShowCreateTask(true)}
      >
        <span className="material-symbols-outlined text-xl">add_circle</span>
        添加新任务
      </button>
    </section>
  )
}
