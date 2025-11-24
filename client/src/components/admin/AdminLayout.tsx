import React from 'react';

interface AdminLayoutProps {
    currentPath: string;
    children: React.ReactNode;
}

export function AdminLayout({ currentPath, children }: AdminLayoutProps) {
    const navItems = [
        { label: 'Schools', path: '/admin/schools' },
        { label: 'Classes', path: '/admin/classes' },
        { label: 'Users', path: '/admin/users' },
        { label: 'Roles', path: '/admin/roles' },
    ];

    return (
        <div className="flex h-screen bg-[#0b1020] text-slate-300">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/10 bg-[#0f172a] flex flex-col fixed inset-y-0 left-0 z-10">
                <div className="p-6 border-b border-white/10">
                    <h1 className="text-xl font-bold text-white">Admin Panel</h1>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                        <a
                            key={item.path}
                            href={`#${item.path}`}
                            className={`block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPath === item.path
                                    ? 'bg-blue-600 text-white'
                                    : 'hover:bg-white/5 text-slate-400 hover:text-white'
                                }`}
                        >
                            {item.label}
                        </a>
                    ))}
                </nav>
                <div className="p-4 border-t border-white/10">
                    <a href="#/planner" className="block px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg">
                        Back to Planner
                    </a>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto ml-64">
                <div className="p-8 max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
