import React from 'react';
import { useAuth } from '../../hooks/useAuth';

interface AdminLayoutProps {
    currentPath: string;
    children: React.ReactNode;
}

export function AdminLayout({ currentPath, children }: AdminLayoutProps) {
    const { profile } = useAuth();

    let navItems = [
        { label: '学校管理', path: '/admin/schools', roles: ['system_admin', 'school_admin'] },
        { label: '班级管理', path: '/admin/classes', roles: ['system_admin', 'school_admin', 'class_admin'] }, // Class admin might need this? User said "only User Management"
        { label: '用户管理', path: '/admin/users', roles: ['system_admin', 'school_admin', 'class_admin'] },
        { label: '角色管理', path: '/admin/roles', roles: ['system_admin', 'school_admin'] },
    ];

    // User request: Class Admin can ONLY see User Management
    if (profile?.role === 'class_admin') {
        navItems = navItems.filter(item => item.path === '/admin/users');
    } else if (profile?.role === 'school_admin') {
        // Hide School Management for School Admin
        navItems = navItems.filter(item => item.path !== '/admin/schools');
    } else if (profile?.role !== 'system_admin') {
        // Fallback for unknown roles
        navItems = [];
    }

    return (
        <div className="flex flex-col h-full min-h-screen bg-[#0b1020]">
            {/* Top Navigation */}
            <div className="bg-[#1A2633] border-b border-white/10 px-8 py-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-2xl font-bold text-white tracking-tight">管理后台</h1>
                    </div>
                    <nav className="flex space-x-2">
                        {navItems.map((item) => (
                            <a
                                key={item.path}
                                href={`#${item.path}`}
                                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${currentPath === item.path
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 translate-y-[-1px]'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                {item.label}
                            </a>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
