import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { TaskTypeSelector } from './TaskTypeSelector'
import { TaskTagSelector } from './TaskTagSelector'
import { TaskPrioritySelector } from './TaskPrioritySelector'
import type { Task } from '../../types'

interface TaskHoverCardProps {
    task: any // Merged task + block info
    position: { x: number, y: number } | null
    onClose: () => void
    onMouseEnter?: () => void
    onMouseLeave?: () => void
    actions: {
        updateTaskMeta?: (id: string, updates: any) => Promise<any>
        updateTaskAdvanced?: (id: string, updates: any) => Promise<any>
        updateBlock?: (id: string, updates: any) => Promise<boolean>
        deleteTask?: (id: string) => Promise<void>
        completeTask?: (id: string) => Promise<void>
        deleteBlock?: (id: string) => Promise<void>
        setEditTask?: (task: any) => void
        headers?: () => Record<string, string>
        createTaskAdvanced?: (task: any) => Promise<any>
        setCenterAlert?: (alert: any) => void
    }
    options: {
        listTypeOptions?: string[]
        listTagOptions?: string[]
    }
}

export function TaskHoverCard({
    task,
    position,
    onClose,
    onMouseEnter,
    onMouseLeave,
    actions,
    options
}: TaskHoverCardProps) {
    const [editingCell, setEditingCell] = useState<{ field: string, value: any } | null>(null)
    const [cardMenuOpen, setCardMenuOpen] = useState(false)
    const [optimisticTask, setOptimisticTask] = useState(task)

    useEffect(() => {
        setOptimisticTask(task)
    }, [task])

    if (!optimisticTask || !position) return null

    const handleSave = async (field: string, value: any, extras?: any) => {
        const taskId = String(optimisticTask.id)
        const blockId = optimisticTask.blockId ? String(optimisticTask.blockId) : null

        // Optimistic update
        const newTask = { ...optimisticTask }
        if (field === 'title') newTask.title = value
        if (field === 'priority') newTask.priority = value
        if (field === 'type') {
            newTask.type = value
            if (extras?.color) newTask.color = extras.color
        }
        if (field === 'tags') newTask.tags = value

        if (field === 'time') {
            // value is { startStr: "HH:mm", endStr: "HH:mm" }
            const { startStr, endStr } = value
            const getDateWithTime = (baseDate: Date, timeStr: string) => {
                const [h, m] = timeStr.split(':').map(Number)
                if (isNaN(h) || isNaN(m)) return null
                const d = new Date(baseDate)
                d.setHours(h)
                d.setMinutes(m)
                d.setSeconds(0)
                d.setMilliseconds(0)
                return d
            }
            const baseDate = new Date(optimisticTask.blockStart)
            const newStart = getDateWithTime(baseDate, startStr)
            const newEnd = getDateWithTime(baseDate, endStr)
            if (newStart && newEnd) {
                newTask.blockStart = newStart.toISOString()
                newTask.blockEnd = newEnd.toISOString()
            }
        }
        setOptimisticTask(newTask)
        setEditingCell(null)

        // API calls
        if (field === 'title') {
            if (actions.updateTaskAdvanced) {
                await actions.updateTaskAdvanced(taskId, { title: value })
            }
        } else if (field === 'time') {
            if (blockId && actions.updateBlock) {
                // value is { startStr: "HH:mm", endStr: "HH:mm" }
                const { startStr, endStr } = value
                const getDateWithTime = (baseDate: Date, timeStr: string) => {
                    const [h, m] = timeStr.split(':').map(Number)
                    if (isNaN(h) || isNaN(m)) return null
                    const d = new Date(baseDate)
                    d.setHours(h)
                    d.setMinutes(m)
                    d.setSeconds(0)
                    d.setMilliseconds(0)
                    return d
                }
                const baseDate = new Date(optimisticTask.blockStart)
                const newStart = getDateWithTime(baseDate, startStr)
                const newEnd = getDateWithTime(baseDate, endStr)
                if (newStart && newEnd) {
                    await actions.updateBlock(blockId, { start_at: newStart.toISOString(), end_at: newEnd.toISOString() })
                }
            }
        } else {
            // Meta fields
            if (actions.updateTaskMeta) {
                const updates: any = {}
                if (field === 'priority') updates.priority = value
                if (field === 'type') {
                    updates.type = value
                    if (extras?.color) updates.color = extras.color
                }
                if (field === 'tags') updates.tags = value
                await actions.updateTaskMeta(taskId, updates)
            }
        }
    }

    const handleCopyToPool = async () => {
        if (!actions.createTaskAdvanced || !optimisticTask) return
        const payload = {
            title: optimisticTask.title,
            type: optimisticTask.type,
            color: optimisticTask.color,
            priority: optimisticTask.priority,
            tags: optimisticTask.tags,
            recurrence_rule: 'POOL',
            estimate_min: optimisticTask.estimate_min,
        }
        await actions.createTaskAdvanced(payload)
        if (actions.setCenterAlert) {
            actions.setCenterAlert({ title: '已复制到任务池', detail: `任务 "${optimisticTask.title}" 已复制到任务池` })
        }
        setCardMenuOpen(false)
        onClose()
    }

    const fmt = (d: string | Date) => {
        const date = new Date(d)
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }

    return createPortal(
        <div
            className="fixed z-50 w-80 p-0 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-visible"
            style={{
                top: Math.min(position.y, window.innerHeight - 200),
                left: Math.min(position.x, window.innerWidth - 340),
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={(e) => {
                if (editingCell) {
                    handleSave(editingCell.field, editingCell.value)
                }
                onMouseLeave?.()
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="bg-white/5 p-3">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: (optimisticTask.color || '#4B5563') + '80' }}></div>
                    <div className="flex-1 space-y-1.5">
                        {/* Title */}
                        {editingCell?.field === 'title' ? (
                            <input
                                autoFocus
                                className="bg-slate-700 text-white text-sm px-1 py-0.5 rounded w-full"
                                value={editingCell.value}
                                onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                                onBlur={() => handleSave('title', editingCell.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSave('title', editingCell.value)
                                    if (e.key === 'Escape') setEditingCell(null)
                                }}
                            />
                        ) : (
                            <p
                                className="text-white text-sm font-medium leading-tight cursor-pointer hover:underline decoration-dashed decoration-slate-500"
                                onDoubleClick={() => setEditingCell({ field: 'title', value: optimisticTask.title })}
                            >
                                {optimisticTask.title}
                            </p>
                        )}

                        {/* Time */}
                        {optimisticTask.blockStart && optimisticTask.blockEnd && (
                            editingCell?.field === 'time' ? (
                                <div
                                    className="flex items-center gap-1 bg-slate-800 rounded px-1 py-0.5"
                                    onBlur={(e) => {
                                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                            handleSave('time', editingCell.value)
                                        }
                                    }}
                                >
                                    <input
                                        type="time"
                                        className="bg-transparent text-white text-xs p-0 border-none focus:ring-0 w-[46px] h-5 leading-none [&::-webkit-calendar-picker-indicator]:hidden text-center"
                                        value={editingCell.value.startStr}
                                        onChange={e => setEditingCell({
                                            ...editingCell,
                                            value: { ...editingCell.value, startStr: e.target.value }
                                        })}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                handleSave('time', editingCell.value)
                                            }
                                            if (e.key === 'Escape') setEditingCell(null)
                                        }}
                                    />
                                    <span className="text-xs text-slate-400">-</span>
                                    <input
                                        type="time"
                                        className="bg-transparent text-white text-xs p-0 border-none focus:ring-0 w-[46px] h-5 leading-none [&::-webkit-calendar-picker-indicator]:hidden text-center"
                                        value={editingCell.value.endStr}
                                        onChange={e => setEditingCell({
                                            ...editingCell,
                                            value: { ...editingCell.value, endStr: e.target.value }
                                        })}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                handleSave('time', editingCell.value)
                                            }
                                            if (e.key === 'Escape') setEditingCell(null)
                                        }}
                                    />
                                </div>
                            ) : (
                                <p
                                    className="text-xs text-white/60 font-mono cursor-pointer hover:underline decoration-dashed decoration-slate-500"
                                    onDoubleClick={() => setEditingCell({
                                        field: 'time',
                                        value: {
                                            startStr: fmt(optimisticTask.blockStart),
                                            endStr: fmt(optimisticTask.blockEnd)
                                        }
                                    })}
                                >
                                    {fmt(optimisticTask.blockStart)} - {fmt(optimisticTask.blockEnd)}
                                </p>
                            )
                        )}

                        <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-white/80">
                            {/* Type */}
                            {editingCell?.field === 'type' ? (
                                <div className="relative">
                                    <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: optimisticTask.color || '#9CA3AF' }}></span>
                                        <span>{editingCell.value}</span>
                                    </span>
                                    <TaskTypeSelector
                                        currentType={editingCell.value}
                                        onSelect={(type) => {
                                            handleSave('type', type.name, { color: type.color })
                                        }}
                                        onClose={() => setEditingCell(null)}
                                        authHeaders={actions.headers ? actions.headers() : {}}
                                    />
                                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setEditingCell(null) }} />
                                </div>
                            ) : (
                                optimisticTask.type ? (
                                    <span
                                        className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1 cursor-pointer hover:bg-slate-600"
                                        onDoubleClick={() => setEditingCell({ field: 'type', value: optimisticTask.type })}
                                    >
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: optimisticTask.color || '#9CA3AF' }}></span>
                                        <span>{optimisticTask.type}</span>
                                    </span>
                                ) : (
                                    <span
                                        className="text-[10px] text-slate-500 cursor-pointer hover:underline decoration-dashed decoration-slate-500"
                                        onDoubleClick={() => setEditingCell({ field: 'type', value: '' })}
                                    >
                                        无类型
                                    </span>
                                )
                            )}

                            {/* Priority */}
                            {editingCell?.field === 'priority' ? (
                                <div className="relative">
                                    {typeof optimisticTask.priority === 'number' ? (
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium ${optimisticTask.priority === 2 ? 'bg-red-500/20 text-red-300' :
                                            optimisticTask.priority === 1 ? 'bg-yellow-500/20 text-yellow-300' :
                                                'bg-green-500/20 text-green-300'
                                            }`}>
                                            {optimisticTask.priority === 2 ? '高' : optimisticTask.priority === 1 ? '中' : '低'}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium bg-slate-500/20 text-slate-300">无</span>
                                    )}
                                    <TaskPrioritySelector
                                        currentPriority={editingCell.value}
                                        onSelect={(val) => handleSave('priority', val)}
                                        onClose={() => setEditingCell(null)}
                                    />
                                </div>
                            ) : (
                                typeof optimisticTask.priority === 'number' ? (
                                    <span
                                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium cursor-pointer hover:opacity-80 ${optimisticTask.priority === 2
                                            ? 'bg-red-500/20 text-red-300'
                                            : optimisticTask.priority === 1
                                                ? 'bg-yellow-500/20 text-yellow-300'
                                                : 'bg-green-500/20 text-green-300'
                                            }`}
                                        onDoubleClick={() => setEditingCell({ field: 'priority', value: optimisticTask.priority })}
                                    >
                                        {optimisticTask.priority === 2 ? '高' : optimisticTask.priority === 1 ? '中' : '低'}
                                    </span>
                                ) : (
                                    <span
                                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium cursor-pointer hover:opacity-80 bg-slate-500/20 text-slate-300"
                                        onDoubleClick={() => setEditingCell({ field: 'priority', value: null })}
                                    >
                                        无
                                    </span>
                                )
                            )}

                            {/* Tags */}
                            {editingCell?.field === 'tags' ? (
                                <div className="relative">
                                    <div className="flex flex-wrap gap-1">
                                        {(editingCell.value as string[]).map((g: string) => (
                                            <span key={g} className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300">#{g}</span>
                                        ))}
                                        {(editingCell.value as string[]).length === 0 && <span className="text-gray-500 text-[10px]">#</span>}
                                    </div>
                                    <TaskTagSelector
                                        currentTags={editingCell.value as string[]}
                                        availableTags={options.listTagOptions || []}
                                        onSelect={(tags) => {
                                            setEditingCell({ ...editingCell, value: tags })
                                            handleSave('tags', tags)
                                        }}
                                        onClose={() => setEditingCell(null)}
                                        authHeaders={actions.headers ? actions.headers() : {}}
                                    />
                                </div>
                            ) : (
                                (optimisticTask.tags && optimisticTask.tags.length > 0) ? (
                                    optimisticTask.tags.map((g: string) => (
                                        <span
                                            key={g}
                                            className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300 cursor-pointer hover:bg-gray-500/30"
                                            onDoubleClick={() => setEditingCell({ field: 'tags', value: optimisticTask.tags })}
                                        >
                                            #{g}
                                        </span>
                                    ))
                                ) : (
                                    <span
                                        className="text-gray-500 text-[10px] cursor-pointer hover:underline decoration-dashed decoration-slate-600"
                                        onDoubleClick={() => setEditingCell({ field: 'tags', value: [] })}
                                    >
                                        #
                                    </span>
                                )
                            )}

                            {optimisticTask.status === 'done' && (
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
                            <div className="absolute right-0 top-full mt-1 w-28 rounded-md bg-slate-900 border border-slate-700 shadow-lg z-50">
                                <button
                                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800 text-white"
                                    onClick={() => {
                                        if (actions.setEditTask) actions.setEditTask(optimisticTask)
                                        setCardMenuOpen(false)
                                        onClose()
                                    }}
                                >
                                    修改
                                </button>
                                <button
                                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800 text-white"
                                    onClick={async () => {
                                        if (actions.completeTask && optimisticTask.id) await actions.completeTask(String(optimisticTask.id))
                                        setCardMenuOpen(false)
                                        onClose()
                                    }}
                                >
                                    完成
                                </button>
                                <button
                                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800 text-white"
                                    onClick={handleCopyToPool}
                                >
                                    到任务池
                                </button>
                                <button
                                    className="block w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-slate-800"
                                    onClick={async () => {
                                        if (actions.deleteTask && optimisticTask.id) await actions.deleteTask(String(optimisticTask.id))
                                        setCardMenuOpen(false)
                                        onClose()
                                    }}
                                >
                                    删除
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                {(optimisticTask.estimate_min || optimisticTask.due_at) && (
                    <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-4 text-[10px] text-slate-400">
                        {optimisticTask.estimate_min && (
                            <span>预估: {optimisticTask.estimate_min} 分钟</span>
                        )}
                        {optimisticTask.due_at && (
                            <span>截止: {new Date(optimisticTask.due_at).toLocaleString()}</span>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}
