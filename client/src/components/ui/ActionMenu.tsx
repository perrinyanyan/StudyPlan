import { useState, useRef, useEffect, createContext, useContext } from 'react';

const MenuContext = createContext<{ close: () => void }>({ close: () => { } });

interface ActionMenuProps {
    children: React.ReactNode;
}

export function ActionMenu({ children }: ActionMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const close = () => setIsOpen(false);

    return (
        <MenuContext.Provider value={{ close }}>
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined text-xl">more_vert</span>
                </button>

                {isOpen && (
                    <div className="absolute right-0 mt-1 w-36 bg-[#1A2633] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden py-1">
                        {children}
                    </div>
                )}
            </div>
        </MenuContext.Provider>
    );
}

interface ActionMenuItemProps {
    onClick: () => void;
    children: React.ReactNode;
    danger?: boolean;
}

export function ActionMenuItem({ onClick, children, danger }: ActionMenuItemProps) {
    const { close } = useContext(MenuContext);
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onClick();
                close();
            }}
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-white/5 transition-colors ${danger ? 'text-red-400 hover:text-red-300' : 'text-slate-300 hover:text-white'
                }`}
        >
            {children}
        </button>
    );
}
