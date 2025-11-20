import { useState, useRef } from 'react'
import { PlannerListView } from './PlannerListView'
import { todayStr } from '../../utils/datetime'

export interface PlannerMonthViewProps {
    state: any
    actions: any
}

export function PlannerMonthView({ state, actions }: PlannerMonthViewProps) {
    const {
        rangeBlocks, // This will hold the month's blocks
        now,
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
        deleteBlock,
        setListFilterType,
        setListFilterPriority,
        setListFilterTag,
        setListFilterOverdue,
        setListFilterDone,
        setListMenuOpenId,
    } = actions || {}

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
    const filteredBlocks = (rangeBlocks || []).filter((b: any) => {
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

    const weekDayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

    return (
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 lg:gap-6 h-[calc(100vh-180px)]">
            <div className="lg:col-span-4 h-full flex flex-col">
                <section className="flex-1 flex flex-col rounded-xl border border-white/10 bg-slate-800/50 overflow-hidden">
                    {/* Filters Toolbar */}
                    <div className="bg-black/20 backdrop-blur-sm p-3 border-b border-white/10">
                        <div className="flex flex-wrap items-center gap-3 text-white/90 text-sm">
                            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                                <span className="text-xs text-white/70">类型</span>
                                <select
                                    className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                                    value={listFilterType}
                                    onChange={(e) => setListFilterType && setListFilterType(e.target.value)}
                                >
                                    <option value="all" className="text-slate-900">所有</option>
                                    {(listTypeOptions || []).map((name: string) => (
                                        <option key={name} value={name} className="text-slate-900">{name}</option>
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
                                    <option value="all" className="text-slate-900">所有</option>
                                    <option value="2" className="text-slate-900">高</option>
                                    <option value="1" className="text-slate-900">中</option>
                                    <option value="0" className="text-slate-900">低</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                                <span className="text-xs text-white/70">标签</span>
                                <select
                                    className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                                    value={listFilterTag}
                                    onChange={(e) => setListFilterTag && setListFilterTag(e.target.value)}
                                >
                                    <option value="all" className="text-slate-900">所有</option>
                                    {(listTagOptions || []).map((name: string) => (
                                        <option key={name} value={name} className="text-slate-900">{name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                                <span className="text-xs text-white/70">完成</span>
                                <select
                                    className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                                    value={listFilterDone}
                                    onChange={(e) => setListFilterDone && setListFilterDone(e.target.value as any)}
                                >
                                    <option value="all" className="text-slate-900">所有</option>
                                    <option value="done" className="text-slate-900">已完成</option>
                                    <option value="open" className="text-slate-900">未完成</option>
                                </select>
                            </div>
                        </div>
                    </div>

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

                                                return (
                                                    <div
                                                        key={b.id}
                                                        className="text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 flex items-center"
                                                        style={{
                                                            backgroundColor: baseColor + '1A',
                                                            borderLeft: `2px solid ${baseColor}`,
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
                                                        {isOverdue && (
                                                            <span className="mr-1 flex-shrink-0 flex items-center justify-center w-2.5 h-2.5 rounded-full bg-red-500 border border-white text-white text-[8px] font-bold leading-none">!</span>
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
