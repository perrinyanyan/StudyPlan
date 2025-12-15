import { useState, useRef, useMemo, useEffect } from 'react'
import { getConflictIds } from '../../utils/conflicts'
import { PlannerListView } from './PlannerListView'
import { TaskHoverCard } from './TaskHoverCard'
import { todayStr } from '../../utils/datetime'
import { MultiSelect } from '../ui/MultiSelect'
import { TypeFilterDropdown } from '../ui/TypeFilterDropdown'

export interface PlannerMonthViewProps {
    state: any
    actions: any
}

export function PlannerMonthView({ state, actions }: PlannerMonthViewProps) {
    const {
        rangeBlocks: propsRangeBlocks, // This will hold the month's blocks
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
        unscheduled,
        unschedMenuOpenId,
        listEdit,
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
        setListEdit,
        setShowCreateTask,
        updateBlock,
        deleteBlock,
        addBlock,
        setListFilterType,
        setListFilterPriority,
        setListFilterTag,
        setListFilterOverdue,
        setListFilterDone,
        setListFilterConflict,
        setListMenuOpenId,

        createTaskAdvanced,
        updateTaskAdvanced,
        setCenterAlert,
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

    // Optimistic Blocks State
    const [optimisticBlocks, setOptimisticBlocks] = useState<any[]>([])

    // Merge optimistic blocks with propsRangeBlocks
    const rangeBlocks = useMemo(() => {
        const base = propsRangeBlocks || []
        const optIds = new Set(optimisticBlocks.map(b => String(b.id)))
        const filteredBase = base.filter((b: any) => !optIds.has(String(b.id)))
        return [...filteredBase, ...optimisticBlocks]
    }, [propsRangeBlocks, optimisticBlocks])

    // Drag and Drop Logic
    const [dragging, setDragging] = useState<{ id: string, originalBlock: any } | null>(null)
    const [dragPreview, setDragPreview] = useState<{ date: Date } | null>(null)
    const [dragMousePos, setDragMousePos] = useState<{ x: number, y: number } | null>(null)
    const [dragConflicts, setDragConflicts] = useState<string[]>([])

    // Conflict check function for internal drag
    const checkInternalConflicts = (blockId: string, targetDate: Date, block: any): string[] => {
        const originalStart = new Date(block.start_at)
        const originalEnd = new Date(block.end_at)
        const duration = originalEnd.getTime() - originalStart.getTime()

        const newStart = new Date(targetDate)
        newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0)
        const newEnd = new Date(newStart.getTime() + duration)

        const conflicts: string[] = []
        for (const b of rangeBlocks || []) {
            if (String(b.id) === blockId) continue
            const bStart = new Date(b.start_at)
            const bEnd = new Date(b.end_at)
            // Check same day
            if (bStart.toDateString() !== newStart.toDateString()) continue
            // Check overlap
            if (newStart.getTime() < bEnd.getTime() && newEnd.getTime() > bStart.getTime()) {
                conflicts.push(String(b.id))
            }
        }
        return conflicts
    }

    // Handle Drop (Global MouseUp)
    useEffect(() => {
        if (dragging) {
            const handleMouseMove = (e: MouseEvent) => {
                setDragMousePos({ x: e.clientX, y: e.clientY })
            }
            const handleMouseUp = async () => {
                if (dragPreview && dragging) {
                    // Check conflicts before committing
                    if (dragConflicts.length > 0) {
                        if (setCenterAlert) {
                            setCenterAlert({ title: '时间冲突', detail: '目标日期存在时间冲突，请选择其他日期' })
                        }
                        setDragging(null)
                        setDragPreview(null)
                        setDragMousePos(null)
                        setDragConflicts([])
                        return
                    }

                    const originalStart = new Date(dragging.originalBlock.start_at)
                    const originalEnd = new Date(dragging.originalBlock.end_at)
                    const duration = originalEnd.getTime() - originalStart.getTime()

                    const newStart = new Date(dragPreview.date)
                    // Keep original time
                    newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0)
                    const newEnd = new Date(newStart.getTime() + duration)

                    // Optimistic update handled by render logic, now commit
                    if (updateBlock) {
                        updateBlock(dragging.id, {
                            start_at: newStart.toISOString(),
                            end_at: newEnd.toISOString()
                        })
                    }
                }
                setDragging(null)
                setDragPreview(null)
                setDragMousePos(null)
                setDragConflicts([])
            }
            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
            return () => {
                window.removeEventListener('mousemove', handleMouseMove)
                window.removeEventListener('mouseup', handleMouseUp)
            }
        }
    }, [dragging, dragPreview, dragConflicts, updateBlock, setCenterAlert, rangeBlocks])

    // Update conflicts when dragPreview changes
    useEffect(() => {
        if (dragging && dragPreview) {
            const conflicts = checkInternalConflicts(dragging.id, dragPreview.date, dragging.originalBlock)
            setDragConflicts(conflicts)
        }
    }, [dragging, dragPreview])

    const handleDragStart = (e: React.MouseEvent, block: any) => {
        e.stopPropagation()
        setDragging({ id: String(block.id), originalBlock: block })
        setDragPreview({ date: new Date(block.start_at) })
        setDragMousePos({ x: e.clientX, y: e.clientY })
    }

    // External Drag Handlers
    const [externalDragOver, setExternalDragOver] = useState<{ date: Date } | null>(null)

    const handleExternalDragOver = (e: React.DragEvent, date: Date) => {
        e.preventDefault()
        setExternalDragOver({ date })
    }

    const handleExternalDrop = async (e: React.DragEvent, date: Date) => {
        e.preventDefault()
        setExternalDragOver(null)
        try {
            // Try to get data from global context first (more robust) or dataTransfer
            let data = (window as any).__dragPoolTask
            if (!data) {
                try {
                    const json = e.dataTransfer.getData('application/json')
                    if (json) data = JSON.parse(json)
                } catch (e) { /* ignore */ }
            }

            if (!data) return
            // Allow pool-task type or fallback if custom data struct
            if (data.type && data.type !== 'pool-task') return

            // Calculate Start Time: Append to end of existing tasks
            const dayStart = new Date(date)
            dayStart.setHours(0, 0, 0, 0)
            const dayEnd = new Date(date)
            dayEnd.setHours(23, 59, 59, 999)

            const dayBlocks = (rangeBlocks || []).filter((b: any) => {
                const bStart = new Date(b.start_at)
                return bStart >= dayStart && bStart <= dayEnd
            })

            let startTime = new Date(date)
            if (dayBlocks.length > 0) {
                // Find max end time
                const maxEnd = dayBlocks.reduce((max: number, b: any) => {
                    return Math.max(max, new Date(b.end_at).getTime())
                }, dayStart.getTime())
                startTime = new Date(maxEnd)
            } else {
                // Default to 09:00 if empty
                startTime.setHours(9, 0, 0, 0)
            }

            // Cap at 23:45?
            if (startTime.getHours() >= 24) {
                startTime.setHours(23, 45, 0, 0)
            }

            const estimateMin = data.estimateMin || 60
            const endTime = new Date(startTime.getTime() + estimateMin * 60000)

            // Optimistic Update
            const tempId = data.taskId || 'temp-' + Date.now()
            const optimisticBlock = {
                id: tempId,
                task_id: data.taskId,
                start_at: startTime.toISOString(),
                end_at: endTime.toISOString(),
            }
            setOptimisticBlocks(prev => [...prev, optimisticBlock])

            try {
                if (updateTaskAdvanced) {
                    const isPinned = data.recurrenceRule?.includes('PINNED')
                    if (isPinned && createTaskAdvanced) {
                        await createTaskAdvanced({
                            title: data.taskTitle,
                            estimate_min: estimateMin,
                            due_at: endTime.toISOString(),
                            priority: data.priority,
                            tags: data.tags,
                            type: data.taskType,
                            content: data.content,
                            recurrence_rule: '',
                            color: data.color
                        })
                    } else if (addBlock && isPinned) {
                        const startStr = `${String(startTime.getHours()).padStart(2, '0')}:${String(startTime.getMinutes()).padStart(2, '0')}`
                        const endStr = `${String(endTime.getHours()).padStart(2, '0')}:${String(endTime.getMinutes()).padStart(2, '0')}`
                        await addBlock(startStr, endStr, data.taskId, todayStr(date))
                    } else {
                        await updateTaskAdvanced(data.taskId, {
                            title: data.taskTitle,
                            due_at: endTime.toISOString(),
                            estimate_min: estimateMin,
                            recurrence_rule: '',
                        })
                    }
                    if (fetchUnscheduled) fetchUnscheduled()
                }
            } finally {
                setOptimisticBlocks(prev => prev.filter(b => b.id !== tempId))
            }

        } catch (err) {
            console.error(err)
            setOptimisticBlocks(prev => [])
        }
    }

    // Calculate month days (including padding)
    const monthDays = []
    if (date) {
        const d = new Date(date)
        const year = d.getFullYear()
        const month = d.getMonth()

        // First day of the month
        const firstDay = new Date(year, month, 1)
        // Last day of the month
        const lastDay = new Date(year, month + 1, 0)

        // Calculate padding for start (Monday start)
        const startDay = firstDay.getDay() // 0 is Sunday
        const startDiff = startDay === 0 ? 6 : startDay - 1
        const startDate = new Date(firstDay)
        startDate.setDate(firstDay.getDate() - startDiff)

        // Calculate padding for end (Sunday end)
        const endDay = lastDay.getDay() // 0 is Sunday
        const endDiff = endDay === 0 ? 0 : 7 - endDay
        const endDate = new Date(lastDay)
        endDate.setDate(lastDay.getDate() + endDiff)

        const current = new Date(startDate)
        while (current <= endDate) {
            monthDays.push(new Date(current))
            current.setDate(current.getDate() + 1)
        }
    }

    // Filter blocks
    const conflictIds = useMemo(() => {
        if (listFilterConflict === 'conflicts') {
            return getConflictIds(rangeBlocks || [])
        }
        return new Set<string>()
    }, [rangeBlocks, listFilterConflict])

    const filteredBlocks = (rangeBlocks || []).filter((b: any) => {
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
    const hoverTimeoutRef = useRef<any>(null)
    const [cardMenuOpen, setCardMenuOpen] = useState(false)

    const weekDayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

    return (
        <div className="grid grid-cols-1 lg:grid-cols-8 gap-4 lg:gap-6 h-[calc(100vh-180px)]">
            <div className="lg:col-span-6 h-full flex flex-col relative">
                {/* Filter Toggle Button */}
                <div className="absolute -top-[3.25rem] right-0 z-10 flex items-center gap-2">
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
                        <div className="relative z-50 bg-black/20 backdrop-blur-sm p-3 border-b border-white/10">
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

                    {/* Month Grid */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 border-b border-white/10 bg-slate-900">
                            {weekDayLabels.map(day => (
                                <div key={day} className="py-2 text-center text-xs font-medium text-slate-400">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="flex-1 grid grid-cols-7 grid-rows-6 bg-slate-900/50">
                            {monthDays.map((dayDate, index) => {
                                const dateStr = todayStr(dayDate)
                                const isToday = dateStr === todayStr(now)
                                const isCurrentMonth = dayDate.getMonth() === new Date(date).getMonth()

                                // Filter blocks for this day
                                const dayBlocks = filteredBlocks.filter((b: any) => {
                                    const isDraggingThis = dragging?.id === String(b.id)
                                    // Verify dragPreview exists if dragging
                                    const targetDate = isDraggingThis && dragPreview ? dragPreview.date : new Date(b.start_at)

                                    return targetDate.getDate() === dayDate.getDate() &&
                                        targetDate.getMonth() === dayDate.getMonth() &&
                                        targetDate.getFullYear() === dayDate.getFullYear()
                                })

                                return (
                                    <div
                                        key={dateStr}
                                        className={`border-b border-r border-white/5 p-1 relative flex flex-col ${!isCurrentMonth ? 'bg-slate-900/80' : ''
                                            } ${isToday ? 'bg-[#137fec]/10' : ''} ${externalDragOver?.date.getTime() === dayDate.getTime() ? 'bg-blue-500/10 ring-2 ring-blue-500 inset-0' : ''}`}
                                        onDragOver={(e) => handleExternalDragOver(e, dayDate)}
                                        onDrop={(e) => handleExternalDrop(e, dayDate)}
                                        onMouseEnter={() => {
                                            if (dragging) {
                                                setDragPreview({ date: dayDate })
                                            }
                                        }}
                                    >
                                        <div className={`text-[10px] font-medium mb-1 flex justify-center ${isToday
                                            ? 'text-white bg-[#137fec] w-5 h-5 rounded-full flex items-center justify-center mx-auto'
                                            : !isCurrentMonth ? 'text-slate-600' : 'text-slate-400'
                                            }`}>
                                            {dayDate.getDate()}
                                        </div>

                                        <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                                            {dayBlocks.map((b: any) => {
                                                const taskIdStr = b.task_id ? String(b.task_id) : null
                                                const meta = taskIdStr ? taskMetaMap?.[taskIdStr] : undefined
                                                const baseColor = meta?.color || '#60A5FA'
                                                const name = b.task_id ? taskTitleMap?.[String(b.task_id)] : '时间块'
                                                const status = taskIdStr ? taskStatusMap?.[taskIdStr] : 'open'
                                                const isOverdue = new Date(b.end_at).getTime() < now.getTime() && status !== 'done'
                                                const isCurrent = currentBlock && String(currentBlock.id) === String(b.id)
                                                const isDraggingThis = dragging?.id === String(b.id)

                                                return (
                                                    <div
                                                        key={b.id}
                                                        className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:ring-1 hover:ring-blue-400/50 flex items-center border ${isDraggingThis ? 'opacity-50 ring-2 ring-blue-500 z-50' : ''} ${isCurrent ? 'ring-1 ring-amber-400 shadow-sm shadow-amber-500/50' : ''
                                                            } ${status === 'done' ? 'opacity-70' : ''}`}
                                                        style={{
                                                            backgroundColor: isCurrent ? '#F59E0B20' : baseColor + '1A',
                                                            borderColor: isCurrent ? '#F59E0B' : baseColor,
                                                            color: 'white'
                                                        }}
                                                        onMouseDown={(e) => handleDragStart(e, b)}
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
                                                            <span className={`mr-1 flex-shrink-0 text-[8px] px-0.5 rounded ${meta.priority === 2 ? 'bg-red-500/20 text-red-300' :
                                                                meta.priority === 1 ? 'bg-yellow-500/20 text-yellow-300' :
                                                                    'bg-green-500/20 text-green-300'
                                                                }`}>
                                                                {meta.priority === 2 ? 'H' : meta.priority === 1 ? 'M' : 'L'}
                                                            </span>
                                                        )}
                                                        <span className="truncate">{name}</span>
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
            </div>

            <div className="md:col-span-2 lg:col-span-2 sticky top-0 max-h-[calc(100vh-140px)] overflow-y-auto pl-1 no-scrollbar">
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

            {/* Drag Ghost Overlay */}
            {dragging && dragMousePos && (
                <div
                    className="fixed pointer-events-none z-[100]"
                    style={{
                        left: dragMousePos.x + 10,
                        top: dragMousePos.y - 10,
                    }}
                >
                    <div
                        className={`text-[10px] px-2 py-1 rounded shadow-lg border-2 flex items-center gap-1 ${dragConflicts.length > 0
                            ? 'bg-red-500/20 border-red-500 text-red-300'
                            : 'bg-blue-500/20 border-blue-500 text-white'
                            }`}
                    >
                        {taskTitleMap?.[String(dragging.originalBlock.task_id)] || '时间块'}
                        {dragConflicts.length > 0 && (
                            <span className="material-symbols-outlined text-xs text-red-400">warning</span>
                        )}
                    </div>
                    {dragPreview && (
                        <div className="text-[9px] text-slate-400 mt-1 text-center">
                            {dragPreview.date.getMonth() + 1}月{dragPreview.date.getDate()}日
                            {dragConflicts.length > 0 ? ' (有冲突)' : ''}
                        </div>
                    )}
                </div>
            )}
        </div >
    )
}
