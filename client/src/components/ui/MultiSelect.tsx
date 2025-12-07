import React, { useState, useRef, useEffect } from 'react'

interface MultiSelectProps {
    label: string
    options: string[]
    value: string[]
    onChange: (value: string[]) => void
}

export function MultiSelect({ label, options, value, onChange }: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const toggleOption = (option: string) => {
        if (value.includes(option)) {
            onChange(value.filter(v => v !== option))
        } else {
            onChange([...value, option])
        }
    }

    const isAll = value.length === 0

    return (
        <div className="relative" ref={containerRef}>
            <div className="flex items-center gap-2">
                <span className="text-xs text-white/70">{label}</span>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500 min-w-[60px] text-left flex justify-between items-center gap-2"
                >
                    <span className="truncate max-w-[100px]">
                        {isAll ? "所有" : `${value.length}个已选`}
                    </span>
                    <span className="material-symbols-outlined text-[10px]">arrow_drop_down</span>
                </button>
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                    <div
                        className={`px-3 py-2 text-xs hover:bg-white/5 cursor-pointer flex items-center gap-2 ${isAll ? 'text-blue-400' : 'text-white'}`}
                        onClick={() => { onChange([]); setIsOpen(false); }}
                    >
                        <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${isAll ? 'border-blue-500 bg-blue-500/20' : 'border-white/30'}`}>
                            {isAll && <span className="material-symbols-outlined text-[10px]">check</span>}
                        </div>
                        所有
                    </div>
                    {options.map(opt => {
                        const selected = value.includes(opt)
                        return (
                            <div
                                key={opt}
                                className={`px-3 py-2 text-xs hover:bg-white/5 cursor-pointer flex items-center gap-2 ${selected ? 'text-white' : 'text-white/70'}`}
                                onClick={() => toggleOption(opt)}
                            >
                                <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${selected ? 'border-blue-500 bg-blue-500/20' : 'border-white/30'}`}>
                                    {selected && <span className="material-symbols-outlined text-[10px]">check</span>}
                                </div>
                                <span className="truncate">{opt}</span>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
