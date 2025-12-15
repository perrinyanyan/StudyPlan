import { useState, useRef, useMemo, useEffect } from 'react'
import { getConflictIds } from '../../utils/conflicts'
import { PlannerListView } from './PlannerListView'
import { TaskHoverCard } from './TaskHoverCard'
import type { Task } from '../../types'
import { toIso, todayStr, fmtRange } from '../../utils/datetime'
import { MultiSelect } from '../ui/MultiSelect'
import { TypeFilterDropdown } from '../ui/TypeFilterDropdown'

export interface PlannerWeekViewProps {
    state: any
    actions: any
}

export function PlannerWeekView({ state, actions }: PlannerWeekViewProps) {
    const {
        tasks,
        unscheduled,
        rangeBlocks: propsRangeBlocks, // Rename destructured prop
        rangeTasks, // This will hold the week's tasks
        now,
        currentBlock,
        taskTitleMap,
        taskStatusMap,
        taskMetaMap,
        listMenuOpenId,
        listFilterType,
        listFilterPriority,
        listFilterTag,
        listFilterOverdue,
        listFilterDone,
        listFilterConflict,
        listTypeOptions,
        listTagOptions,
        fmtHHmm,
        unschedMenuOpenId,
        date, // Current selected date
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
        addBlock,
        updateBlock,
        deleteBlock,
        setListFilterType,
        setListFilterPriority,
        setListFilterTag,
        setListFilterOverdue,
        setListFilterDone,
        setListFilterConflict,
        setListMenuOpenId,

        setCenterAlert,
        createTaskAdvanced,
        updateTaskAdvanced,
    } = actions || {}

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

    // Calculate week days
    const weekDays: Date[] = []
    if (date) {
        const d = new Date(date)
        const day = d.getDay() // 0 is Sunday
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
        const startOfWeek = new Date(d.setDate(diff))
        for (let i = 0; i < 7; i++) {
            const current = new Date(startOfWeek)
            current.setDate(startOfWeek.getDate() + i)
            weekDays.push(current)
        }
    }

    // Optimistic Blocks State (Declared early for use in timelineBlocks)
    const [optimisticBlocks, setOptimisticBlocks] = useState<any[]>([])

    // Merge optimistic blocks with propsRangeBlocks
    const rangeBlocks = useMemo(() => {
        const base = propsRangeBlocks || []
        const optIds = new Set(optimisticBlocks.map(b => String(b.id)))
        const filteredBase = base.filter((b: any) => !optIds.has(String(b.id)))
        return [...filteredBase, ...optimisticBlocks]
    }, [propsRangeBlocks, optimisticBlocks])



    // Filter blocks
    const conflictIds = useMemo(() => {
        if (listFilterConflict === 'conflicts') {
            return getConflictIds(rangeBlocks || [])
        }
        return new Set<string>()
    }, [rangeBlocks, listFilterConflict])

    const timelineBlocks = (rangeBlocks || []).filter((b: any) => {
        if (listFilterConflict === 'conflicts' && !conflictIds.has(String(b.id))) return false

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



    const [hoveredTask, setHoveredTask] = useState<any | null>(null)
    const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null)
    const [dragging, setDragging] = useState<{ id: string, startY: number, startX: number, originalBlock: any, edge: 'top' | 'bottom' | 'move', startDate: Date } | null>(null)
    const [dragPreview, setDragPreview] = useState<{ start: Date, end: Date, date: Date } | null>(null)
    const [dragConflicts, setDragConflicts] = useState<string[]>([])
    // optimisticBlocks declared above
    const gridRef = useRef<HTMLDivElement>(null)
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const HOUR_HEIGHT = 40
    const PX_PER_MIN = 40 / 60

    const checkConflicts = (ignoreBlockId: string | null, start: Date, end: Date) => {
        const conflicts: string[] = []
        timelineBlocks.forEach((b: any) => {
            if (ignoreBlockId && String(b.id) === ignoreBlockId) return
            const bStart = new Date(b.start_at)
            const bEnd = new Date(b.end_at)
            if (start < bEnd && end > bStart) {
                conflicts.push(String(b.id))
            }
        })
        return conflicts
    }

    useEffect(() => {
        if (dragging) {

            const handleMouseMove = (e: MouseEvent) => {
                if (!gridRef.current) return

                const deltaY = e.clientY - dragging.startY
                const deltaMins = Math.round(deltaY / PX_PER_MIN / 15) * 15 // Snap to 15m

                // Calculate Day Change
                const gridRect = gridRef.current.getBoundingClientRect()
                const timeColWidth = 48 // w-12
                const dayWidth = (gridRect.width - timeColWidth) / 7
                const relativeX = e.clientX - gridRect.left - timeColWidth

                // Clamp column index 0-6
                const currentDayIndex = Math.min(6, Math.max(0, Math.floor(relativeX / dayWidth)))

                // But wait, the original logic was simple delta?
                // "Drag from any day to any day" -> Calculate target day based on cursor X

                const targetDay = weekDays[currentDayIndex]
                if (!targetDay) return // Should not happen given clamping

                const originalStart = new Date(dragging.originalBlock.start_at)
                const originalEnd = new Date(dragging.originalBlock.end_at)
                const durationMins = (originalEnd.getTime() - originalStart.getTime()) / 60000

                let newStart = new Date(originalStart)
                let newEnd = new Date(originalEnd)

                // Update Date Component
                newStart.setFullYear(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate())
                newEnd.setFullYear(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate())

                // Update Time Component
                if (dragging.edge === 'move') {
                    newStart.setMinutes(originalStart.getMinutes() + deltaMins)
                    newEnd = new Date(newStart.getTime() + durationMins * 60000)
                } else if (dragging.edge === 'top') {
                    newStart.setMinutes(originalStart.getMinutes() + deltaMins)
                } else if (dragging.edge === 'bottom') {
                    // Logic for bottom resize if needed, but requirements imply "moving time" primarily. 
                    // User said "Task can be modified by dragging time (0-24)" -> usually implies moving the whole block OR resizing.
                    // "Like Day View dragging" implies resizing too. I'll implement both supported edges if I add handles.
                    newEnd.setMinutes(originalEnd.getMinutes() + deltaMins)
                }

                // Clamp to 00:00 - 24:00
                const startMins = newStart.getHours() * 60 + newStart.getMinutes()
                const endMins = newEnd.getHours() * 60 + newEnd.getMinutes()

                if (startMins < 0) {
                    newStart.setHours(0, 0, 0, 0)
                    if (dragging.edge === 'move') newEnd = new Date(newStart.getTime() + durationMins * 60000)
                }

                // Allow up to 24:00 (which is 00:00 next day, but here we treat strictly as same day constraint?)
                // User said "0-24 point".
                // If end crosses 24:00, clamp.
                // 24:00 is technically 00:00 of next day.
                // Our logic sets the date to `targetDay`. So 00:00 next day would be `targetDay + 1` 00:00.

                // Simplified constraint: Start and End must be within the target day (or exactly 24:00 end)
                // Actually easier: Working with Minutes from midnight

                let sMins = originalStart.getHours() * 60 + originalStart.getMinutes() + (dragging.edge === 'move' || dragging.edge === 'top' ? deltaMins : 0)
                let eMins = originalEnd.getHours() * 60 + originalEnd.getMinutes() + (dragging.edge === 'move' || dragging.edge === 'bottom' ? deltaMins : 0)

                if (dragging.edge === 'move') {
                    if (sMins < 0) { sMins = 0; eMins = durationMins; }
                    if (eMins > 1440) { eMins = 1440; sMins = 1440 - durationMins; }
                } else if (dragging.edge === 'top') {
                    if (sMins < 0) sMins = 0;
                    if (sMins > eMins - 15) sMins = eMins - 15; // Min duration
                } else if (dragging.edge === 'bottom') {
                    if (eMins > 1440) eMins = 1440
                    if (eMins < sMins + 15) eMins = sMins + 15
                }

                newStart.setHours(Math.floor(sMins / 60), sMins % 60, 0, 0)
                // Handle 24:00 special case for end
                if (eMins === 1440) {
                    newEnd = new Date(targetDay)
                    newEnd.setDate(newEnd.getDate() + 1)
                    newEnd.setHours(0, 0, 0, 0)
                } else {
                    newEnd.setHours(Math.floor(eMins / 60), eMins % 60, 0, 0)
                }

                setDragPreview({ start: newStart, end: newEnd, date: targetDay })

                const conflicts = checkConflicts(dragging.id, newStart, newEnd)
                setDragConflicts(conflicts)
            }

            const handleMouseUp = async () => {
                if (dragPreview && dragging) {
                    if (dragConflicts.length > 0) {
                        if (setCenterAlert) setCenterAlert({ title: '提示', detail: '时间冲突！无法移动到该时间段' })
                    } else {
                        actions.updateBlock(dragging.id, {
                            start_at: dragPreview.start.toISOString(),
                            end_at: dragPreview.end.toISOString()
                        })
                    }
                }
                setDragging(null)
                setDragPreview(null)
                setDragConflicts([])
            }

            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
            return () => {
                window.removeEventListener('mousemove', handleMouseMove)
                window.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [dragging, dragPreview, weekDays, actions]) // Dependencies

    const handleDragStart = (e: React.MouseEvent, blockId: string, edge: 'top' | 'bottom' | 'move', block: any) => {
        e.stopPropagation()
        setHoveredTask(null)
        setHoverPos(null)
        setDragging({
            id: blockId,
            startY: e.clientY,
            startX: e.clientX,
            originalBlock: block,
            edge,
            startDate: new Date(block.start_at)
        })
        const s = new Date(block.start_at)
        const eDate = new Date(block.end_at)
        setDragPreview({ start: s, end: eDate, date: s })
    }
    const [cardMenuOpen, setCardMenuOpen] = useState(false)

    // External Drop Logic
    const [dropPreview, setDropPreview] = useState<{ dayDate: Date, start: Date, end: Date, color?: string, title: string, hasConflict?: boolean } | null>(null)

    const handleExternalDragOver = (e: React.DragEvent, dayDate: Date) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'

        const gridRect = e.currentTarget.getBoundingClientRect()
        const relativeY = e.clientY - gridRect.top

        // Calculate minutes from top (0px = startHour)
        const minutesFromStart = (relativeY / 40) * 60
        // Snap to 15m
        const snappedMinutes = Math.round(minutesFromStart / 15) * 15

        const startH = startHour + Math.floor(snappedMinutes / 60)
        const startM = snappedMinutes % 60

        const start = new Date(dayDate)
        start.setHours(startH, startM, 0, 0)

        const dragData = (window as any).__dragPoolTask
        const duration = dragData?.estimateMin || 30

        const end = new Date(start.getTime() + duration * 60000)

        // Check conflicts for preview
        const conflicts = checkConflicts(null, start, end)
        const hasConflict = conflicts.length > 0

        setDropPreview({
            dayDate,
            start,
            end,
            color: dragData?.color,
            title: dragData?.taskTitle || '新任务',
            hasConflict
        })
    }

    const handleExternalDragLeave = () => {
        setDropPreview(null)
    }

    const handleExternalDrop = async (e: React.DragEvent, dayDate: Date) => {
        e.preventDefault()
        setDropPreview(null)

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'))
            if (data.type !== 'pool-task') return

            const gridRect = e.currentTarget.getBoundingClientRect()
            const relativeY = e.clientY - gridRect.top
            const minutesFromStart = (relativeY / 40) * 60
            const snappedMinutes = Math.round(minutesFromStart / 15) * 15

            const startH = startHour + Math.floor(snappedMinutes / 60)
            const startM = snappedMinutes % 60

            const start = new Date(dayDate)
            start.setHours(startH, startM, 0, 0)

            const duration = data.estimateMin || 30
            const end = new Date(start.getTime() + duration * 60000)

            // Check 24:00 constraint
            const endOfDay = new Date(dayDate)
            endOfDay.setHours(23, 59, 59, 999)

            // Check conflicts
            const conflicts = checkConflicts(null, start, end)
            if (conflicts.length > 0) {
                if (setCenterAlert) setCenterAlert({ title: '提示', detail: '时间冲突！无法放置到该时间段' })
                return
            }

            // Optimistic Update
            const tempId = data.taskId || 'temp-' + Date.now()
            const optimisticBlock = {
                id: tempId,
                task_id: data.taskId, // Link to task metadata
                start_at: start.toISOString(),
                end_at: end.toISOString(),
            }

            setOptimisticBlocks(prev => [...prev, optimisticBlock])

            if (actions.updateTaskAdvanced) {
                const isPinned = data.recurrenceRule?.includes('PINNED')

                try {
                    if (isPinned && actions.createTaskAdvanced) {
                        await actions.createTaskAdvanced({
                            title: data.taskTitle,
                            estimate_min: duration,
                            due_at: end.toISOString(),
                            priority: data.priority,
                            tags: data.tags,
                            type: data.taskType,
                            content: data.content,
                            recurrence_rule: '',
                            color: data.color
                        })
                    } else if (actions.addBlock && isPinned) {
                        // Fallback
                        const startStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
                        const endStr = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
                        await actions.addBlock(startStr, endStr, data.taskId, todayStr(dayDate))
                    } else {
                        await actions.updateTaskAdvanced(data.taskId, {
                            title: data.taskTitle,
                            due_at: end.toISOString(),
                            estimate_min: duration,
                            recurrence_rule: '',
                        })
                    }
                    if (actions.fetchUnscheduled) actions.fetchUnscheduled()
                } finally {
                    // Clear optimistic after action (success or fail)
                    // If success, real data comes from swr/state update.
                    setOptimisticBlocks(prev => prev.filter(b => b.id !== tempId))
                }
            }
        } catch (err) {
            console.error('Drop error', err)
            // Cleanup in case of error outside the try block if any (though try wraps mostly all)
            setOptimisticBlocks(prev => [])
        }
    }


    // Dynamic Week Timeline Logic
    const [isWeekCollapsed, setIsWeekCollapsed] = useState(true)

    const activeHours = useMemo(() => {
        const hours = new Set<number>()
        timelineBlocks.forEach((b: any) => {
            const s = new Date(b.start_at)
            const e = new Date(b.end_at)
            hours.add(s.getHours())
            // Add end hour if it extends into it (and isn't exactly on the hour, unless single hour block)
            if (e.getMinutes() > 0 || e.getTime() === s.getTime()) {
                hours.add(e.getHours())
            } else if (e.getHours() > 0) {
                // For exact hour end (e.g., 10:00), the task is in 9:00-10:00, so we don't strictly need 10 to be visible unless it spans.
                // However, simpler to just add start hour.
                // Let's ensure if a task is 23:30-00:30, 0 is added.
            }
        })
        return hours
    }, [timelineBlocks])

    const visibleHours = useMemo(() => {
        const coreHours = Array.from({ length: 18 }, (_, i) => 6 + i) // 6 to 23
        if (!isWeekCollapsed) {
            return Array.from({ length: 24 }, (_, i) => i) // 0 to 23
        }
        // Collapsed mode: Core + Active Outliers
        const hours = new Set(coreHours)
        activeHours.forEach(h => hours.add(h))
        return Array.from(hours).sort((a, b) => a - b).filter(h => h >= 0 && h <= 23)
    }, [isWeekCollapsed, activeHours])

    const startHour = visibleHours.length > 0 ? visibleHours[0] : 6
    const endHour = visibleHours.length > 0 ? visibleHours[visibleHours.length - 1] : 23
    const hours = visibleHours // Override the static hours array

    return (
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-4 lg:gap-6 h-[calc(100vh-180px)]">
            <div className="lg:col-span-6 h-full flex flex-col relative">
                {/* Filter Toggle Button */}
                <div className="absolute -top-[3.25rem] right-0 z-10 flex items-center gap-2">
                    <button
                        className="p-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700 text-white/70 hover:text-white transition-colors border border-white/10"
                        title={isWeekCollapsed ? "展开全部" : "折叠全部"}
                        onClick={() => setIsWeekCollapsed(!isWeekCollapsed)}
                    >
                        <span className="material-symbols-outlined text-sm">
                            {isWeekCollapsed ? 'unfold_more' : 'unfold_less'}
                        </span>
                    </button>
                    <button
                        onClick={() => actions.setShowCreateTask && actions.setShowCreateTask(true)}
                        className="p-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700 text-white/70 hover:text-white transition-colors border border-white/10"
                        title="新建任务"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                    </button>
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

                <section className="flex-1 flex flex-col rounded-xl border border-white/10 bg-slate-800/50">
                    {/* Filters Toolbar */}
                    {state.showFilters && (
                        <div className="relative z-50 bg-black/20 backdrop-blur-sm p-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-3 text-white/90 text-sm">

                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-white/70">类型</span>
                                    <TypeFilterDropdown
                                        value={listFilterType}
                                        onChange={(val) => setListFilterType && setListFilterType(val)}
                                        options={listTypeOptions || []}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-white/70">优先</span>
                                    <select
                                        className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                                        value={listFilterPriority}
                                        onChange={(e) => setListFilterPriority && setListFilterPriority(e.target.value as any)}
                                    >
                                        <option value="all" className="bg-slate-800 text-white">所有</option>
                                        <option value="2" className="bg-slate-800 text-white">高</option>
                                        <option value="1" className="bg-slate-800 text-white">中</option>
                                        <option value="0" className="bg-slate-800 text-white">低</option>
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
                                        <option value="all" className="bg-slate-800 text-white">所有</option>
                                        <option value="yes" className="bg-slate-800 text-white">是</option>
                                        <option value="no" className="bg-slate-800 text-white">否</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-white/70">完成</span>
                                    <select
                                        className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                                        value={listFilterDone}
                                        onChange={(e) => setListFilterDone && setListFilterDone(e.target.value as any)}
                                    >
                                        <option value="all" className="bg-slate-800 text-white">所有</option>
                                        <option value="done" className="bg-slate-800 text-white">已完成</option>
                                        <option value="open" className="bg-slate-800 text-white">未完成</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-white/70">冲突</span>
                                    <select
                                        className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                                        value={listFilterConflict || 'all'}
                                        onChange={(e) => setListFilterConflict && setListFilterConflict(e.target.value)}
                                    >
                                        <option value="all" className="bg-slate-800 text-white">所有</option>
                                        <option value="conflicts" className="bg-slate-800 text-white">仅冲突</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                    )}

                    {/* Week Grid */}
                    <div className="flex-1 overflow-y-auto relative" ref={gridRef}>
                        <div className="flex min-w-[800px]">
                            {/* Time Column */}
                            <div className="w-12 flex-shrink-0 border-r border-white/10 bg-slate-900 sticky left-0 z-20">
                                <div className="h-10 border-b border-white/10 bg-slate-900 sticky top-0 z-30"></div>
                                {hours.map(h => (
                                    <div key={h} className="h-[40px] border-b border-white/10 text-[10px] text-slate-400 flex items-start justify-center pt-1">
                                        {String(h).padStart(2, '0')}:00
                                    </div>
                                ))}
                            </div>

                            {/* Days Columns */}
                            {weekDays.map((dayDate, dayIndex) => {
                                const dateStr = todayStr(dayDate)
                                const isToday = dateStr === todayStr(now)
                                const dayLabel = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayDate.getDay()]

                                return (
                                    <div key={dateStr} className="flex-1 min-w-[100px] border-r border-white/10 relative">
                                        {/* Header */}
                                        <div className={`h-10 border-b border-white/10 flex flex-col items-center justify-center sticky top-0 z-10 ${isToday ? 'bg-[#137fec]/20' : 'bg-slate-900'}`}>
                                            <span className={`text-xs font-medium ${isToday ? 'text-[#137fec]' : 'text-slate-300'}`}>{dayLabel}</span>
                                            <span className={`text-[10px] ${isToday ? 'text-[#137fec]' : 'text-slate-500'}`}>{dayDate.getDate()}</span>
                                        </div>

                                        {/* Grid */}
                                        <div
                                            className="relative bg-slate-900/50"
                                            onDragOver={(e) => handleExternalDragOver(e, dayDate)}
                                            onDragLeave={handleExternalDragLeave}
                                            onDrop={(e) => handleExternalDrop(e, dayDate)}
                                        >
                                            {hours.map(h => (
                                                <div key={h} className="h-[40px] border-b border-white/10 relative group">
                                                    {/* Add button on hover */}
                                                    <button
                                                        className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 hover:bg-white/5 transition-opacity z-0 cursor-default"
                                                        onClick={() => {
                                                            if (addBlock) {
                                                                const start = `${String(h).padStart(2, '0')}:00`
                                                                const end = `${String(h + 1).padStart(2, '0')}:00`
                                                                addBlock(start, end, undefined, dateStr)
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            ))}

                                            {/* Drop Preview */}
                                            {dropPreview && dropPreview.dayDate.getDate() === dayDate.getDate() && (
                                                <div
                                                    className={`absolute left-0.5 right-0.5 rounded text-xs text-white overflow-hidden border border-dashed z-40 pointer-events-none ${dropPreview.hasConflict ? 'bg-red-500/50 border-red-500' : 'bg-blue-500/50 border-blue-400'}`}
                                                    style={{
                                                        top: Math.max(0, ((dropPreview.start.getHours() - startHour) * 60 + dropPreview.start.getMinutes()) / 60 * 40),
                                                        height: Math.max(20, (dropPreview.end.getTime() - dropPreview.start.getTime()) / 60000 / 60 * 40),
                                                    }}
                                                >
                                                    <div className="px-1 py-0.5" style={{ backgroundColor: dropPreview.hasConflict ? '#EF4444' : (dropPreview.color ? dropPreview.color + '80' : undefined) }}>
                                                        {dropPreview.title}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Current Time Line */}
                                            {isToday && (
                                                <div
                                                    className="absolute w-full border-t-2 border-red-500 z-20 pointer-events-none"
                                                    style={{
                                                        top: Math.max(0, (now.getHours() - startHour) * 40 + (now.getMinutes() / 60) * 40)
                                                    }}
                                                />
                                            )}

                                            {/* Blocks */}
                                            {timelineBlocks.filter((b: any) => {
                                                const isDraggingThis = dragging?.id === String(b.id)
                                                // If dragging, use preview date
                                                const targetDate = isDraggingThis && dragPreview ? dragPreview.date : new Date(b.start_at)

                                                return targetDate.getDate() === dayDate.getDate() &&
                                                    targetDate.getMonth() === dayDate.getMonth() &&
                                                    targetDate.getFullYear() === dayDate.getFullYear()
                                            }).map((b: any) => {
                                                const isDraggingThis = dragging?.id === String(b.id)

                                                const s = isDraggingThis && dragPreview ? dragPreview.start : new Date(b.start_at)
                                                const e = isDraggingThis && dragPreview ? dragPreview.end : new Date(b.end_at)

                                                // Calculate position relative to startHour
                                                // If we cross midnight to next day (24:00), handle it.
                                                // Or if start is previous day? No, filter ensures we are on the day.
                                                // Using simple minutes-from-start-hour logic.

                                                const startMin = (s.getHours() - startHour) * 60 + s.getMinutes()
                                                let endMin = (e.getHours() - startHour) * 60 + e.getMinutes()

                                                // Handle 24:00 case
                                                if (e.getHours() === 0 && e.getMinutes() === 0 && e.getDate() !== s.getDate()) {
                                                    endMin = (24 - startHour) * 60
                                                }
                                                const duration = endMin - startMin

                                                if (endMin <= 0 || startMin >= (endHour - startHour + 1) * 60) return null

                                                const top = (startMin / 60) * 40
                                                const height = Math.max(24, (duration / 60) * 40)

                                                const taskIdStr = b.task_id ? String(b.task_id) : null
                                                const meta = taskIdStr ? taskMetaMap?.[taskIdStr] : undefined
                                                const baseColor = meta?.color || '#60A5FA'
                                                const barColor = baseColor + '1A'
                                                const borderColor = baseColor + 'B3'
                                                const name = b.task_id ? taskTitleMap?.[String(b.task_id)] : '时间块'
                                                const status = taskIdStr ? taskStatusMap?.[taskIdStr] : 'open'
                                                const isMenuOpen = listMenuOpenId === String(b.id)
                                                const isOverdue = e.getTime() < now.getTime() && status !== 'done'
                                                const isCurrent = currentBlock && String(currentBlock.id) === String(b.id)

                                                return (
                                                    <div
                                                        key={String(b.id)}
                                                        className={`absolute left-0.5 right-0.5 rounded text-xs text-white bg-slate-800/90 hover:bg-slate-800 hover:ring-1 hover:ring-blue-400/50 ${isDraggingThis ? 'overflow-visible' : 'overflow-hidden'} ${isCurrent
                                                            ? 'border-2 border-amber-400 shadow-lg shadow-amber-500/50 z-30 ring-2 ring-amber-400/30 animate-pulse'
                                                            : `border border-white/5 ${isMenuOpen ? 'z-50' : 'z-10'}`
                                                            } ${isDraggingThis
                                                                ? (dragConflicts.length > 0 ? 'opacity-80 ring-2 ring-red-500 z-50 cursor-not-allowed' : 'opacity-80 ring-2 ring-blue-500 z-50 cursor-grabbing')
                                                                : ''}`}
                                                        style={{
                                                            top: Math.max(0, top),
                                                            height: Math.max(20, height),
                                                            borderColor: isCurrent ? undefined : (isDraggingThis ? (dragConflicts.length > 0 ? '#EF4444' : '#3B82F6') : baseColor),
                                                        }}
                                                        onMouseDown={(e) => {
                                                            // Only start drag if not clicking a button/menu
                                                            // Simple: start drag
                                                            handleDragStart(e, String(b.id), 'move', b)
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (!dragging) { // Only toggle menu if not dragging
                                                                if (setListMenuOpenId) setListMenuOpenId(isMenuOpen ? null : String(b.id))
                                                            }
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (dragging) return
                                                            if (b.task_id && meta) {
                                                                if (hoverTimeoutRef.current) {
                                                                    clearTimeout(hoverTimeoutRef.current)
                                                                    hoverTimeoutRef.current = null
                                                                }
                                                                const rect = e.currentTarget.getBoundingClientRect()
                                                                setHoverPos({ x: rect.right + 10, y: rect.top })
                                                                setHoveredTask({ ...meta, id: b.task_id, title: name, status, blockStart: b.start_at, blockEnd: b.end_at, blockId: b.id })
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
                                                        {/* Top drag handle */}
                                                        <div
                                                            className={`absolute top-0 left-0 right-0 h-1 cursor-n-resize rounded-t-xl transition-opacity z-20 ${isDraggingThis && dragging?.edge === 'top'
                                                                ? 'opacity-100 bg-blue-500/60'
                                                                : 'opacity-0 group-hover:opacity-100 hover:bg-blue-500/30'
                                                                }`}
                                                            onMouseDown={(e) => handleDragStart(e, String(b.id), 'top', b)}
                                                        />
                                                        {/* Bottom drag handle */}
                                                        <div
                                                            className={`absolute bottom-0 left-0 right-0 h-1 cursor-s-resize rounded-b-xl transition-opacity z-20 ${isDraggingThis && dragging?.edge === 'bottom'
                                                                ? 'opacity-100 bg-blue-500/60'
                                                                : 'opacity-0 group-hover:opacity-100 hover:bg-blue-500/30'
                                                                }`}
                                                            onMouseDown={(e) => handleDragStart(e, String(b.id), 'bottom', b)}
                                                        />
                                                        {/* Left Grip Handle - Optional in week view as space is tight, but consistent */}
                                                        {/* Removed Left Grip Handle to save space in Week View columns, relying on main body drag */}

                                                        <div className={`px-1 py-0.5 leading-tight flex items-start overflow-hidden ${status === 'done' ? 'opacity-70' : ''}`} style={{ maxHeight: height - 4 }}>
                                                            {status === 'done' && (
                                                                <span className="mr-0.5 flex-shrink-0 inline-flex items-center justify-center w-3 h-3 rounded-full bg-emerald-500/20" title="已完成">
                                                                    <span className="material-symbols-outlined text-emerald-400 text-[10px]">check</span>
                                                                </span>
                                                            )}
                                                            {isOverdue && (
                                                                <span className="mr-0.5 flex-shrink-0 inline-flex items-center justify-center w-3 h-3 rounded-full bg-red-500/20" title="逾期">
                                                                    <span className="material-symbols-outlined text-red-500 text-[10px]">close</span>
                                                                </span>
                                                            )}
                                                            {typeof meta?.priority === 'number' && (
                                                                <span className={`mr-1 text-[9px] px-0.5 rounded flex-shrink-0 ${meta.priority === 2 ? 'bg-red-500/20 text-red-300' :
                                                                    meta.priority === 1 ? 'bg-yellow-500/20 text-yellow-300' :
                                                                        'bg-green-500/20 text-green-300'
                                                                    }`}>
                                                                    {meta.priority === 2 ? 'H' : meta.priority === 1 ? 'M' : 'L'}
                                                                </span>
                                                            )}
                                                            <span className="break-words" style={{ display: '-webkit-box', WebkitLineClamp: Math.max(1, Math.floor((height - 8) / 14)), WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{name}</span>
                                                        </div>

                                                        {isMenuOpen && (
                                                            <div className="absolute top-full left-0 w-24 bg-slate-900 border border-slate-700 shadow-xl rounded z-50">
                                                                <button
                                                                    className="block w-full px-2 py-1 text-left hover:bg-slate-800"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        if (deleteBlock) deleteBlock(b.id)
                                                                        if (setListMenuOpenId) setListMenuOpenId(null)
                                                                    }}
                                                                >
                                                                    删除
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* Drag Time Indicator */}
                                                        {isDraggingThis && dragPreview && (
                                                            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 border border-slate-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-lg z-50 whitespace-nowrap pointer-events-none">
                                                                {`${String(dragPreview.start.getHours()).padStart(2, '0')}:${String(dragPreview.start.getMinutes()).padStart(2, '0')} - ${String(dragPreview.end.getHours()).padStart(2, '0')}:${String(dragPreview.end.getMinutes()).padStart(2, '0')}`}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </section>
            </div >

            <div className="lg:col-span-2 sticky top-0 max-h-[calc(100vh-140px)] overflow-y-auto pl-1 no-scrollbar">
                <PlannerListView
                    state={{ unscheduled, unschedMenuOpenId, listEdit, taskMetaMap, listTypeOptions, listTagOptions }}
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

            {/* Hover Detail Card */}
            {
                hoveredTask && hoverPos && (
                    <TaskHoverCard
                        task={hoveredTask}
                        position={hoverPos}
                        onClose={() => {
                            setHoveredTask(null)
                            setHoverPos(null)
                            setCardMenuOpen(false)
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
                        actions={{
                            updateTaskMeta,
                            updateTaskAdvanced,
                            updateBlock,
                            deleteTask,
                            completeTask,
                            deleteBlock,
                            setEditTask,
                            headers: actions.headers,
                            createTaskAdvanced,
                            setCenterAlert,
                        }}
                        options={{
                            listTypeOptions,
                            listTagOptions,
                        }}
                    />
                )
            }
        </div >
    )
}
