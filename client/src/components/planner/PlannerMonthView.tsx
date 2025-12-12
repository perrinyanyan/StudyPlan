import { useState, useRef, useMemo } from 'react'
import { getConflictIds } from '../../utils/conflicts'
import { PlannerListView } from './PlannerListView'
import { TaskHoverCard } from './TaskHoverCard'
import { todayStr } from '../../utils/datetime'
import { MultiSelect } from '../ui/MultiSelect'

export interface PlannerMonthViewProps {
    state: any
    actions: any
}

export function PlannerMonthView({ state, actions }: PlannerMonthViewProps) {
    const {
        rangeBlocks, // This will hold the month's blocks
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

                <section className="flex-1 flex flex-col rounded-xl border border-white/10 bg-slate-800/50 overflow-hidden">
                    {/* Filters Toolbar */}
                    {state.showFilters && (
                        <div className="bg-black/20 backdrop-blur-sm p-3 border-b border-white/10">
                            <div className="flex flex-wrap items-center gap-3 text-white/90 text-sm">

                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-white/70">类型</span>
                                    <select
                                        className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                                        value={listFilterType}
                                        onChange={(e) => setListFilterType && setListFilterType(e.target.value)}
                                    >
                                        <option value="all" className="bg-slate-800 text-white">所有</option>
                                        {(listTypeOptions || []).map((name: string) => (
                                            <option key={name} value={name} className="bg-slate-800 text-white">{name}</option>
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
                                    const bDate = new Date(b.start_at)
                                    return bDate.getDate() === dayDate.getDate() &&
                                        bDate.getMonth() === dayDate.getMonth() &&
                                        bDate.getFullYear() === dayDate.getFullYear()
                                })

                                return (
                                    <div
                                        key={dateStr}
                                        className={`border-b border-r border-white/5 p-1 relative flex flex-col ${!isCurrentMonth ? 'bg-slate-900/80' : ''
                                            } ${isToday ? 'bg-[#137fec]/10' : ''}`}
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

                                                return (
                                                    <div
                                                        key={b.id}
                                                        className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:ring-1 hover:ring-blue-400/50 flex items-center ${isCurrent ? 'ring-1 ring-amber-400 shadow-sm shadow-amber-500/50' : ''
                                                            } ${status === 'done' ? 'line-through opacity-70' : ''}`}
                                                        style={{
                                                            backgroundColor: isCurrent ? '#F59E0B20' : baseColor + '1A',
                                                            borderLeft: `2px solid ${isCurrent ? '#F59E0B' : baseColor}`,
                                                            color: 'white'
                                                        }}
                                                        onMouseEnter={(e) => {
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
                                                        {isOverdue && (
                                                            <span className="mr-0.5 flex-shrink-0 w-3 h-3" title="逾期">
                                                                <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
                                                                    <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="3" fill="none" strokeDasharray="50 10" />
                                                                    <circle cx="12" cy="12" r="6" stroke="#4B5563" strokeWidth="2" fill="none" />
                                                                    <rect x="10" y="7" width="4" height="6" rx="2" fill="#ef4444" />
                                                                    <circle cx="12" cy="16" r="2" fill="#ef4444" />
                                                                </svg>
                                                            </span>
                                                        )}
                                                        {typeof meta?.priority === 'number' && (
                                                            <span className={`mr-1 flex-shrink-0 text-[8px] px-0.5 rounded ${meta.priority === 2 ? 'bg-red-500/80 text-white' :
                                                                meta.priority === 1 ? 'bg-yellow-500/80 text-white' :
                                                                    'bg-green-500/80 text-white'
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

            <div className="lg:col-span-2 h-full overflow-y-auto">
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
