import { AddBlock } from './AddBlock'
import { PlannerListView } from './PlannerListView'
import type { Task } from '../../types'

export interface PlannerDayViewProps {
  state: any
  actions: any
}

export function PlannerDayView({ state, actions }: PlannerDayViewProps) {
  const {
    tasks,
    unscheduled,
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
    taskTitleMap,
    taskStatusMap,
    taskMetaMap,
    listMenuOpenId,
    listFilterType,
    listFilterPriority,
    listFilterTag,
    listFilterOverdue,
    listFilterDone,
    listTypeOptions,
    listTagOptions,
    fmtHHmm,
    rangeTasks,
  } = state || {}

  const {
    deleteTask,
    completeTask,
    updateTaskMeta,
    fetchUnscheduled,
    setUnschedMenuOpenId,
    unschedMenuOpenId,
    setEditTask,
    setScheduleFor,
    listEdit,
    setListEdit,
    setShowCreateTask,
    setShowFutureOnly,
    addBlock,
    deleteBlock,
    setListFilterType,
    setListFilterPriority,
    setListFilterTag,
    setListFilterOverdue,
    setListFilterDone,
    toggleHourCollapsed,
    setListMenuOpenId,
  } = actions || {}

  const timelineBlocks = (filteredBlocks || []).filter((b: any) => {
    const s = new Date(b.start_at)
    const e = new Date(b.end_at)

    if (listFilterOverdue !== 'all') {
      const status = b.task_id ? taskStatusMap?.[String(b.task_id)] : 'open'
      const over = e.getTime() < now.getTime()
      const isOverdue = over && status !== 'done'
      if (listFilterOverdue === 'yes' ? !isOverdue : isOverdue) return false
    }

    if (listFilterDone !== 'all') {
      const st = b.task_id ? taskStatusMap?.[String(b.task_id)] : 'open'
      if (listFilterDone === 'done' ? st !== 'done' : st === 'done') return false
    }

    if (
      listFilterType !== 'all' ||
      listFilterPriority !== 'all' ||
      listFilterTag !== 'all'
    ) {
      if (!b.task_id) return false
      const taskIdStr = String(b.task_id)
      const meta = taskMetaMap?.[taskIdStr]
      if (!meta) return false
      if (listFilterPriority !== 'all') {
        const p = meta.priority ?? null
        if (String(p ?? '') !== listFilterPriority) return false
      }
      if (listFilterType !== 'all') {
        const t = meta.type || ''
        if (t !== listFilterType) return false
      }
      if (listFilterTag !== 'all') {
        const tags = meta.tags || []
        if (!tags.includes(listFilterTag)) return false
      }
    }

    return true
  })

  const hourInfos = Array.from({ length: 24 }).map((_, h) => {
    const hourStart = h * 60
    const hourEnd = (h + 1) * 60
    const hourBlocks = timelineBlocks.filter((b: any) => {
      const s = new Date(b.start_at)
      const e = new Date(b.end_at)
      const startMin = s.getHours() * 60 + s.getMinutes()
      const endMin = e.getHours() * 60 + e.getMinutes()
      return endMin > hourStart && startMin < hourEnd
    })
    const hasAny = hourBlocks.length > 0
    const isCurrentHour = isToday && h === now.getHours()
    let collapsedFlag = (hourCollapsed as any)?.[h] as boolean | undefined
    if (collapsedFlag === undefined) {
      collapsedFlag = !hasAny
    }
    if (isCurrentHour) {
      collapsedFlag = false
    }
    return {
      h,
      hourStart,
      hourEnd,
      hourBlocks,
      hasAny,
      collapsed: !!collapsedFlag,
      isCurrentHour,
    }
  })

  const hourRows: Array<
    | { kind: 'collapsed'; start: number; end: number }
    | { kind: 'expanded'; info: (typeof hourInfos)[number] }
  > = []

  let idx = 0
  while (idx < hourInfos.length) {
    const info = hourInfos[idx]
    if (info.collapsed && !info.hasAny) {
      let end = idx + 1
      while (end < hourInfos.length && hourInfos[end].collapsed && !hourInfos[end].hasAny) {
        end += 1
      }
      hourRows.push({ kind: 'collapsed', start: idx, end })
      idx = end
    } else {
      hourRows.push({ kind: 'expanded', info })
      idx += 1
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-6 gap-4 lg:gap-6">
      <div className="md:col-span-3 lg:col-span-4">
        <section className="rounded-xl border border-white/10 bg-slate-800/50 overflow-hidden">
          <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-sm p-3 border-b border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3 text-white/90 text-sm">
                <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                  <span className="text-xs text-white/70">类型</span>
                  <select
                    className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                    value={listFilterType}
                    onChange={(e) => setListFilterType && setListFilterType(e.target.value)}
                  >
                    <option value="all" className="text-slate-900">
                      所有
                    </option>
                    {(listTypeOptions || []).map((name: string) => (
                      <option key={name} value={name} className="text-slate-900">
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                  <span className="text-xs text-white/70">优先</span>
                  <select
                    className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                    value={listFilterPriority}
                    onChange={(e) => setListFilterPriority && setListFilterPriority(e.target.value as any)}
                  >
                    <option value="all" className="text-slate-900">
                      所有
                    </option>
                    <option value="2" className="text-slate-900">
                      高
                    </option>
                    <option value="1" className="text-slate-900">
                      中
                    </option>
                    <option value="0" className="text-slate-900">
                      低
                    </option>
                  </select>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                  <span className="text-xs text-white/70">标签</span>
                  <select
                    className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                    value={listFilterTag}
                    onChange={(e) => setListFilterTag && setListFilterTag(e.target.value)}
                  >
                    <option value="all" className="text-slate-900">
                      所有
                    </option>
                    {(listTagOptions || []).map((name: string) => (
                      <option key={name} value={name} className="text-slate-900">
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                  <span className="text-xs text-white/70">逾期</span>
                  <select
                    className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                    value={listFilterOverdue}
                    onChange={(e) => setListFilterOverdue && setListFilterOverdue(e.target.value as any)}
                  >
                    <option value="all" className="text-slate-900">
                      所有
                    </option>
                    <option value="yes" className="text-slate-900">
                      是
                    </option>
                    <option value="no" className="text-slate-900">
                      否
                    </option>
                  </select>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                  <span className="text-xs text-white/70">完成</span>
                  <select
                    className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                    value={listFilterDone}
                    onChange={(e) => setListFilterDone && setListFilterDone(e.target.value as any)}
                  >
                    <option value="all" className="text-slate-900">
                      所有
                    </option>
                    <option value="done" className="text-slate-900">
                      已完成
                    </option>
                    <option value="open" className="text-slate-900">
                      未完成
                    </option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={!!showFutureOnly}
                    onChange={(e) => setShowFutureOnly && setShowFutureOnly(e.target.checked)}
                  />
                  <span>仅显示未来时段</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs"
                    onClick={() => {
                      if (!actions.expandAllHours) return
                      actions.expandAllHours()
                    }}
                  >
                    展开全部
                  </button>
                  <button
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs"
                    onClick={() => {
                      if (!actions.collapseAllHours) return
                      actions.collapseAllHours()
                    }}
                  >
                    折叠全部
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 space-y-3">
           

            {isToday && currentBlock && fmtHHmm && (
              <div className="p-3 rounded border border-amber-400 bg-amber-900/20 text-amber-200">
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
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <div className="w-full">
                <div className="grid grid-cols-[auto_1fr] min-h-full">
                  <div className="border-r border-white/10">
                    <div className="h-8 sticky top-0 bg-slate-900/80 backdrop-blur-sm z-20 flex items-center justify-center text-sm font-medium leading-normal text-gray-400 border-b border-white/10">
                      时间
                    </div>
                    {hourRows.map((row) => {
                      if (row.kind === 'collapsed') {
                        const start = row.start
                        const end = row.end
                        const startLabel = `${String(start).padStart(2, '0')}:00`
                        const endLabel = `${String(end).padStart(2, '0')}:00`
                        return (
                          <div
                            key={`collapsed-${start}-${end}`}
                            className="h-8 py-1 flex items-center justify-center relative border-t border-white/10"
                          >
                            <button
                              className="text-xs text-gray-500 hover:text-white flex items-center gap-1"
                              onClick={() => {
                                if (!toggleHourCollapsed) return
                                for (let h = start; h < end; h += 1) {
                                  toggleHourCollapsed(h)
                                }
                              }}
                            >
                              <span className="material-symbols-outlined text-sm">unfold_more</span>
                                          
                            </button>
                          </div>
                        )
                      }

                      const { h } = row.info

                      return (
                        <div
                          key={`hour-${h}`}
                          className="relative border-t border-white/10 h-24 flex items-center justify-center text-xs text-gray-400"
                        >
                          <span>{String(h).padStart(2, '0')}:00</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="relative">
                    <div className="h-8 sticky top-0 bg-slate-900/80 backdrop-blur-sm z-20 flex items-center px-4 text-sm font-medium leading-normal text-gray-300 border-b border-white/10">
                      日视图
                    </div>
                    {hourRows.map((row) => {
                      if (row.kind === 'collapsed') {
                        const start = row.start
                        const end = row.end
                        const startLabel = `${String(start).padStart(2, '0')}:00`
                        const endLabel = `${String(end).padStart(2, '0')}:00`
                        return (
                          <div
                            key={`collapsed-body-${start}-${end}`}
                            className="h-8 border-t border-white/10 flex items-center justify-center"
                          >
                            <span className="text-xs text-gray-500">
                              {startLabel}-{endLabel} 已折叠
                            </span>
                          </div>
                        )
                      }

                      const { h, hourStart, hourEnd, hourBlocks, isCurrentHour } = row.info

                      return (
                        <div key={`hour-body-${h}`} className="relative h-24 border-t border-white/10 bg-slate-900">
                          <div className="absolute inset-0 grid grid-rows-[repeat(2,1fr)]">
                            <div className="border-b border-dashed border-white/5" />
                            <div className="border-b border-white/10" />
                          </div>
                          {isCurrentHour && (
                            <div
                              className="absolute inset-x-0 z-10 flex items-center"
                              style={{ top: (now.getMinutes() / 60) * 96 }}
                            >
                              <div className="h-2 w-2 -ml-1 rounded-full bg-red-500" />
                              <div className="h-0.5 flex-grow bg-red-500" />
                            </div>
                          )}
                          <div className="relative z-20 px-2 py-1 space-y-1">
                            {hourBlocks.map((b: any) => {
                              const s = new Date(b.start_at)
                              const e = new Date(b.end_at)
                              const startMin = s.getHours() * 60 + s.getMinutes()
                              const endMin = e.getHours() * 60 + e.getMinutes()
                              const topMin = Math.max(hourStart, startMin) - hourStart
                              const bottomMin = Math.min(hourEnd, endMin) - hourStart
                              const top = (topMin / 60) * 96
                              const height = Math.max(12, ((bottomMin - topMin) / 60) * 96)

                              const taskIdStr = b.task_id ? String(b.task_id) : null
                              const meta = taskIdStr ? taskMetaMap?.[taskIdStr] : undefined
                              const baseColor = meta?.color || '#60A5FA'
                              const barColor = (meta?.color || '#60A5FA') + 'CC'
                              const typeDotColor = meta?.color || '#9CA3AF'
                              const name = b.task_id
                                ? taskTitleMap?.[String(b.task_id)]
                                : undefined
                              const status = taskIdStr ? taskStatusMap?.[taskIdStr] : 'open'
                              const over = e.getTime() < now.getTime()
                              const isOverdue = over && status !== 'done'
                              const prio = meta?.priority ?? null
                              const prioLabel =
                                prio === 2 ? '高' : prio === 1 ? '中' : prio === 0 ? '低' : null
                              const prioClass =
                                prio === 2
                                  ? 'bg-red-500/20 text-red-300'
                                  : prio === 1
                                  ? 'bg-yellow-500/20 text-yellow-300'
                                  : prio === 0
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-slate-500/20 text-slate-300'
                              const type = meta?.type || null
                              const tags = meta?.tags || []
                              const isCur =
                                currentBlock &&
                                String((currentBlock as any).id) === String(b.id)
                              const blockId = String(b.id)
                              const isMenuOpen = listMenuOpenId === blockId

                              return (
                                <div
                                  key={String(b.id)}
                                  className={`absolute left-1 right-1 rounded-lg border text-xs text-white/90 flex flex-col gap-1 bg-white/5 ${
                                    isCur
                                      ? 'border-amber-400 ring-2 ring-amber-400 bg-amber-500/10'
                                      : 'border-transparent'
                                  }`}
                                  style={{
                                    top,
                                    height,
                                  }}
                                >
                                  <div className="h-full px-2.5 py-2 flex flex-col justify-between">
                                    <div className="flex items-center gap-2.5">
                                      <div
                                        className="w-1.5 h-10 rounded-full"
                                        style={{ backgroundColor: barColor }}
                                      ></div>
                                      <div className="flex items-center justify-between w-full text-sm">
                                        <div className="flex flex-col flex-1 min-w-0">
                                          <div className="flex items-center gap-1">
                                            {status === 'done' && (
                                              <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[0.65rem] font-medium text-emerald-300">
                                                完成
                                              </span>
                                            )}
                                            <p
                                              className={`font-medium truncate ${
                                                status === 'done'
                                                  ? 'line-through opacity-60'
                                                  : ''
                                              }`}
                                            >
                                              {name || '时间块'}
                                            </p>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-white/80">
                                            {type && (
                                              <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1">
                                                <span
                                                  className="w-2 h-2 rounded-full"
                                                  style={{ backgroundColor: typeDotColor }}
                                                ></span>
                                                <span>{type}</span>
                                              </span>
                                            )}
                                            {tags.map((g: string) => (
                                              <span
                                                key={g}
                                                className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300"
                                              >
                                                #{g}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                        <div
                                          className={`flex items-center text-white/80 gap-2 text-xs ml-3 ${
                                            status === 'done' ? 'opacity-60' : ''
                                          }`}
                                        >
                                          {isOverdue && (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-red-500/80 px-2 py-1 font-bold text-white text-xs">
                                              <span className="material-symbols-outlined text-sm">
                                                error
                                              </span>
                                              逾期
                                            </span>
                                          )}
                                          <p className="whitespace-nowrap">
                                            {fmtHHmm ? fmtHHmm(s) : ''} - {fmtHHmm ? fmtHHmm(e) : ''}
                                          </p>
                                          {prioLabel && (
                                            <span
                                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium ${prioClass}`}
                                            >
                                              <span>{prioLabel}</span>
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 pl-3">
                                          {taskIdStr && (
                                            <div className="relative">
                                              <button
                                                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  if (!setListMenuOpenId) return
                                                  setListMenuOpenId(isMenuOpen ? null : blockId)
                                                }}
                                              >
                                                <span className="material-symbols-outlined text-lg">
                                                  more_vert
                                                </span>
                                              </button>
                                              {isMenuOpen && (
                                                <div className="absolute right-0 mt-1 w-28 rounded-md bg-slate-900 border border-slate-700 shadow-lg z-20">
                                                  <button
                                                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                                                    onClick={() => {
                                                      if (!taskIdStr) return
                                                      if (!tasks) return
                                                      const candidates: Task[] = []
                                                      ;(tasks.today || []).forEach((x: Task) =>
                                                        candidates.push(x),
                                                      )
                                                      ;(tasks.overdue || []).forEach((x: Task) =>
                                                        candidates.push(x),
                                                      )
                                                      ;(unscheduled || []).forEach((x: Task) =>
                                                        candidates.push(x),
                                                      )
                                                      ;(rangeTasks || []).forEach((x: Task) =>
                                                        candidates.push(x),
                                                      )
                                                      const t = candidates.find(
                                                        (x) => String(x.id) === taskIdStr,
                                                      )
                                                      if (t && setEditTask) {
                                                        setEditTask(t)
                                                      }
                                                      setListMenuOpenId && setListMenuOpenId(null)
                                                    }}
                                                  >
                                                    修改
                                                  </button>
                                                  <button
                                                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                                                    onClick={async () => {
                                                      if (!taskIdStr || !completeTask) return
                                                      setListMenuOpenId && setListMenuOpenId(null)
                                                      await completeTask(taskIdStr)
                                                    }}
                                                  >
                                                    完成
                                                  </button>
                                                  <button
                                                    className="block w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-slate-800"
                                                    onClick={async () => {
                                                      if (!taskIdStr || !deleteTask) return
                                                      setListMenuOpenId && setListMenuOpenId(null)
                                                      await deleteTask(taskIdStr)
                                                    }}
                                                  >
                                                    删除
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {fetchState === 'error' && (
              <div className="text-sm text-rose-300">加载失败</div>
            )}
          </div>
        </section>
      </div>

      <div className="md:col-span-2 lg:col-span-2">
        <PlannerListView
          state={{ unscheduled, unschedMenuOpenId, listEdit, taskMetaMap }}
          actions={{
            fetchUnscheduled,
            setUnschedMenuOpenId,
            setListEdit,
            setEditTask,
            setScheduleFor,
            deleteTask,
            setShowCreateTask,
            updateTaskMeta,
          }}
        />
      </div>
    </div>
  )
}
