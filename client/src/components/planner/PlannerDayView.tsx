import { useState, useRef } from 'react'
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
    unschedMenuOpenId,
  } = state || {}

  const {
    deleteTask,
    completeTask,
    updateTaskMeta,
    fetchUnscheduled,
    setUnschedMenuOpenId,
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
    setCenterAlert,
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

  const [hoveredTask, setHoveredTask] = useState<any | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null)
  const hoverTimeoutRef = useRef<any>(null)
  const [cardMenuOpen, setCardMenuOpen] = useState(false)

  const effectivePxPerMin = pxPerMin || (HOUR_PX ? HOUR_PX / 60 : 96 / 60)
  const hourHeight = effectivePxPerMin * 60

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
    const shortCount = hourBlocks.filter((b: any) => {
      const s = new Date(b.start_at)
      const e = new Date(b.end_at)
      const startMin = s.getHours() * 60 + s.getMinutes()
      const endMin = e.getHours() * 60 + e.getMinutes()
      const duration = endMin - startMin
      const fullyWithinHour = startMin >= hourStart && endMin <= hourEnd
      return fullyWithinHour && duration > 0 && duration <= 60
    }).length
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
      shortCount,
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
        <section className="rounded-xl border border-white/10 bg-slate-800/50">
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
              <div className="flex items-center gap-3 w-full justify-end">
                <label className="flex items-center gap-2 text-xs text-slate-200" >
                  <input
                    type="checkbox"
                    checked={!!showFutureOnly}
                    onChange={(e) => setShowFutureOnly && setShowFutureOnly(e.target.checked)}
                  />
                  <span>仅显示未来</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs"
                    onClick={() => {
                      if (!actions.expandAllHours) return
                      actions.expandAllHours()
                    }}
                  >
                    展开
                  </button>
                  <button
                    className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs"
                    onClick={() => {
                      if (!actions.collapseAllHours) return
                      actions.collapseAllHours()
                    }}
                  >
                    折叠
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 space-y-3">
            <div className="overflow-x-hidden rounded-xl border border-white/10 bg-black/20">
              <div className="w-full">
                <div className="grid grid-cols-[auto_1fr] min-h-full pt-0">
                  <div className="border-r border-white/10">
                    {hourRows.map((row, rowIndex) => {
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

                      const { h, hourStart, hourEnd, hourBlocks, shortCount } = row.info as any
                      const rowFactor = Math.max(1, shortCount || 0)
                      const localRowHeight = hourHeight * rowFactor

                      return (
                        <div
                          key={`hour-${h}`}
                          className="relative border-t border-white/10 flex items-center justify-center text-xs text-gray-400"
                          style={{ height: localRowHeight }}
                        >
                          <span>{String(h).padStart(2, '0')}:00</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="relative pb-12">

                    {hourRows.map((row, rowIndex) => {
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

                      const { h, hourStart, hourEnd, hourBlocks, shortCount, isCurrentHour } =
                        row.info as any

                      const rowFactor = Math.max(1, shortCount || 0)
                      const localRowHeight = hourHeight * rowFactor

                      return (
                        <div
                          key={`hour-body-${h}`}
                          className="relative border-t border-white/10 bg-slate-900"
                          style={{ height: localRowHeight }}
                        >
                          <div className="absolute inset-0 pointer-events-none grid grid-rows-[repeat(2,1fr)]">
                            <div className="border-b border-dashed border-white/5" />
                            <div className="border-b border-white/10" />
                          </div>
                          {isCurrentHour && (
                            <div
                              className="absolute z-30 pointer-events-none"
                              // 添加 -translate-y-1/2 确保三角形的尖角中心对准当前时间线
                              // left 可能需要微调，比如 left: 12，取决于你想让它离轴线多近
                              style={{ top: now.getMinutes() * effectivePxPerMin, left: 7, transform: 'translateY(-50%)' }}
                            >
                              {/* 这是一个利用边框制作的三角形 */}
                              <div
                                className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-yellow-500"
                              />
                            </div>
                          )}
                          <div className="relative px-2 py-1 space-y-1">
                            {(() => {
                              let shortIndex = 0
                              return hourBlocks.map((b: any) => {
                                const s = new Date(b.start_at)
                                const e = new Date(b.end_at)
                                const startMin = s.getHours() * 60 + s.getMinutes()
                                const endMin = e.getHours() * 60 + e.getMinutes()

                                const clampedStart = Math.max(0, startMin)
                                const clampedEnd = Math.min(24 * 60, endMin)
                                if (clampedEnd <= clampedStart) return null

                                const duration = clampedEnd - clampedStart
                                const fullyWithinHour =
                                  startMin >= hourStart && endMin <= hourEnd && duration <= 60

                                let top = 0
                                let height = hourHeight
                                let barTopPx = 0
                                let barBottomPx = 0
                                let cardStartMin = 0
                                let cardEndMin = 0
                                const isLong = !fullyWithinHour

                                if (fullyWithinHour) {
                                  // 纯粹属于这一小时内的短任务，按在本小时内的顺序垂直堆叠
                                  const stackIndex = shortIndex
                                  shortIndex += 1
                                  top = stackIndex * hourHeight
                                  height = hourHeight
                                  cardStartMin = hourStart
                                  cardEndMin = hourEnd
                                } else {
                                  // 跨小时 / 多小时任务：只在开始小时渲染一次，按整小时块跨度来计算高度
                                  const startBlock = Math.floor(clampedStart / 60)
                                  const endBlockExclusive = Math.ceil(clampedEnd / 60)
                                  const spanBlocks = Math.max(1, endBlockExclusive - startBlock)
                                  if (h !== startBlock) {
                                    return null
                                  }
                                  top = 0
                                  height = spanBlocks * hourHeight
                                  cardStartMin = startBlock * 60
                                  cardEndMin = endBlockExclusive * 60
                                }

                                const barStartOffsetMin = Math.max(0, startMin - cardStartMin)
                                const barEndOffsetMin = Math.max(0, cardEndMin - endMin)
                                barTopPx = barStartOffsetMin * effectivePxPerMin
                                barBottomPx = barEndOffsetMin * effectivePxPerMin

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
                                const menuPositionClass = 'top-full mt-1'

                                return (
                                  <div
                                    key={String(b.id)}
                                    className={`absolute left-1 right-1 rounded-lg border text-xs text-white/90 flex flex-col gap-1 bg-white/5 border-transparent ${isMenuOpen ? 'z-40' : 'z-10'
                                      }`}
                                    style={{
                                      top,
                                      height,
                                    }}
                                    onMouseEnter={(e) => {
                                      if (b.task_id && meta) {
                                        if (hoverTimeoutRef.current) {
                                          clearTimeout(hoverTimeoutRef.current)
                                          hoverTimeoutRef.current = null
                                        }
                                        const rect = e.currentTarget.getBoundingClientRect()
                                        setHoverPos({ x: rect.right + 10, y: rect.top })
                                        setHoveredTask({ ...meta, id: b.task_id, title: name, status, blockStart: b.start_at, blockEnd: b.end_at })
                                        setCardMenuOpen(false)
                                      }
                                    }}
                                    onMouseLeave={() => {
                                      hoverTimeoutRef.current = setTimeout(() => {
                                        setHoveredTask(null)
                                        setHoverPos(null)
                                        setCardMenuOpen(false)
                                      }, 300)
                                    }}
                                  >
                                    <div
                                      className={`h-full px-2.5 py-2 flex flex-col relative ${isLong ? 'justify-center' : 'justify-between'
                                        }`}
                                    >
                                      {isCur && (
                                        <div
                                          className="absolute inset-x-0 rounded-lg bg-amber-500/20 pointer-events-none"
                                          style={{ top: barTopPx, bottom: barBottomPx }}
                                        />
                                      )}
                                      <div className="flex h-full items-center gap-2.5 relative z-10">
                                        <div className="w-1.5 h-full relative">
                                          <div
                                            className="absolute left-0 right-0 rounded-full"
                                            style={{
                                              top: barTopPx,
                                              bottom: barBottomPx,
                                              backgroundColor: barColor,
                                            }}
                                          ></div>
                                        </div>
                                        <div className="flex items-center justify-between w-full text-sm">
                                          <div className="flex flex-col flex-1 min-w-0">
                                            <div className="flex items-center gap-1">
                                              {status === 'done' && (
                                                <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[0.65rem] font-medium text-emerald-300">
                                                  完成
                                                </span>
                                              )}
                                              <p
                                                className={`font-medium truncate ${status === 'done'
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
                                            className={`flex items-center text-white/80 gap-2 text-xs ml-3 ${status === 'done' ? 'opacity-60' : ''
                                              }`}
                                          >
                                            {isCur && (
                                              <button
                                                className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-400"
                                                onClick={() => {
                                                  const title = name || '当前时间段任务'
                                                  if (!setCenterAlert) return
                                                  setCenterAlert({
                                                    title: '专注模式',
                                                    detail: `请专注完成：${title}`,
                                                  })
                                                }}
                                              >
                                                <span className="material-symbols-outlined text-sm">
                                                  center_focus_strong
                                                </span>
                                                <span>专注</span>
                                              </button>
                                            )}
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
                                                  <div
                                                    className={`absolute right-0 w-28 rounded-md bg-slate-900 border border-slate-700 shadow-lg z-[9999] pointer-events-auto ${menuPositionClass}`}
                                                  >
                                                    <button
                                                      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800 cursor-pointer"
                                                      onClick={() => {
                                                        if (!taskIdStr) return
                                                        if (!tasks) return
                                                        const candidates: Task[] = []
                                                          ; (tasks.today || []).forEach((x: Task) =>
                                                            candidates.push(x),
                                                          )
                                                          ; (tasks.overdue || []).forEach((x: Task) =>
                                                            candidates.push(x),
                                                          )
                                                          ; (unscheduled || []).forEach((x: Task) =>
                                                            candidates.push(x),
                                                          )
                                                          ; (rangeTasks || []).forEach((x: Task) =>
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
                                                      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800 cursor-pointer"
                                                      onClick={async () => {
                                                        if (!taskIdStr || !completeTask) return
                                                        setListMenuOpenId && setListMenuOpenId(null)
                                                        await completeTask(taskIdStr)
                                                      }}
                                                    >
                                                      完成
                                                    </button>
                                                    <button
                                                      className="block w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-slate-800 cursor-pointer"
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
                              })
                            })()}
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

      {/* Hover Detail Card */}
      {hoveredTask && hoverPos && (
        <div
          className="fixed z-50 w-80 p-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-visible"
          style={{
            top: Math.min(hoverPos.y, window.innerHeight - 200), // Prevent going off bottom
            left: Math.min(hoverPos.x, window.innerWidth - 340), // Prevent going off right
          }}
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current)
              hoverTimeoutRef.current = null
            }
          }}
          onMouseLeave={() => {
            hoverTimeoutRef.current = setTimeout(() => {
              setHoveredTask(null)
              setHoverPos(null)
              setCardMenuOpen(false)
            }, 300)
          }}
        >
          <div className="bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: (hoveredTask.color || '#4B5563') + '80' }}></div>
              <div className="flex-1 space-y-1.5">
                <p className="text-white text-sm font-medium leading-tight">{hoveredTask.title}</p>
                {hoveredTask.blockStart && hoveredTask.blockEnd && (
                  <p className="text-xs text-white/60 font-mono">
                    {new Date(hoveredTask.blockStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(hoveredTask.blockEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-white/80">
                  {hoveredTask.type && (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hoveredTask.color || '#9CA3AF' }}></span>
                      <span>{hoveredTask.type}</span>
                    </span>
                  )}
                  {typeof hoveredTask.priority === 'number' && (
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium ${hoveredTask.priority === 2
                        ? 'bg-red-500/20 text-red-300'
                        : hoveredTask.priority === 1
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : 'bg-green-500/20 text-green-300'
                        }`}
                    >
                      {hoveredTask.priority === 2 ? '高' : hoveredTask.priority === 1 ? '中' : '低'}
                    </span>
                  )}
                  {(hoveredTask.tags || []).map((g: string) => (
                    <span key={g} className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300">#{g}</span>
                  ))}
                  {hoveredTask.status === 'done' && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">已完成</span>
                  )}
                </div>
              </div>
              <div className="relative">
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCardMenuOpen(!cardMenuOpen)
                  }}
                >
                  <span className="material-symbols-outlined text-lg">more_vert</span>
                </button>
                {cardMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 w-28 rounded-md bg-slate-900 border border-slate-700 shadow-lg z-50"
                  >
                    <button
                      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800 text-white"
                      onClick={() => {
                        if (setEditTask) setEditTask(hoveredTask)
                        setCardMenuOpen(false)
                        setHoveredTask(null)
                      }}
                    >
                      修改
                    </button>
                    <button
                      className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800 text-white"
                      onClick={async () => {
                        if (completeTask && hoveredTask.id) await completeTask(String(hoveredTask.id))
                        setCardMenuOpen(false)
                        setHoveredTask(null)
                      }}
                    >
                      完成
                    </button>
                    <button
                      className="block w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-slate-800"
                      onClick={async () => {
                        if (deleteTask && hoveredTask.id) await deleteTask(String(hoveredTask.id))
                        setCardMenuOpen(false)
                        setHoveredTask(null)
                      }}
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* Extra details not in list view but useful for hover */}
            {(hoveredTask.estimate_min || hoveredTask.due_at) && (
              <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-4 text-[10px] text-slate-400">
                {hoveredTask.estimate_min && (
                  <span>预估: {hoveredTask.estimate_min} 分钟</span>
                )}
                {hoveredTask.due_at && (
                  <span>截止: {new Date(hoveredTask.due_at).toLocaleString()}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
