import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ActionMenu, ActionMenuItem } from '../ui/ActionMenu';

interface School {
    id: string;
    name: string;
}

export function SchoolManagement() {
    const { jwt, profile } = useAuth();
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingSchool, setEditingSchool] = useState<School | null>(null);
    const [name, setName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const isSystemAdmin = profile?.role === 'system_admin';

    useEffect(() => {
        if (jwt) fetchSchools();
    }, [jwt]);

    async function fetchSchools() {
        try {
            const res = await fetch('http://localhost:3000/admin/schools', {
                headers: { Authorization: `Bearer ${jwt}` },
            });
            if (!res.ok) throw new Error('获取学校列表失败');
            const data = await res.json();
            setSchools(data.schools);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            const url = editingSchool
                ? `http://localhost:3000/admin/schools/${editingSchool.id}`
                : 'http://localhost:3000/admin/schools';
            const method = editingSchool ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify({ name }),
            });

            if (!res.ok) throw new Error('保存学校失败');

            setShowModal(false);
            setName('');
            setEditingSchool(null);
            fetchSchools();
        } catch (err: any) {
            alert(err.message);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('确定要删除吗？')) return;
        try {
            const res = await fetch(`http://localhost:3000/admin/schools/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${jwt}` },
            });
            if (!res.ok) throw new Error('删除学校失败');
            fetchSchools();
        } catch (err: any) {
            alert(err.message);
        }
    }

    const filteredSchools = schools.filter(school =>
        school.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div>加载中...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">学校管理</h2>
                {isSystemAdmin && (
                    <button
                        onClick={() => {
                            setEditingSchool(null);
                            setName('');
                            setShowModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                    >
                        添加学校
                    </button>
                )}
            </div>

            <div className="flex gap-4 mb-4">
                <div className="relative flex-1 max-w-md">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <span className="material-symbols-outlined text-sm">search</span>
                    </span>
                    <input
                        type="text"
                        placeholder="搜索学校..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#1A2633] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            <div className="bg-[#1A2633] rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-white/5 text-xs uppercase font-semibold text-slate-400">
                        <tr>
                            <th className="px-6 py-4">学校名称</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredSchools.map((school) => (
                            <tr key={school.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-medium text-white">{school.name}</td>
                                <td className="px-6 py-4 text-right">
                                    <ActionMenu>
                                        {isSystemAdmin && (
                                            <ActionMenuItem
                                                onClick={() => {
                                                    setEditingSchool(school);
                                                    setName(school.name);
                                                    setShowModal(true);
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                                编辑
                                            </ActionMenuItem>
                                        )}
                                        <ActionMenuItem
                                            onClick={() => window.location.hash = `#/admin/classes?school_id=${school.id}`}
                                        >
                                            <span className="material-symbols-outlined text-lg">school</span>
                                            管理班级
                                        </ActionMenuItem>
                                        {isSystemAdmin && (
                                            <ActionMenuItem
                                                danger
                                                onClick={() => handleDelete(school.id)}
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                                删除
                                            </ActionMenuItem>
                                        )}
                                    </ActionMenu>
                                </td>
                            </tr>
                        ))}
                        {filteredSchools.length === 0 && (
                            <tr>
                                <td colSpan={2} className="px-6 py-8 text-center text-slate-500">
                                    未找到匹配 "{searchTerm}" 的学校
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-[#1A2633] border border-white/10 rounded-xl shadow-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">
                            {editingSchool ? '编辑学校' : '添加学校'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">名称</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm text-slate-300 hover:text-white"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded font-medium"
                                >
                                    保存
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
