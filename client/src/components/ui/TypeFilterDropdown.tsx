import { useState, useRef, useEffect } from 'react'

interface TypeOption {
    name: string
    color: string
}

interface TypeFilterDropdownProps {
    value: string
    onChange: (value: string) => void
    options: TypeOption[]
    className?: string
}

export function TypeFilterDropdown({ value, onChange, options, className }: TypeFilterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const selectedOption = options.find(opt => opt.name === value)
    const displayLabel = value === 'all' ? '所有' : selectedOption?.name || value

    return (
        <div ref={dropdownRef} className={`relative ${className || ''}`}>
            <button
                type="button"
                className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500 flex items-center gap-1.5 min-w-[80px]"
                onClick={() => setIsOpen(!isOpen)}
            >
                {value !== 'all' && selectedOption && (
                    <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: selectedOption.color }}
                    />
                )}
                <span className="truncate">{displayLabel}</span>
                <span className="material-symbols-outlined text-xs ml-auto">
                    {isOpen ? 'expand_less' : 'expand_more'}
                </span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-full min-w-[100px] max-h-48 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
                    <button
                        type="button"
                        className={`w-full px-2 py-1.5 text-left text-xs hover:bg-slate-700 flex items-center gap-1.5 ${value === 'all' ? 'bg-slate-700' : ''}`}
                        onClick={() => {
                            onChange('all')
                            setIsOpen(false)
                        }}
                    >
                        所有
                    </button>
                    {options.map((opt) => (
                        <button
                            key={opt.name}
                            type="button"
                            className={`w-full px-2 py-1.5 text-left text-xs hover:bg-slate-700 flex items-center gap-1.5 ${value === opt.name ? 'bg-slate-700' : ''}`}
                            onClick={() => {
                                onChange(opt.name)
                                setIsOpen(false)
                            }}
                        >
                            <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: opt.color }}
                            />
                            <span className="truncate">{opt.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
