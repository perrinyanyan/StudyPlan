import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { getApiUrl } from '../../config'
import { createPortal } from 'react-dom'

interface TaskTagSelectorProps {
    currentTags: string[]
    availableTags: string[]
    onSelect: (tags: string[]) => void
    onClose: () => void
    authHeaders: Record<string, string>
}

export function TaskTagSelector({ currentTags, availableTags, onSelect, onClose, authHeaders }: TaskTagSelectorProps) {
    const [position, setPosition] = useState<{ top: number, left: number } | null>(null)
    const anchorRef = useRef<HTMLDivElement>(null)
    const [newTag, setNewTag] = useState('')
    const [allTags, setAllTags] = useState<string[]>([])
    const [loading, setLoading] = useState(false)

    useLayoutEffect(() => {
        if (anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect()
            setPosition({
                top: rect.bottom + 4,
                left: rect.left
            })
        }
    }, [])

    useEffect(() => {
        async function fetchTags() {
            setLoading(true)
            try {
                const r = await fetch(getApiUrl('/tags'), { headers: authHeaders })
                const j = await r.json().catch(() => ({}))
                if (r.ok && Array.isArray(j.items)) {
                    const fetched = j.items.map((x: any) => x.name)
                    // Merge with availableTags (which might contain tags from current view not yet in DB if strictly local, though unlikely)
                    const merged = Array.from(new Set([...availableTags, ...fetched])).sort()
                    setAllTags(merged)
                } else {
                    setAllTags(availableTags)
                }
            } catch (e) {
                console.error(e)
                setAllTags(availableTags)
            } finally {
                setLoading(false)
            }
        }
        fetchTags()
    }, [availableTags]) // Re-fetch if availableTags changes? Or just once. availableTags usually comes from parent state.

    function toggleTag(tag: string) {
        if (currentTags.includes(tag)) {
            onSelect(currentTags.filter(t => t !== tag))
        } else {
            onSelect([...currentTags, tag])
        }
    }

    async function handleCreate() {
        const trimmed = newTag.trim()
        if (!trimmed) return

        // Optimistic update
        if (!currentTags.includes(trimmed)) {
            onSelect([...currentTags, trimmed])
        }

        // Try to create on backend if it doesn't exist
        if (!allTags.includes(trimmed)) {
            try {
                await fetch(getApiUrl('/tags'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders },
                    body: JSON.stringify({ name: trimmed }),
                })
                // We don't strictly need to wait or handle error for the UI to be responsive, 
                // as the tag is already added to the task.
            } catch (e) {
                console.error('Failed to create tag', e)
            }
        }

        setNewTag('')
    }

    const content = (
        <div
            className="fixed z-[9999] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-100"
            style={{
                top: position?.top,
                left: position?.left,
                width: '14rem',
                maxHeight: '16rem'
            }}
            onClick={e => e.stopPropagation()}
        >
            <div className="p-2 border-b border-slate-700">
                <input
                    autoFocus
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    placeholder="搜索或新建标签..."
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleCreate()
                        if (e.key === 'Escape') onClose()
                    }}
                />
            </div>

            <div className="overflow-y-auto flex-1 py-1">
                {loading && allTags.length === 0 ? (
                    <div className="p-2 text-center text-xs text-slate-500">加载中...</div>
                ) : (
                    allTags.map(tag => (
                        <button
                            key={tag}
                            className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2"
                            onClick={() => toggleTag(tag)}
                        >
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${currentTags.includes(tag) ? 'bg-blue-500 border-blue-500' : 'border-slate-500'}`}>
                                {currentTags.includes(tag) && <span className="material-symbols-outlined text-[10px] text-white">check</span>}
                            </div>
                            <span className="text-xs text-slate-200 truncate">{tag}</span>
                        </button>
                    ))
                )}

                {newTag && !allTags.includes(newTag) && (
                    <button
                        className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 text-blue-400"
                        onClick={handleCreate}
                    >
                        <span className="material-symbols-outlined text-xs">add</span>
                        <span className="text-xs truncate">创建 "{newTag}"</span>
                    </button>
                )}
                {!loading && allTags.length === 0 && !newTag && (
                    <div className="p-2 text-center text-xs text-slate-500">无可用标签</div>
                )}
            </div>
        </div>
    )

    return (
        <>
            <div ref={anchorRef} className="absolute top-full left-0 w-px h-px -mt-px opacity-0 pointer-events-none" />
            {position && createPortal(content, document.body)}
            <div className="fixed inset-0 z-[9998]" onClick={(e) => {
                e.stopPropagation()
                onClose()
            }} />
        </>
    )
}
