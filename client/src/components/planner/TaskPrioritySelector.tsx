import { useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

interface TaskPrioritySelectorProps {
    currentPriority: number | null
    onSelect: (priority: number | null) => void
    onClose: () => void
}

export function TaskPrioritySelector({ currentPriority, onSelect, onClose }: TaskPrioritySelectorProps) {
    const [position, setPosition] = useState<{ top: number, left: number } | null>(null)
    const anchorRef = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        if (anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect()
            setPosition({
                top: rect.bottom + 4,
                left: rect.left
            })
        }
    }, [])

    const options = [
        { value: 2, label: '高', color: 'text-red-400', bg: 'bg-red-500/20' },
        { value: 1, label: '中', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
        { value: 0, label: '低', color: 'text-green-400', bg: 'bg-green-500/20' },
    ]

    const content = (
        <div
            className="fixed z-[9999] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-100 overflow-hidden"
            style={{
                top: position?.top,
                left: position?.left,
                width: '8rem',
            }}
            onClick={e => e.stopPropagation()}
        >
            {options.map(opt => (
                <button
                    key={String(opt.value)}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2 transition-colors ${currentPriority === opt.value ? 'bg-slate-700/50' : ''}`}
                    onClick={() => onSelect(opt.value)}
                >
                    <span className={`w-2 h-2 rounded-full ${opt.bg.replace('/20', '')}`}></span>
                    <span className={`text-xs ${opt.color}`}>{opt.label}</span>
                    {currentPriority === opt.value && (
                        <span className="material-symbols-outlined text-[10px] text-white ml-auto">check</span>
                    )}
                </button>
            ))}
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
