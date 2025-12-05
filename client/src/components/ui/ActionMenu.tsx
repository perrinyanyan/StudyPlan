import { useState, useRef, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

const MenuContext = createContext<{ close: () => void }>({ close: () => { } });

interface ActionMenuProps {
    children: React.ReactNode;
}

export function ActionMenu({ children }: ActionMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const [openUp, setOpenUp] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                menuRef.current && !menuRef.current.contains(event.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        function handleScroll() {
            if (isOpen) setIsOpen(false);
        }

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isOpen]);

    const close = () => setIsOpen(false);

    const toggle = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const shouldOpenUp = spaceBelow < 200; // Threshold for opening upwards

            setMenuStyle({
                top: shouldOpenUp ? rect.top - 4 : rect.bottom + 4,
                left: rect.right,
            });
            setOpenUp(shouldOpenUp);
        }
        setIsOpen(!isOpen);
    };

    return (
        <MenuContext.Provider value={{ close }}>
            <div className="relative inline-block">
                <button
                    ref={buttonRef}
                    onClick={toggle}
                    className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined text-xl">more_vert</span>
                </button>

                {isOpen && createPortal(
                    <div
                        ref={menuRef}
                        className={`fixed w-36 bg-[#1A2633] border border-white/10 rounded-lg shadow-xl z-[9999] overflow-hidden py-1 -translate-x-full ${openUp ? '-translate-y-full' : ''}`}
                        style={menuStyle}
                    >
                        {children}
                    </div>,
                    document.body
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
