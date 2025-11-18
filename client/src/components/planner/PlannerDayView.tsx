import { TaskItem } from './TaskItem'
import { AddBlock } from './AddBlock'
import type { Task } from '../../types'

export interface PlannerDayViewProps {
  state: any
  actions: any
}

export function PlannerDayView({ state, actions }: PlannerDayViewProps) {
  const {
    tasks,
    unscheduled,
    currentTaskId,
    overdueCollapsed,
    showFutureOnly,
    tasksFlat,
    isToday,
    currentBlock,
    now,
    filteredBlocks,
    hourCollapsed,
    HOUR_PX,
    pxPerMin,
    fetchState,
    blocks,
    taskTitleMap,
    fmtHHmm,
  } = state || {}

  const {
    completeTask,
    deleteTask,
    updateTaskMeta,
    fetchUnscheduled,
    setUnschedMenuOpenId,
    unschedMenuOpenId,
    setEditTask,
    setScheduleFor,
    listEdit,
    setListEdit,
    setOverdueCollapsed,
    setShowCreateTask,
    setShowFutureOnly,
    addBlock,
    deleteBlock,
  } = actions || {}

  const unschedList: Task[] = unscheduled || []

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-6 gap-4 lg:gap-6">
      <div className="md:col-span-2 lg:col-span-2">
        <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h2 className="font-semibold mb-3">任务</h2>
          <button
            className="mt-1 inline-flex items-center gap-2 rounded-lg bg-[#137fec] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f6cc8]"
            onClick={() => setShowCreateTask && setShowCreateTask(true)}
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            添加新任务
          </button>
          <hr className="my-3 border-slate-700" />
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm text-slate-300">未排程任务池</h3>
              <button
                className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                onClick={() => fetchUnscheduled && fetchUnscheduled()}
              >
                刷新
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {unschedList.length === 0 && <div className="text-xs text-slate-400">暂无未排程任务</div>}
              {unschedList.map((t) => (
                <div key={String(t.id)} className="bg-white/5 p-3 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: (t.color || '#4B5563') + '80' }}></div>
                    <div className="flex-1 space-y-1.5">
                      <p className="text-white text-sm font-medium leading-tight">{t.title}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {t.type && (
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: (t.color || '#888') + '33', color: t.color || '#888' }}
                          >
                            {t.type}
                          </span>
                        )}
                        {typeof t.priority === 'number' && (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              t.priority === 2
                                ? 'text-red-400'
                                : t.priority === 1
                                ? 'text-yellow-400'
                                : 'text-green-400'
                            }`}
                          >
                            <span
                              className="material-symbols-outlined text-sm"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              {t.priority === 2
                                ? 'priority_high'
                                : t.priority === 1
                                ? 'drag_handle'
                                : 'arrow_downward'}
                            </span>
                            {t.priority === 2 ? '高' : t.priority === 1 ? '中' : '低'}
                          </span>
                        )}
                        {(t.tags || []).map((g) => (
                          <span
                            key={g}
                            className="text-xs bg-gray-500/20 text-gray-300 px-2 py-0.5 rounded-full"
                          >
                            {g}
                          </span>
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
                        <div className="absolute right-0 mt-1 w-28 rounded-md bg-slate-900 border border-slate-700 shadow-lg z-20">
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
                          if (!listEdit || listEdit.taskId !== String(t.id) || !updateTaskMeta) return
                          const tags = listEdit.tagsInput
                            .split(/[\s,]+/)
                            .map((s2: string) => s2.trim().toLowerCase())
                            .filter(Boolean)
                          await updateTaskMeta(String(t.id), {
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
              ))}
            </div>
          </div>
          <h3 className="text-sm text-slate-300 mb-2">今天</h3>
          <div className="flex flex-col gap-2">
            {(tasks?.today || []).map((t: Task) => (
              <TaskItem
                key={String(t.id)}
                t={t}
                highlight={currentTaskId != null && String(t.id) === String(currentTaskId)}
                onDone={() => completeTask && completeTask(t.id)}
                onDelete={() => deleteTask && deleteTask(t.id)}
                onMetaChange={(p) => updateTaskMeta && updateTaskMeta(t.id, p)}
              />
            ))}
          </div>
          <div className="flex items中心 justify-between mt-4 mb-2">
            <h3 className="text-sm text-slate-300">逾期</h3>
            <button
              className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
              onClick={() => setOverdueCollapsed && setOverdueCollapsed((v: boolean) => !v)}
            >
              {overdueCollapsed ? '展开' : '收起'}
            </button>
          </div>
          {!overdueCollapsed && (
            <div className="flex flex-col gap-2">
              {(tasks?.overdue || []).map((t: Task) => (
                <TaskItem
                  key={String(t.id)}
                  t={t}
                  overdue
                  onDone={() => completeTask && completeTask(t.id)}
                  onDelete={() => deleteTask && deleteTask(t.id)}
                  onMetaChange={(p) => updateTaskMeta && updateTaskMeta(t.id, p)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      <div className="md:col-span-3 lg:col-span-4">
        <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h2 className="font-semibold mb-3">时间块（日视图）</h2>
          <div className="flex items-center justify-between gap-3 mb-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!showFutureOnly}
                onChange={(e) => setShowFutureOnly && setShowFutureOnly(e.target.checked)}
              />
              <span>仅显示未来时段</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                onClick={() => {
                  if (!actions.expandAllHours) return
                  actions.expandAllHours()
                }}
              >
                展开全部
              </button>
              <button
                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                onClick={() => {
                  if (!actions.collapseAllHours) return
                  actions.collapseAllHours()
                }}
              >
                折叠全部
              </button>
            </div>
          </div>
          <AddBlock tasks={tasksFlat || []} onAdd={addBlock} />
          <hr className="my-3 border-slate-700" />
          {isToday && currentBlock && fmtHHmm && (
            <div className="mb-3 p-3 rounded border border-amber-400 bg-amber-900/20 text-amber-200">
              <div className="text-sm">当前时段</div>
              <div className="text-base">
                {fmtHHmm(new Date(currentBlock.start_at))} — {fmtHHmm(new Date(currentBlock.end_at))}
              </div>
              <div className="text-sm mt-1">
                剩余：
                {(() => {
                  const ms = new Date(currentBlock.end_at).getTime() - now.getTime()
                  if (ms <= 0) return '已结束'
                  const mm = Math.floor(ms / 60000)
                  const ss = Math.floor((ms % 60000) / 1000)
                  const hh = Math.floor(mm / 60)
                  const m2 = mm % 60
                  return hh > 0
                    ? `${hh}小时${m2}分${String(ss).padStart(2, '0')}秒`
                    : `${m2}分${String(ss).padStart(2, '0')}秒`
                })()}
              </div>
            </div>
          )}
          <div className="border border-slate-700 rounded-lg overflow-hidden mb-3">
            {Array.from({ length: 24 }).map((_, h) => {
              const hourStart = h * 60
              const hourEnd = (h + 1) * 60
              const blocksInHour = (filteredBlocks || []).filter((b: any) => {
                const s = new Date(b.start_at)
                const e = new Date(b.end_at)
                const startMin = s.getHours() * 60 + s.getMinutes()
                const endMin = e.getHours() * 60 + e.getMinutes()
                return endMin > hourStart && startMin < hourEnd
              })
              const isCurrentHour = isToday && h === now.getHours()
              if (blocksInHour.length === 0 && !isCurrentHour) return null
              let collapsed = (hourCollapsed as any)?.[h]
              if (collapsed === undefined) collapsed = false
              if (isCurrentHour) collapsed = false
              return (
                <div key={h} className="border-t border-slate-800">
                  <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-400 bg-slate-900">
                    <div>{String(h).padStart(2, '0')}:00</div>
                    <div className="text-slate-500">
                      {blocksInHour.length > 0 ? `${blocksInHour.length} 段` : '空'}
                    </div>
                  </div>
                  {!collapsed && (
                    <div className="relative bg-slate-900" style={{ height: `${HOUR_PX}px` }}>
                      {isCurrentHour && (
                        <div
                          className="absolute left-0 right-0 border-t border-rose-500"
                          style={{ top: `${now.getMinutes() * pxPerMin}px` }}
                        />
                      )}
                      {blocksInHour.map((b: any) => {
                        const s = new Date(b.start_at)
                        const e = new Date(b.end_at)
                        const startMin = s.getHours() * 60 + s.getMinutes()
                        const endMin = e.getHours() * 60 + e.getMinutes()
                        const topMin = Math.max(hourStart, startMin) - hourStart
                        const bottomMin = Math.min(hourEnd, endMin) - hourStart
                        const top = topMin * pxPerMin
                        const height = Math.max(2, (bottomMin - topMin) * pxPerMin)
                        const isCur = currentBlock && String((currentBlock as any).id) === String(b.id)
                        const name = b.task_id ? taskTitleMap?.[String(b.task_id)] : undefined
                        return (
                          <div
                            key={String(b.id)}
                            className={`absolute left-1 right-1 rounded border ${
                              isCur
                                ? 'border-amber-400 ring-2 ring-amber-400'
                                : 'border-blue-500'
                            } bg-blue-600/40`}
                            style={{ top, height }}
                          >
                            <div className="px-2 py-1 text-xs">
                              {fmtHHmm ? `${fmtHHmm(s)} — ${fmtHHmm(e)}` : ''}
                              {name ? <span className="ml-2">· {name}</span> : null}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex flex-col gap-2">
            {fetchState === 'error' && <div className="text-rose-300">加载失败</div>}
            {(blocks || []).map((b: any) => {
              const s = new Date(b.start_at)
              const e = new Date(b.end_at)
              const name = b.task_id ? taskTitleMap?.[String(b.task_id)] : undefined
              return (
                <div
                  key={String(b.id)}
                  className="p-3 rounded border border-slate-700 bg-slate-900 flex items-center justify-between"
                >
                  <div>
                    <div>
                      {fmtHHmm ? `${fmtHHmm(s)} — ${fmtHHmm(e)}` : ''}
                      {name ? (
                        <span className="ml-2 text-sm text-slate-300">· {name}</span>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <button
                      className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                      onClick={() => deleteBlock && deleteBlock(b.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
