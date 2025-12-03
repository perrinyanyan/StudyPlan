import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

interface TaskType {
    id: string
    name: string
    color: string
}

interface TaskTypeSelectorProps {
    currentType?: string
    onSelect: (type: TaskType) => void
    onClose: () => void
    authHeaders: Record<string, string>
}

export function TaskTypeSelector({ currentType, onSelect, onClose, authHeaders }: TaskTypeSelectorProps) {
    const [types, setTypes] = useState<TaskType[]>([])
    const [loading, setLoading] = useState(false)
    const [view, setView] = useState<'list' | 'create'>('list')
    const [position, setPosition] = useState<{ top: number, left: number } | null>(null)
    const anchorRef = useRef<HTMLDivElement>(null)

    // Create state
    const [newTypeName, setNewTypeName] = useState('')
    const [newTypeColor, setNewTypeColor] = useState('#F87171')

    const TYPE_COLOR_OPTIONS = [
        '#F87171', // Red
        '#FB923C', // Orange
        '#FACC15', // Yellow
        '#4ADE80', // Green
        '#2DD4BF', // Teal
        '#60A5FA', // Blue
        '#818CF8', // Indigo
        '#A78BFA', // Purple
        '#F472B6', // Pink
    ]

    useEffect(() => {
        loadTypes()
    }, [])

    useLayoutEffect(() => {
        if (anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect()
            // Align with the anchor (which is placed inside the relative container)
            // We want it slightly below
            setPosition({
                top: rect.bottom + 4,
                left: rect.left
            })
        }
    }, [])

    async function loadTypes() {
        setLoading(true)
        try {
            const r = await fetch('/task-types', { headers: authHeaders })
            const j = await r.json().catch(() => ({}))
            if (r.ok && Array.isArray(j.items)) {
                setTypes(j.items.map((x: any) => ({
                    id: String(x.id),
                    name: String(x.name),
                    color: String(x.color)
                })))
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    async function handleCreate() {
        if (!newTypeName.trim()) return
        try {
            const r = await fetch('/task-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...authHeaders },
                body: JSON.stringify({ name: newTypeName.trim(), color: newTypeColor }),
            })
            const j = await r.json().catch(() => ({}))
            if (r.ok) {
                const newType = { id: String(j.id), name: newTypeName.trim(), color: newTypeColor }
                onSelect(newType)
            } else {
                alert('创建失败: ' + (j.error || r.status))
            }
        } catch (e) {
            alert('创建失败')
        }
    }

    const content = (
        <div
            className="fixed z-[9999] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-100"
            style={{
                top: position?.top,
                left: position?.left,
                width: view === 'create' ? '16rem' : '12rem',
                maxHeight: '16rem'
            }}
            onClick={e => e.stopPropagation()}
        >
            {view === 'create' ? (
                <div className="p-3 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                        <span className="text-xs font-medium text-white">新任务类型</span>
                        <button onClick={() => setView('list')} className="text-slate-400 hover:text-white">
                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                        </button>
                    </div>

                    <div className="space-y-2">
                        <input
                            autoFocus
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                            placeholder="类型名称"
                            value={newTypeName}
                            onChange={e => setNewTypeName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleCreate()
                                if (e.key === 'Escape') setView('list')
                            }}
                        />

                        <div className="flex flex-wrap gap-1.5">
                            {TYPE_COLOR_OPTIONS.map(c => (
                                <button
                                    key={c}
                                    className={`w-5 h-5 rounded-full border ${newTypeColor === c ? 'border-white ring-1 ring-blue-500' : 'border-transparent'}`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => setNewTypeColor(c)}
                                />
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleCreate}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-1.5 rounded"
                    >
                        创建并选择
                    </button>
                </div>
            ) : (
                <>
                    <div className="overflow-y-auto flex-1 py-1">
                        {loading ? (
                            <div className="p-2 text-center text-xs text-slate-500">加载中...</div>
                        ) : (
                            <>
                                {types.map(t => (
                                    <button
                                        key={t.id}
                                        className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2"
                                        onClick={() => onSelect(t)}
                                    >
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                                        <span className={`text-xs truncate ${t.name === currentType ? 'text-blue-400 font-medium' : 'text-slate-200'}`}>
                                            {t.name}
                                        </span>
                                        {t.name === currentType && (
                                            <span className="material-symbols-outlined text-xs text-blue-400 ml-auto">check</span>
                                        )}
                                    </button>
                                ))}
                                {types.length === 0 && (
                                    <div className="p-2 text-center text-xs text-slate-500">无类型</div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="border-t border-slate-700 pt-1 mt-1 px-1 pb-1">
                        <button
                            onClick={() => setView('create')}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                            <span className="text-xs">添加新类型</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    )

    return (
        <>
            <div ref={anchorRef} className="absolute top-full left-0 w-px h-px -mt-px opacity-0 pointer-events-none" />
            {position && createPortal(content, document.body)}
        </>
    )
}
