import { useState, useRef } from 'react'
import { AddBlock } from './AddBlock'
import { PlannerListView } from './PlannerListView'
import type { Task } from '../../types'
import { TaskTypeSelector } from './TaskTypeSelector'
import { TaskTagSelector } from './TaskTagSelector'
import { TaskPrioritySelector } from './TaskPrioritySelector'
import { TaskHoverCard } from './TaskHoverCard'
import { MultiSelect } from '../ui/MultiSelect'

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
    updateBlock,
    deleteBlock,
    setListFilterType,
    setListFilterPriority,
    setListFilterTag,
    setListFilterOverdue,
    setListFilterDone,
    toggleHourCollapsed,
    expandHours, // Added for auto-expand during drag
    setListMenuOpenId,

    setCenterAlert,
    createTaskAdvanced,
    updateTaskAdvanced,
  } = actions || {}

  const [editingCell, setEditingCell] = useState<{ id: string, field: string, value: any } | null>(null)

  // Drag-to-resize state
  const SNAP_MINUTES = 5
  const [dragging, setDragging] = useState<{
    blockId: string
    edge: 'top' | 'bottom' | 'move'
    startY: number
    originalStart: Date
    originalEnd: Date
  } | null>(null)
  const [dragPreview, setDragPreview] = useState<{ start: Date, end: Date } | null>(null)

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent, blockId: string, edge: 'top' | 'bottom' | 'move', block: any) => {
    e.preventDefault()
    e.stopPropagation()
    const originalStart = new Date(block.start_at)
    const originalEnd = new Date(block.end_at)
    setDragging({
      blockId,
      edge,
      startY: e.clientY,
      originalStart,
      originalEnd,
    })
    setDragPreview({ start: originalStart, end: originalEnd })
  }

  // Check for conflicts with other blocks
  const checkConflicts = (blockId: string, start: Date, end: Date): string[] => {
    if (!filteredBlocks) return []
    const conflicts: string[] = []
    for (const block of filteredBlocks) {
      if (String(block.id) === blockId) continue // Skip self
      const blockStart = new Date(block.start_at).getTime()
      const blockEnd = new Date(block.end_at).getTime()
      const newStart = start.getTime()
      const newEnd = end.getTime()
      // Check overlap: two ranges overlap if one starts before the other ends
      if (newStart < blockEnd && newEnd > blockStart) {
        conflicts.push(String(block.id))
      }
    }
    return conflicts
  }

  const [dragConflicts, setDragConflicts] = useState<string[]>([])

  const handleDragMove = (e: React.MouseEvent) => {
    if (!dragging || !pxPerMin) return
    const deltaY = e.clientY - dragging.startY
    const deltaMinutes = deltaY / pxPerMin
    const snappedDelta = Math.round(deltaMinutes / SNAP_MINUTES) * SNAP_MINUTES

    let newStart = new Date(dragging.originalStart)
    let newEnd = new Date(dragging.originalEnd)

    if (dragging.edge === 'top') {
      newStart = new Date(dragging.originalStart.getTime() + snappedDelta * 60000)
      // Prevent start from going past end - minimum 5 min block
      if (newStart.getTime() >= newEnd.getTime() - 5 * 60000) {
        newStart = new Date(newEnd.getTime() - 5 * 60000)
      }
    } else if (dragging.edge === 'bottom') {
      newEnd = new Date(dragging.originalEnd.getTime() + snappedDelta * 60000)
      // Prevent end from going before start - minimum 5 min block
      if (newEnd.getTime() <= newStart.getTime() + 5 * 60000) {
        newEnd = new Date(newStart.getTime() + 5 * 60000)
      }
    } else if (dragging.edge === 'move') {
      // Move entire block - keep duration constant
      newStart = new Date(dragging.originalStart.getTime() + snappedDelta * 60000)
      newEnd = new Date(dragging.originalEnd.getTime() + snappedDelta * 60000)
    }

    setDragPreview({ start: newStart, end: newEnd })
    // Check for conflicts
    const conflicts = checkConflicts(dragging.blockId, newStart, newEnd)
    setDragConflicts(conflicts)
  }

  const handleDragEnd = () => {
    if (!dragging || !dragPreview || !updateBlock) {
      setDragging(null)
      setDragPreview(null)
      setDragConflicts([])
      return
    }

    // If there are conflicts, show alert and don't save
    if (dragConflicts.length > 0) {
      setCenterAlert && setCenterAlert('时间冲突！无法移动到该时间段')
      setDragging(null)
      setDragPreview(null)
      setDragConflicts([])
      return
    }

    // Only update if time actually changed
    if (
      dragPreview.start.getTime() !== dragging.originalStart.getTime() ||
      dragPreview.end.getTime() !== dragging.originalEnd.getTime()
    ) {
      updateBlock(dragging.blockId, {
        start_at: dragPreview.start.toISOString(),
        end_at: dragPreview.end.toISOString(),
      })
    }

    setDragging(null)
    setDragPreview(null)
    setDragConflicts([])
  }

  // External drag from task pool
  const [dropHoverHour, setDropHoverHour] = useState<number | null>(null)
  const [dropHoverMinute, setDropHoverMinute] = useState<number>(0)

  const handleExternalDragOver = (e: React.DragEvent, hour: number, containerRect: DOMRect) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropHoverHour(hour)
    // Calculate minute from mouse Y position within hour row
    const relativeY = e.clientY - containerRect.top
    const minute = Math.round((relativeY / HOUR_PX) * 60 / SNAP_MINUTES) * SNAP_MINUTES
    setDropHoverMinute(Math.min(55, Math.max(0, minute)))
  }

  const handleExternalDragLeave = () => {
    setDropHoverHour(null)
  }

  const handleExternalDrop = async (e: React.DragEvent, hour: number, containerRect: DOMRect) => {
    e.preventDefault()
    setDropHoverHour(null)

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (data.type !== 'pool-task') return

      // Calculate drop time
      const relativeY = e.clientY - containerRect.top
      const minute = Math.round((relativeY / HOUR_PX) * 60 / SNAP_MINUTES) * SNAP_MINUTES
      const clampedMinute = Math.min(55, Math.max(0, minute))

      // Create start and end time based on today's date with the dropped hour/minute
      // Use explicit date construction to avoid timezone issues
      const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, clampedMinute, 0, 0)

      const estimateMin = data.estimateMin || 30
      const endTime = new Date(startTime.getTime() + estimateMin * 60000)

      // Update the task with scheduled time
      // Server expects due_at (end time) and estimate_min to create time_block
      if (updateTaskAdvanced) {
        const isPinned = data.recurrenceRule?.includes('PINNED')

        if (isPinned) {
          // For pinned pool tasks: just create a time block without changing the task
          // Use addBlock to create the time block directly
          if (addBlock) {
            const startStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`
            const endStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`
            const dateStr = now.toISOString().split('T')[0] // Get YYYY-MM-DD from now
            await addBlock(startStr, endStr, data.taskId, dateStr)
          }
        } else {
          // For non-pinned pool tasks: update task to remove from pool and schedule it
          await updateTaskAdvanced(data.taskId, {
            title: data.taskTitle, // Required field
            due_at: endTime.toISOString(), // Server uses this as end time
            estimate_min: estimateMin, // Duration in minutes
            recurrence_rule: '', // Clear POOL flag (empty string, not null)
          })
        }

        // Refresh data
        fetchUnscheduled && fetchUnscheduled()
      }
    } catch (err) {
      console.error('Drop error:', err)
    }
  }

  const [hoveredTask, setHoveredTask] = useState<any>(null)
  const [hoverPosition, setHoverPosition] = useState<{ x: number, y: number } | null>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleBlockMouseEnter = (e: React.MouseEvent, b: any, meta: any, title: any) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    const rect = e.currentTarget.getBoundingClientRect()
    // Position to the right of the block
    setHoverPosition({ x: rect.right + 10, y: rect.top })

    // Construct task data for the card
    const taskData = {
      ...b,
      title: title || '时间块',
      ...meta,
      blockId: String(b.id),
      blockStart: b.start_at,
      blockEnd: b.end_at,
      id: b.task_id || b.id // Ensure we have an ID
    }
    setHoveredTask(taskData)
  }

  const handleBlockMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredTask(null)
      setHoverPosition(null)
    }, 200) // 200ms delay to allow moving to the card
  }

  const handleSave = (id: string, field: string, value: any, extras?: any) => {
    setEditingCell(null)
    const block = (filteredBlocks || []).find((b: any) => String(b.id) === id)
    if (!block) return

    if (field === 'title') {
      if (block.task_id && updateTaskAdvanced) {
        updateTaskAdvanced(block.task_id, { title: value })
      }
    } else if (field === 'time') {
      if (updateBlock) {
        const { startStr, endStr, originalStart, originalEnd } = value

        const parseTime = (date: Date, timeStr: string) => {
          const [h, m] = timeStr.split(':').map(Number)
          const newDate = new Date(date)
          newDate.setHours(h)
          newDate.setMinutes(m)
          return newDate
        }

        const newStart = parseTime(originalStart, startStr)
        const newEnd = parseTime(originalEnd, endStr)

        if (newEnd.getTime() <= newStart.getTime()) {
          alert('结束时间必须晚于开始时间')
          return
        }

        updateBlock(id, {
          start_at: newStart.toISOString(),
          end_at: newEnd.toISOString()
        })
      }
    } else if (field === 'duration') {
      if (updateBlock) {
        const { start, currentDurationMin, newDurationMin } = value

        // Optimistic update
        const newEnd = new Date(start.getTime() + newDurationMin * 60000)
        updateBlock(id, {
          start_at: start.toISOString(),
          end_at: newEnd.toISOString()
        })
      }
    } else { // This 'else' block now handles priority, type, and tags
      if (block.task_id && updateTaskMeta) {
        const updates: any = {}
        if (field === 'priority') updates.priority = value
        if (field === 'type') {
          updates.type = value
          if (extras?.color) updates.color = extras.color
        }
        if (field === 'tags') updates.tags = value
        updateTaskMeta(block.task_id, updates)
      }
    }
  }

  const handleCopyToPool = async (task: any) => {
    if (!createTaskAdvanced || !task) return
    const payload = {
      title: task.title,
      type: task.type,
      color: task.color,
      priority: task.priority,
      tags: task.tags,
      recurrence_rule: 'POOL',
      estimate_min: task.estimate_min,
      // No due_at for pool tasks
    }
    await createTaskAdvanced(payload)
  }

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
      if (listFilterTag && listFilterTag.length > 0 && !listFilterTag.includes('all')) {
        const tags = meta.tags || []
        if (!listFilterTag.some((t: string) => tags.includes(t))) return false
      }
    }

    return true
  })



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
      <div className="md:col-span-3 lg:col-span-4 relative">
        {/* Filter Toggle Button */}
        <div className="absolute -top-[3.25rem] right-0 z-10">
          <button
            onClick={() => actions.setShowFilters && actions.setShowFilters(!state.showFilters)}
            className="p-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700 text-white/70 hover:text-white transition-colors border border-white/10"
            title={state.showFilters ? "隐藏筛选" : "显示筛选"}
          >
            <span className="material-symbols-outlined text-sm">
              {state.showFilters ? 'filter_alt_off' : 'filter_alt'}
            </span>
          </button>
        </div>

        <section className="rounded-xl border border-white/10 bg-slate-800/50">
          {state.showFilters && (
            <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-sm p-3 border-b border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-3 text-white/90 text-sm">

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70">类型</span>
                    <select
                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                      value={listFilterType}
                      onChange={(e) => setListFilterType && setListFilterType(e.target.value)}
                    >
                      <option value="all" className="bg-slate-800 text-white">
                        所有
                      </option>
                      {(listTypeOptions || []).map((name: string) => (
                        <option key={name} value={name} className="bg-slate-800 text-white">
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70">优先</span>
                    <select
                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                      value={listFilterPriority}
                      onChange={(e) => setListFilterPriority && setListFilterPriority(e.target.value as any)}
                    >
                      <option value="all" className="bg-slate-800 text-white">
                        所有
                      </option>
                      <option value="2" className="bg-slate-800 text-white">
                        高
                      </option>
                      <option value="1" className="bg-slate-800 text-white">
                        中
                      </option>
                      <option value="0" className="bg-slate-800 text-white">
                        低
                      </option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <MultiSelect
                      label="标签"
                      options={listTagOptions || []}
                      value={listFilterTag || []}
                      onChange={(tags) => setListFilterTag && setListFilterTag(tags)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70">逾期</span>
                    <select
                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                      value={listFilterOverdue}
                      onChange={(e) => setListFilterOverdue && setListFilterOverdue(e.target.value as any)}
                    >
                      <option value="all" className="bg-slate-800 text-white">
                        所有
                      </option>
                      <option value="yes" className="bg-slate-800 text-white">
                        是
                      </option>
                      <option value="no" className="bg-slate-800 text-white">
                        否
                      </option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70">完成</span>
                    <select
                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                      value={listFilterDone}
                      onChange={(e) => setListFilterDone && setListFilterDone(e.target.value as any)}
                    >
                      <option value="all" className="bg-slate-800 text-white">
                        所有
                      </option>
                      <option value="done" className="bg-slate-800 text-white">
                        已完成
                      </option>
                      <option value="open" className="bg-slate-800 text-white">
                        未完成
                      </option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70">冲突</span>
                    <select
                      className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                      value={state.listFilterConflict || 'all'}
                      onChange={(e) => actions.setListFilterConflict && actions.setListFilterConflict(e.target.value)}
                    >
                      <option value="all" className="bg-slate-800 text-white">所有</option>
                      <option value="conflicts" className="bg-slate-800 text-white">仅冲突</option>
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
          )}

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

                      // Check if drag border aligns with this hour line
                      const dragAlignedWithThisHour = dragging && dragPreview && (
                        (dragPreview.start.getMinutes() === 0 && dragPreview.start.getHours() === h) ||
                        (dragPreview.end.getMinutes() === 0 && dragPreview.end.getHours() === h)
                      )

                      return (
                        <div
                          key={`hour-${h}`}
                          className={`relative border-t flex items-center justify-center text-xs ${dragAlignedWithThisHour ? 'border-orange-400 border-t-2 text-orange-400 font-bold' : 'border-white/10 text-gray-400'}`}
                          style={{ height: localRowHeight }}
                        >
                          <span>{String(h).padStart(2, '0')}:00</span>
                        </div>
                      )
                    })}
                  </div>
                  <div
                    className="relative pb-12"
                    onMouseMove={handleDragMove}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                    style={{ cursor: dragging ? (dragging.edge === 'top' ? 'n-resize' : dragging.edge === 'bottom' ? 's-resize' : 'grabbing') : undefined }}
                  >

                    {hourRows.map((row, rowIndex) => {
                      if (row.kind === 'collapsed') {
                        const start = row.start
                        const end = row.end
                        const startLabel = `${String(start).padStart(2, '0')}:00`
                        const endLabel = `${String(end).padStart(2, '0')}:00`
                        return (
                          <div
                            key={`collapsed-body-${start}-${end}`}
                            className="h-8 border-t border-white/10 flex items-center justify-center transition-colors hover:bg-white/5"
                            onDragEnter={(e) => {
                              // For external drag (task pool)
                              e.preventDefault()
                              e.stopPropagation() // Prevent bubbling
                              if (expandHours) {
                                const hoursToExpand: number[] = []
                                for (let h = start; h < end; h++) hoursToExpand.push(h)
                                expandHours(hoursToExpand)
                              }
                            }}
                            onMouseEnter={() => {
                              // For internal drag (resizing/moving blocks)
                              if (dragging && expandHours) {
                                const hoursToExpand: number[] = []
                                for (let h = start; h < end; h++) hoursToExpand.push(h)
                                expandHours(hoursToExpand)
                              }
                            }}
                          >
                            <span className="text-xs text-gray-500 pointer-events-none">
                              {startLabel}-{endLabel} 已折叠 (拖动展开)
                            </span>
                          </div>
                        )
                      }

                      const { h, hourStart, hourEnd, hourBlocks, shortCount, isCurrentHour } =
                        row.info as any

                      const rowFactor = Math.max(1, shortCount || 0)
                      const localRowHeight = hourHeight * rowFactor

                      // Check if drag border aligns with this hour line
                      const dragAlignedWithThisHour = dragging && dragPreview && (
                        (dragPreview.start.getMinutes() === 0 && dragPreview.start.getHours() === h) ||
                        (dragPreview.end.getMinutes() === 0 && dragPreview.end.getHours() === h)
                      )

                      return (
                        <div
                          key={`hour-body-${h}`}
                          className={`relative border-t bg-slate-900 ${dragAlignedWithThisHour ? 'border-orange-400 border-t-2' : dropHoverHour === h ? 'border-blue-400 border-t-2 bg-blue-900/20' : 'border-white/10'}`}
                          style={{ height: localRowHeight }}
                          onDragOver={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            handleExternalDragOver(e, h, rect)
                          }}
                          onDragLeave={handleExternalDragLeave}
                          onDrop={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            handleExternalDrop(e, h, rect)
                          }}
                        >
                          <div className="absolute inset-0 pointer-events-none grid grid-rows-[repeat(2,1fr)]">
                            <div className="border-b border-dashed border-white/5" />
                            <div className="border-b border-white/10" />
                          </div>
                          {isCurrentHour && (
                            <div
                              className="absolute z-30 pointer-events-none"
                              style={{ top: now.getMinutes() * effectivePxPerMin, left: 7, transform: 'translateY(-50%)' }}
                            >
                              <div
                                className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-yellow-500"
                              />
                            </div>
                          )}
                          {/* Drop indicator */}
                          {dropHoverHour === h && (
                            <div
                              className="absolute left-0 right-0 h-0.5 bg-blue-400 z-40 pointer-events-none"
                              style={{ top: dropHoverMinute * pxPerMin }}
                            >
                              <span className="absolute -left-1 -top-3 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                                {String(h).padStart(2, '0')}:{String(dropHoverMinute).padStart(2, '0')}
                              </span>
                            </div>
                          )}
                          <div className="relative px-2 py-1 space-y-1">
                            {(() => {
                              // Sort blocks by start time to ensure correct order
                              const sortedBlocks = [...hourBlocks].sort((a: any, b: any) =>
                                new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
                              )

                              // Pre-calculate positions for all blocks to avoid overlap
                              const blockPositions = new Map<string, { top: number, height: number }>()
                              let cumulativeTop = 0
                              const minBlockHeight = 48 // Minimum height for readability

                              sortedBlocks.forEach((b: any) => {
                                const s = new Date(b.start_at)
                                const e = new Date(b.end_at)
                                const startMin = s.getHours() * 60 + s.getMinutes()
                                const endMin = e.getHours() * 60 + e.getMinutes()
                                const duration = Math.max(1, endMin - startMin)

                                // Calculate natural height based on duration
                                const naturalHeight = Math.max(minBlockHeight, (duration / 60) * hourHeight)

                                blockPositions.set(String(b.id), { top: cumulativeTop, height: naturalHeight })
                                cumulativeTop += naturalHeight + 4 // 4px gap between blocks
                              })

                              return sortedBlocks.map((b: any) => {
                                const s = new Date(b.start_at)
                                const e = new Date(b.end_at)
                                const startMin = s.getHours() * 60 + s.getMinutes()
                                const endMin = e.getHours() * 60 + e.getMinutes()

                                const clampedStart = Math.max(0, startMin)
                                const clampedEnd = Math.min(24 * 60, endMin)
                                if (clampedEnd <= clampedStart) return null

                                // Check if this block starts in this hour
                                const startBlock = Math.floor(clampedStart / 60)
                                if (h !== startBlock) return null

                                const position = blockPositions.get(String(b.id))!
                                let top = position.top
                                let height = position.height

                                const duration = clampedEnd - clampedStart
                                const isLong = duration > 60 || endMin > hourEnd
                                let cardStartMin = startMin

                                // Calculate bar height proportionally
                                // Bar should represent (duration / 60) of the reference hourHeight
                                const durationMinutes = Math.max(1, endMin - startMin)
                                const referenceHeight = hourHeight // 1-hour reference
                                const barHeightPx = (durationMinutes / 60) * referenceHeight
                                const cardHeightPx = height - 4 // Subtracting gaps
                                // The bar fills from top, percentage from bottom = (cardHeight - barHeight) / cardHeight * 100
                                const fillRatio = Math.min(1, barHeightPx / Math.max(1, cardHeightPx))
                                const topPercent = 0 // Bar starts at top
                                const bottomPercent = Math.max(0, (1 - fillRatio) * 100)

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
                                  prio === 2 ? 'H' : prio === 1 ? 'M' : prio === 0 ? 'L' : null
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
                                const menuPositionClass = h > 18 ? 'bottom-full mb-1' : 'top-full mt-1'
                                const isConflicting = dragConflicts.includes(blockId)
                                const isDraggingThis = dragging?.blockId === blockId
                                const hasConflict = isDraggingThis && dragConflicts.length > 0

                                return (
                                  <div
                                    key={String(b.id)}
                                    className={`absolute left-1 right-1 rounded-xl border text-xs text-white/90 flex flex-col gap-1 bg-slate-800/90 shadow-sm transition-colors hover:bg-slate-800 hover:ring-1 hover:ring-blue-400/50 ${isMenuOpen ? 'z-40 ring-1 ring-[#137fec]/50' : 'z-10'} group ${isConflicting ? 'border-red-500 ring-2 ring-red-500/50 bg-red-900/30' : hasConflict ? 'border-red-500 ring-2 ring-red-500/50' : isDraggingThis ? 'border-blue-400 ring-2 ring-blue-400/50' : 'border-white/5'}`}
                                    style={{
                                      top: isDraggingThis && dragPreview ?
                                        // During drag: minute within hour plus time delta, minus container padding (4px from py-1)
                                        // This ensures 0 min aligns with hour line at top of row
                                        (new Date(b.start_at).getMinutes() + (dragPreview.start.getTime() - new Date(b.start_at).getTime()) / 60000) * pxPerMin - 4 :
                                        top,
                                      height: isDraggingThis && dragPreview ?
                                        ((dragPreview.end.getTime() - dragPreview.start.getTime()) / 60000) * pxPerMin :
                                        Math.max(height - 4, 32),
                                    }}
                                    onMouseEnter={(e) => handleBlockMouseEnter(e, b, meta, name)}
                                    onMouseLeave={handleBlockMouseLeave}
                                  >
                                    {/* Conflict overlay */}
                                    {isConflicting && (
                                      <div className="absolute inset-0 rounded-xl bg-red-500/20 pointer-events-none z-30 flex items-center justify-center">
                                        <span className="text-red-300 text-xs font-medium">冲突</span>
                                      </div>
                                    )}
                                    {/* Conflict warning on dragged block */}
                                    {hasConflict && (
                                      <div className="absolute -top-6 left-0 right-0 text-center z-50">
                                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded">时间冲突!</span>
                                      </div>
                                    )}
                                    {/* Real-time time display during drag */}
                                    {isDraggingThis && dragPreview && (
                                      <div className="absolute -bottom-6 left-0 right-0 text-center z-50">
                                        <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded font-mono">
                                          {String(dragPreview.start.getHours()).padStart(2, '0')}:{String(dragPreview.start.getMinutes()).padStart(2, '0')}
                                          {' - '}
                                          {String(dragPreview.end.getHours()).padStart(2, '0')}:{String(dragPreview.end.getMinutes()).padStart(2, '0')}
                                        </span>
                                      </div>
                                    )}
                                    {/* Top drag handle */}
                                    <div
                                      className={`absolute top-0 left-0 right-0 h-1 cursor-n-resize rounded-t-xl transition-opacity z-20 ${isDraggingThis && dragging?.edge === 'top'
                                        ? 'opacity-100 bg-blue-500/60'
                                        : 'opacity-0 group-hover:opacity-100 hover:bg-blue-500/30'
                                        }`}
                                      onMouseDown={(e) => handleDragStart(e, blockId, 'top', b)}
                                    />
                                    {/* Bottom drag handle */}
                                    <div
                                      className={`absolute bottom-0 left-0 right-0 h-1 cursor-s-resize rounded-b-xl transition-opacity z-20 ${isDraggingThis && dragging?.edge === 'bottom'
                                        ? 'opacity-100 bg-blue-500/60'
                                        : 'opacity-0 group-hover:opacity-100 hover:bg-blue-500/30'
                                        }`}
                                      onMouseDown={(e) => handleDragStart(e, blockId, 'bottom', b)}
                                    />
                                    {/* Grip Handle - Left Side */}
                                    <div
                                      className="absolute left-0 top-0 bottom-0 w-3 cursor-grab active:cursor-grabbing flex items-center justify-center hover:bg-black/10 transition-colors z-20 rounded-l-xl"
                                      onMouseDown={(e) => handleDragStart(e, blockId, 'move', b)}
                                    >
                                      {/* Grip Dots */}
                                      {/* Grip Dots 2x3 */}
                                      <div className="grid grid-cols-2 gap-0.5 opacity-40">
                                        <div className="w-0.5 h-0.5 rounded-full bg-white"></div>
                                        <div className="w-0.5 h-0.5 rounded-full bg-white"></div>
                                        <div className="w-0.5 h-0.5 rounded-full bg-white"></div>
                                        <div className="w-0.5 h-0.5 rounded-full bg-white"></div>
                                        <div className="w-0.5 h-0.5 rounded-full bg-white"></div>
                                        <div className="w-0.5 h-0.5 rounded-full bg-white"></div>
                                      </div>
                                    </div>
                                    <div
                                      className={`h-full pl-4 pr-2.5 py-2 flex flex-col relative ${isLong ? 'justify-center' : 'justify-between'}`}

                                    >
                                      {isCur && (
                                        <div
                                          className="absolute inset-0 rounded-xl bg-amber-500/10 pointer-events-none border border-amber-500/30"
                                        />
                                      )}
                                      <div className="flex h-full items-center gap-3 relative z-10">
                                        <div className="w-1.5 h-full relative rounded-full overflow-hidden opacity-80">
                                          <div
                                            className="absolute left-0 right-0"
                                            style={{
                                              top: `${topPercent}%`,
                                              bottom: `${bottomPercent}%`,
                                              backgroundColor: barColor,
                                            }}
                                          ></div>
                                        </div>
                                        <div className="flex items-center justify-between w-full text-sm">
                                          <div className="flex flex-col flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              {status === 'done' && (
                                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20" title="已完成">
                                                  <span className="material-symbols-outlined text-emerald-400 text-sm">check</span>
                                                </span>
                                              )}
                                              {editingCell?.id === blockId && editingCell.field === 'title' ? (
                                                <input
                                                  autoFocus
                                                  className="bg-slate-700 text-white text-sm px-1 py-0.5 rounded w-full"
                                                  value={editingCell.value}
                                                  onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                                                  onBlur={() => handleSave(blockId, 'title', editingCell.value)}
                                                  onKeyDown={e => {
                                                    if (e.key === 'Enter') handleSave(blockId, 'title', editingCell.value)
                                                    if (e.key === 'Escape') setEditingCell(null)
                                                  }}
                                                  onClick={e => e.stopPropagation()}
                                                />
                                              ) : (
                                                <p
                                                  className={`font-medium truncate cursor-pointer hover:underline decoration-dashed decoration-slate-500 ${status === 'done'
                                                    ? 'line-through opacity-60'
                                                    : ''
                                                    }`}
                                                  onDoubleClick={(e) => {
                                                    e.stopPropagation()
                                                    setEditingCell({ id: blockId, field: 'title', value: name || '' })
                                                  }}
                                                >
                                                  {name || '时间块'}
                                                </p>
                                              )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-white/80">
                                              {/* Priority Label */}
                                              {editingCell?.id === blockId && editingCell.field === 'priority' ? (
                                                <div className="relative">
                                                  <span
                                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium cursor-pointer hover:opacity-80 ${prioClass}`}
                                                    onClick={e => e.stopPropagation()}
                                                  >
                                                    {prioLabel || '无'}
                                                  </span>
                                                  <TaskPrioritySelector
                                                    currentPriority={editingCell.value}
                                                    onSelect={(val) => {
                                                      handleSave(blockId, 'priority', val)
                                                      setEditingCell(null)
                                                    }}
                                                    onClose={() => setEditingCell(null)}
                                                  />
                                                </div>
                                              ) : (
                                                prioLabel && (
                                                  <span
                                                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium cursor-pointer hover:opacity-80 ${prioClass}`}
                                                    onDoubleClick={(e) => {
                                                      e.stopPropagation()
                                                      setEditingCell({ id: blockId, field: 'priority', value: prio })
                                                    }}
                                                  >
                                                    {prioLabel}
                                                  </span>
                                                )
                                              )}
                                              {/* Type */}
                                              {editingCell?.id === blockId && editingCell.field === 'type' ? (
                                                <div className="relative">
                                                  <span
                                                    className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1 cursor-pointer hover:bg-slate-600"
                                                    onClick={e => e.stopPropagation()}
                                                  >
                                                    <span
                                                      className="w-2 h-2 rounded-full"
                                                      style={{ backgroundColor: typeDotColor }}
                                                    ></span>
                                                    <span>{editingCell.value || '无类型'}</span>
                                                  </span>
                                                  <TaskTypeSelector
                                                    currentType={editingCell.value}
                                                    authHeaders={actions.headers()}
                                                    onSelect={(t) => {
                                                      handleSave(blockId, 'type', t.name, { color: t.color })
                                                      setEditingCell(null)
                                                    }}
                                                    onClose={() => setEditingCell(null)}
                                                  />
                                                  {/* Overlay to close on click outside */}
                                                  <div
                                                    className="fixed inset-0 z-40"
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      setEditingCell(null)
                                                    }}
                                                  />
                                                </div>
                                              ) : (
                                                type && (
                                                  <span
                                                    className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1 cursor-pointer hover:bg-slate-600"
                                                    onDoubleClick={(e) => {
                                                      e.stopPropagation()
                                                      setEditingCell({ id: blockId, field: 'type', value: type })
                                                    }}
                                                  >
                                                    <span
                                                      className="w-2 h-2 rounded-full"
                                                      style={{ backgroundColor: typeDotColor }}
                                                    ></span>
                                                    <span>{type}</span>
                                                  </span>
                                                )
                                              )}

                                              {editingCell?.id === blockId && editingCell.field === 'tags' ? (
                                                <div className="relative">
                                                  <div className="flex flex-wrap gap-1">
                                                    {(editingCell.value as string[]).map((g: string) => (
                                                      <span key={g} className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300">
                                                        #{g}
                                                      </span>
                                                    ))}
                                                    {(editingCell.value as string[]).length === 0 && (
                                                      <span className="text-gray-500 text-[10px]">#</span>
                                                    )}
                                                  </div>
                                                  <TaskTagSelector
                                                    currentTags={editingCell.value as string[]}
                                                    availableTags={listTagOptions || []}
                                                    onSelect={(tags) => {
                                                      setEditingCell({ ...editingCell, value: tags })
                                                      handleSave(blockId, 'tags', tags)
                                                    }}
                                                    onClose={() => setEditingCell(null)}
                                                    authHeaders={actions.headers ? actions.headers() : {}}
                                                  />
                                                </div>
                                              ) : (
                                                (tags && tags.length > 0) ? (
                                                  tags.map((g: string) => (
                                                    <span
                                                      key={g}
                                                      className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300 cursor-pointer hover:bg-gray-500/30"
                                                      onDoubleClick={(e) => {
                                                        e.stopPropagation()
                                                        setEditingCell({ id: blockId, field: 'tags', value: tags })
                                                      }}
                                                    >
                                                      #{g}
                                                    </span>
                                                  ))
                                                ) : (
                                                  <span
                                                    className="text-gray-500 text-[10px] cursor-pointer hover:underline decoration-dashed decoration-slate-600"
                                                    onDoubleClick={(e) => {
                                                      e.stopPropagation()
                                                      setEditingCell({ id: blockId, field: 'tags', value: [] })
                                                    }}
                                                  >
                                                    #
                                                  </span>
                                                )
                                              )}
                                            </div>
                                          </div>
                                          <div
                                            className={`flex items-center text-white/80 gap-2 text-xs ml-3 ${status === 'done' ? 'opacity-60' : ''
                                              }`}
                                          >
                                            {isCur && (
                                              <button
                                                className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-400"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  if (!taskIdStr) return
                                                  window.location.hash = `#/focus?taskId=${taskIdStr}`
                                                }}
                                              >
                                                <span className="material-symbols-outlined text-sm">
                                                  center_focus_strong
                                                </span>
                                                <span>专注</span>
                                              </button>
                                            )}
                                            {isOverdue && (
                                              <span className="inline-flex items-center justify-center w-6 h-6" title="逾期">
                                                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                                                  {/* Outer red ring */}
                                                  <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2" fill="none" strokeDasharray="50 10" />
                                                  {/* Inner clock circle */}
                                                  <circle cx="12" cy="12" r="7" stroke="#374151" strokeWidth="1.5" fill="none" />
                                                  {/* Clock tick marks */}
                                                  {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
                                                    <line
                                                      key={angle}
                                                      x1={12 + 5.5 * Math.cos((angle - 90) * Math.PI / 180)}
                                                      y1={12 + 5.5 * Math.sin((angle - 90) * Math.PI / 180)}
                                                      x2={12 + 6.5 * Math.cos((angle - 90) * Math.PI / 180)}
                                                      y2={12 + 6.5 * Math.sin((angle - 90) * Math.PI / 180)}
                                                      stroke="#374151"
                                                      strokeWidth="1"
                                                    />
                                                  ))}
                                                  {/* Exclamation mark */}
                                                  <rect x="11" y="7" width="2" height="6" rx="1" fill="#ef4444" />
                                                  <circle cx="12" cy="15.5" r="1" fill="#ef4444" />
                                                </svg>
                                              </span>
                                            )}
                                            {editingCell?.id === blockId && editingCell.field === 'time' ? (
                                              <div
                                                className="flex items-center gap-0.5 bg-slate-800 rounded px-0.5 time-edit-container"
                                                onClick={e => e.stopPropagation()}
                                                onBlur={(e) => {
                                                  const target = e.relatedTarget as HTMLElement | null
                                                  if (target && target.closest('.time-edit-container')) return
                                                  handleSave(blockId, 'time', editingCell.value)
                                                }}
                                              >
                                                <input
                                                  type="time"
                                                  className="bg-transparent text-white text-[10px] p-0 border-none focus:ring-0 w-[32px] h-4 leading-none [&::-webkit-calendar-picker-indicator]:hidden text-center"
                                                  value={editingCell.value.startStr}
                                                  onChange={e => setEditingCell({
                                                    ...editingCell,
                                                    value: { ...editingCell.value, startStr: e.target.value }
                                                  })}
                                                  onKeyDown={e => {
                                                    if (e.key === 'Enter') handleSave(blockId, 'time', editingCell.value)
                                                    if (e.key === 'Escape') setEditingCell(null)
                                                  }}
                                                />
                                                <span className="text-[10px]">-</span>
                                                <input
                                                  type="time"
                                                  className="bg-transparent text-white text-[10px] p-0 border-none focus:ring-0 w-[32px] h-4 leading-none [&::-webkit-calendar-picker-indicator]:hidden text-center"
                                                  value={editingCell.value.endStr}
                                                  onChange={e => setEditingCell({
                                                    ...editingCell,
                                                    value: { ...editingCell.value, endStr: e.target.value }
                                                  })}
                                                  onKeyDown={e => {
                                                    if (e.key === 'Enter') handleSave(blockId, 'time', editingCell.value)
                                                    if (e.key === 'Escape') setEditingCell(null)
                                                  }}
                                                />
                                              </div>
                                            ) : (
                                              <div className="flex flex-col items-center gap-1">
                                                <p
                                                  className="whitespace-nowrap cursor-pointer hover:underline decoration-dashed decoration-slate-500"
                                                  onDoubleClick={(ev) => {
                                                    ev.stopPropagation()
                                                    const fmt = (d: Date) => {
                                                      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                                                    }
                                                    setEditingCell({
                                                      id: blockId,
                                                      field: 'time',
                                                      value: {
                                                        startStr: fmt(s),
                                                        endStr: fmt(e),
                                                        originalStart: s,
                                                        originalEnd: e
                                                      }
                                                    })
                                                  }}
                                                >
                                                  {isDraggingThis && dragPreview ? (
                                                    <>
                                                      {String(dragPreview.start.getHours()).padStart(2, '0')}:{String(dragPreview.start.getMinutes()).padStart(2, '0')}
                                                      {' - '}
                                                      {String(dragPreview.end.getHours()).padStart(2, '0')}:{String(dragPreview.end.getMinutes()).padStart(2, '0')}
                                                    </>
                                                  ) : (
                                                    <>{fmtHHmm ? fmtHHmm(s) : ''} - {fmtHHmm ? fmtHHmm(e) : ''}</>
                                                  )}
                                                </p>
                                                {editingCell?.id === blockId && editingCell.field === 'duration' ? (
                                                  <div className="flex items-center justify-center">
                                                    <input
                                                      autoFocus
                                                      type="number"
                                                      className="bg-slate-700 text-white text-[10px] px-0.5 py-0 rounded w-[40px] text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border border-blue-500/50 focus:border-blue-500 focus:ring-0"
                                                      value={editingCell.value.newDurationMin}
                                                      onClick={e => e.stopPropagation()}
                                                      onChange={e => {
                                                        const val = parseInt(e.target.value) || 0
                                                        setEditingCell({
                                                          ...editingCell,
                                                          value: { ...editingCell.value, newDurationMin: val }
                                                        })
                                                      }}
                                                      onBlur={() => handleSave(blockId, 'duration', editingCell.value)}
                                                      onKeyDown={e => {
                                                        if (e.key === 'Enter') handleSave(blockId, 'duration', editingCell.value)
                                                        if (e.key === 'Escape') setEditingCell(null)
                                                      }}
                                                    />
                                                    <span className="text-[10px] text-slate-400 ml-0.5">min</span>
                                                  </div>
                                                ) : (
                                                  <p
                                                    className="text-slate-400 cursor-pointer hover:text-slate-300 hover:underline decoration-dashed decoration-slate-500"
                                                    onDoubleClick={(ev) => {
                                                      ev.stopPropagation()
                                                      const durationMin = Math.round((e.getTime() - s.getTime()) / 60000)
                                                      setEditingCell({
                                                        id: blockId,
                                                        field: 'duration',
                                                        value: {
                                                          start: s,
                                                          currentDurationMin: durationMin,
                                                          newDurationMin: durationMin
                                                        }
                                                      })
                                                    }}
                                                  >
                                                    {isDraggingThis && dragPreview
                                                      ? Math.round((dragPreview.end.getTime() - dragPreview.start.getTime()) / 60000)
                                                      : Math.round((e.getTime() - s.getTime()) / 60000)} min
                                                  </p>
                                                )}
                                              </div>
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
                                                        if (t) {
                                                          handleCopyToPool(t)
                                                        }
                                                        setListMenuOpenId && setListMenuOpenId(null)
                                                      }}
                                                    >
                                                      到任务池
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
                    })
                    }
                  </div>
                </div>
              </div>
            </div>
            {fetchState === 'error' && (
              <div className="text-sm text-rose-300 px-3">加载失败</div>
            )}
          </div>
        </section>
      </div >

      <div className="md:col-span-2 lg:col-span-2">
        <PlannerListView
          state={{ unscheduled, unschedMenuOpenId, listEdit, taskMetaMap, listTagOptions }}
          actions={{
            fetchUnscheduled,
            setUnschedMenuOpenId,
            setListEdit,
            setEditTask,
            setScheduleFor,
            deleteTask,
            setShowCreateTask,
            updateTaskMeta,
            updateTaskAdvanced,
            headers: actions.headers,
          }}
        />
      </div>

      {hoveredTask && hoverPosition && (
        <TaskHoverCard
          task={hoveredTask}
          position={hoverPosition}
          onClose={() => {
            setHoveredTask(null)
            setHoverPosition(null)
          }}
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current)
              hoverTimeoutRef.current = null
            }
          }}
          onMouseLeave={() => {
            setHoveredTask(null)
            setHoverPosition(null)
          }}
          actions={{
            updateTaskMeta,
            updateTaskAdvanced,
            updateBlock,
            deleteTask,
            completeTask,
            deleteBlock,
            setEditTask,
            createTaskAdvanced,
            setCenterAlert,
            headers: actions.headers,
          }}
          options={{
            listTypeOptions: listTypeOptions || [],
            listTagOptions: listTagOptions || [],
          }}
        />
      )}


    </div >
  )
}
