import { useState, useRef, useMemo } from 'react'
import { getConflictIds } from '../../utils/conflicts'
import { PlannerListView } from './PlannerListView'
import { TaskHoverCard } from './TaskHoverCard'
import type { Task } from '../../types'
import { toIso, todayStr } from '../../utils/datetime'
import { MultiSelect } from '../ui/MultiSelect'

export interface PlannerWeekViewProps {
    state: any
    actions: any
}

export function PlannerWeekView({ state, actions }: PlannerWeekViewProps) {
    const {
        tasks,
        unscheduled,
        rangeBlocks, // This will hold the week's blocks
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
    const weekDays = []
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

    const hourHeight = 40 // Fixed height for week view to save space
    const startHour = 6 // Start from 6 AM
    const endHour = 23 // End at 11 PM
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

    const [hoveredTask, setHoveredTask] = useState<any | null>(null)
    const [hoverPos, setHoverPos] = useState<{ x: number, y: number } | null>(null)
    const hoverTimeoutRef = useRef<any>(null)
    const [cardMenuOpen, setCardMenuOpen] = useState(false)

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

                    {/* Week Grid */}
                    <div className="flex-1 overflow-y-auto relative">
                        <div className="flex min-w-[800px]">
                            {/* Time Column */}
                            <div className="w-12 flex-shrink-0 border-r border-white/10 bg-slate-900 sticky left-0 z-20">
                                <div className="h-10 border-b border-white/10 bg-slate-900 sticky top-0 z-30"></div>
                                {hours.map(h => (
                                    <div key={h} className="h-[40px] border-b border-white/5 text-[10px] text-gray-500 flex items-start justify-center pt-1">
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
                                        <div className="relative bg-slate-900/50">
                                            {hours.map(h => (
                                                <div key={h} className="h-[40px] border-b border-white/5 relative group">
                                                    {/* Add button on hover */}
                                                    <button
                                                        className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 hover:bg-white/5 transition-opacity z-0"
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
                                                const bDate = new Date(b.start_at)
                                                return bDate.getDate() === dayDate.getDate() &&
                                                    bDate.getMonth() === dayDate.getMonth() &&
                                                    bDate.getFullYear() === dayDate.getFullYear()
                                            }).map((b: any) => {
                                                const s = new Date(b.start_at)
                                                const e = new Date(b.end_at)

                                                // Calculate position relative to startHour
                                                const startMin = (s.getHours() - startHour) * 60 + s.getMinutes()
                                                const endMin = (e.getHours() - startHour) * 60 + e.getMinutes()
                                                const duration = endMin - startMin

                                                if (endMin <= 0 || startMin >= (endHour - startHour + 1) * 60) return null

                                                const top = (startMin / 60) * 40
                                                const height = (duration / 60) * 40

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
                                                        className={`absolute left-0.5 right-0.5 rounded text-xs text-white overflow-hidden bg-slate-800/90 hover:bg-slate-800 hover:ring-1 hover:ring-blue-400/50 ${isCurrent
                                                            ? 'border-2 border-amber-400 shadow-lg shadow-amber-500/50 z-30 ring-2 ring-amber-400/30 animate-pulse'
                                                            : `border border-white/5 ${isMenuOpen ? 'z-50' : 'z-10'}`
                                                            }`}
                                                        style={{
                                                            top: Math.max(0, top),
                                                            height: Math.max(20, height),
                                                            borderColor: isCurrent ? undefined : baseColor,
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (setListMenuOpenId) setListMenuOpenId(isMenuOpen ? null : String(b.id))
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
            {hoveredTask && hoverPos && (
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
            )}
        </div>
    )
}
