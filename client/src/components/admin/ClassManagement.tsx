import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ActionMenu, ActionMenuItem } from '../ui/ActionMenu';

interface Class {
    id: string;
    name: string;
    school_id: string;
    student_count?: number;
}

interface School {
    id: string;
    name: string;
}

interface User {
    id: string;
    email: string;
    nickname: string;
}

export function ClassManagement() {
    const { jwt, profile } = useAuth();
    const [classes, setClasses] = useState<Class[]>([]);
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingClass, setEditingClass] = useState<Class | null>(null);
    const [name, setName] = useState('');
    const [schoolId, setSchoolId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Filter state
    const [filterSchoolId, setFilterSchoolId] = useState('');

    // Student Management Modal
    const [showMembersModal, setShowMembersModal] = useState(false);
    const [selectedClass, setSelectedClass] = useState<Class | null>(null);
    const [classMembers, setClassMembers] = useState<User[]>([]);
    const [memberLoading, setMemberLoading] = useState(false);
    const [newStudentEmail, setNewStudentEmail] = useState('');
    const [allUsers, setAllUsers] = useState<User[]>([]); // For searching to add

    const canManageClasses = profile?.role === 'system_admin' || profile?.role === 'school_admin';

    useEffect(() => {
        // Parse school_id from hash URL: #/admin/classes?school_id=...
        const hash = window.location.hash;
        if (hash.includes('?')) {
            const query = new URLSearchParams(hash.split('?')[1]);
            const sid = query.get('school_id');
            if (sid) setFilterSchoolId(sid);
        }
        if (jwt) fetchData();
    }, [jwt]);

    async function fetchData() {
        try {
            const [cRes, sRes] = await Promise.all([
                fetch('http://localhost:3000/admin/classes', { headers: { Authorization: `Bearer ${jwt}` } }),
                fetch('http://localhost:3000/admin/schools', { headers: { Authorization: `Bearer ${jwt}` } }),
            ]);

            if (!cRes.ok) throw new Error('获取班级列表失败');
            // sRes might fail if user is class_admin (no access to schools list?), but let's see.
            // Actually, Class Admin needs school name for display. 
            // If backend restricts GET /schools for Class Admin, this will fail.
            // Let's assume backend allows listing schools if needed or returns empty.
            // Current backend `GET /schools` restricts to System/School Admin. 
            // So Class Admin will get 403 on schools.
            // We should handle that gracefully.

            let cData = { classes: [] };
            if (cRes.ok) cData = await cRes.json();

            let sData = { schools: [] };
            if (sRes.ok) sData = await sRes.json();

            setClasses(cData.classes);
            setSchools(sData.schools);
        } catch (err: any) {
            // If fetch fails (e.g. 403 on schools), we might still have classes
            console.error(err);
            // Don't block UI if just schools failed
        } finally {
            setLoading(false);
        }
    }

    async function fetchClassMembers(classId: string) {
        setMemberLoading(true);
        try {
            // Fetch users filtered by class_id
            const res = await fetch(`http://localhost:3000/admin/users?class_id=${classId}`, {
                headers: { Authorization: `Bearer ${jwt}` }
            });
            if (!res.ok) throw new Error('获取成员列表失败');
            const data = await res.json();
            setClassMembers(data.users);
        } catch (err: any) {
            alert(err.message);
        } finally {
            setMemberLoading(false);
        }
    }

    async function fetchAllUsers() {
        // Fetch all users for the "Add Student" dropdown/search
        if (allUsers.length > 0) return;
        try {
            const res = await fetch('http://localhost:3000/admin/users', {
                headers: { Authorization: `Bearer ${jwt}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAllUsers(data.users);
            }
        } catch (e) { console.error(e); }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            const url = editingClass
                ? `http://localhost:3000/admin/classes/${editingClass.id}`
                : 'http://localhost:3000/admin/classes';
            const method = editingClass ? 'PUT' : 'POST';
            const body: any = { name };
            if (!editingClass) body.school_id = schoolId;

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error('保存班级失败');

            setShowModal(false);
            setName('');
            setSchoolId('');
            setEditingClass(null);
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('确定要删除吗？')) return;
        try {
            const res = await fetch(`http://localhost:3000/admin/classes/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${jwt}` },
            });
            if (!res.ok) throw new Error('删除班级失败');
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    }

    async function handleAddStudent(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedClass) return;

        // Find user by email
        const user = allUsers.find(u => u.email === newStudentEmail || u.nickname === newStudentEmail);
        if (!user) {
            alert('未找到用户。请输入准确的邮箱或昵称。');
            return;
        }

        try {
            const res = await fetch(`http://localhost:3000/admin/users/${user.id}/roles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify({
                    role: 'student',
                    scope_id: selectedClass.id
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '添加学生失败');
            }

            setNewStudentEmail('');
            fetchClassMembers(selectedClass.id);
        } catch (err: any) {
            alert(err.message);
        }
    }

    async function handleRemoveStudent(userId: string) {
        if (!selectedClass || !confirm('确定要从班级中移除该学生吗？')) return;
        try {
            const res = await fetch(`http://localhost:3000/admin/users/${userId}/roles`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify({
                    role: 'student',
                    scope_id: selectedClass.id
                })
            });

            if (!res.ok) throw new Error('移除学生失败');
            fetchClassMembers(selectedClass.id);
        } catch (err: any) {
            alert(err.message);
        }
    }

    const filteredClasses = classes.filter(cls => {
        if (filterSchoolId && cls.school_id !== filterSchoolId) return false;
        const school = schools.find(s => s.id === cls.school_id);
        const schoolName = school?.name || '';
        const searchLower = searchTerm.toLowerCase();
        return cls.name.toLowerCase().includes(searchLower) || schoolName.toLowerCase().includes(searchLower);
    });

    if (loading) return <div>加载中...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">班级管理</h2>
                {canManageClasses && (
                    <button
                        onClick={() => {
                            setEditingClass(null);
                            setName('');
                            setSchoolId(filterSchoolId || ''); // Pre-select school if filtered
                            setShowModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                    >
                        添加班级
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
                        placeholder="搜索班级或学校..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#1A2633] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
                {filterSchoolId && (
                    <div className="flex items-center gap-2 bg-blue-900/30 text-blue-300 px-3 py-1 rounded-lg border border-blue-500/30">
                        <span>按学校筛选: {schools.find(s => s.id === filterSchoolId)?.name}</span>
                        <button onClick={() => setFilterSchoolId('')} className="hover:text-white">×</button>
                    </div>
                )}
            </div>

            <div className="bg-[#1A2633] rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-white/5 text-xs uppercase font-semibold text-slate-400">
                        <tr>
                            <th className="px-6 py-4">班级名称</th>
                            <th className="px-6 py-4">所属学校</th>
                            <th className="px-6 py-4 text-center">学生数</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredClasses.map((cls) => {
                            const school = schools.find(s => s.id === cls.school_id);
                            return (
                                <tr key={cls.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{cls.name}</td>
                                    <td className="px-6 py-4">{school?.name || '未知'}</td>
                                    <td className="px-6 py-4 text-center text-slate-400">{cls.student_count || 0}</td>
                                    <td className="px-6 py-4 text-right">
                                        <ActionMenu>
                                            <ActionMenuItem
                                                onClick={() => {
                                                    setSelectedClass(cls);
                                                    fetchClassMembers(cls.id);
                                                    fetchAllUsers();
                                                    setShowMembersModal(true);
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-lg">group</span>
                                                学生管理
                                            </ActionMenuItem>
                                            {canManageClasses && (
                                                <>
                                                    <ActionMenuItem
                                                        onClick={() => {
                                                            setEditingClass(cls);
                                                            setName(cls.name);
                                                            setSchoolId(cls.school_id);
                                                            setShowModal(true);
                                                        }}
                                                    >
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                        编辑
                                                    </ActionMenuItem>
                                                    <ActionMenuItem
                                                        danger
                                                        onClick={() => handleDelete(cls.id)}
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                        删除
                                                    </ActionMenuItem>
                                                </>
                                            )}
                                        </ActionMenu>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredClasses.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    未找到匹配 "{searchTerm}" 的班级
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
                            {editingClass ? '编辑班级' : '添加班级'}
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
                            {!editingClass && (
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">所属学校</label>
                                    <select
                                        value={schoolId}
                                        onChange={(e) => setSchoolId(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                        required
                                        disabled={!!filterSchoolId}
                                    >
                                        <option value="">-- 选择学校 --</option>
                                        {schools.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
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

            {/* Members Modal */}
            {showMembersModal && selectedClass && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-lg bg-[#1A2633] border border-white/10 rounded-xl shadow-2xl p-6 flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">
                                {selectedClass.name} 的学生
                            </h3>
                            <button onClick={() => setShowMembersModal(false)} className="text-slate-400 hover:text-white">×</button>
                        </div>

                        <form onSubmit={handleAddStudent} className="flex gap-2 mb-4">
                            <input
                                type="text"
                                placeholder="输入邮箱或昵称添加..."
                                value={newStudentEmail}
                                onChange={e => setNewStudentEmail(e.target.value)}
                                className="flex-1 bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                list="user-suggestions"
                            />
                            <datalist id="user-suggestions">
                                {allUsers.slice(0, 10).map(u => (
                                    <option key={u.id} value={u.email} />
                                ))}
                            </datalist>
                            <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm">
                                添加
                            </button>
                        </form>

                        <div className="flex-1 overflow-y-auto border border-white/5 rounded bg-black/20">
                            {memberLoading ? (
                                <div className="p-4 text-center text-slate-400">加载中...</div>
                            ) : (
                                <table className="w-full text-left text-sm text-slate-300">
                                    <thead className="bg-white/5 text-xs sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2">昵称</th>
                                            <th className="px-4 py-2">邮箱</th>
                                            <th className="px-4 py-2 text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {classMembers.map(user => (
                                            <tr key={user.id}>
                                                <td className="px-4 py-2">{user.nickname}</td>
                                                <td className="px-4 py-2">{user.email}</td>
                                                <td className="px-4 py-2 text-right">
                                                    <button
                                                        onClick={() => handleRemoveStudent(user.id)}
                                                        className="text-red-400 hover:text-red-300 text-xs"
                                                    >
                                                        移除
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {classMembers.length === 0 && (
                                            <tr><td colSpan={3} className="p-4 text-center text-slate-500">该班级暂无学生</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
