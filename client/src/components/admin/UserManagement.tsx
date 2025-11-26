import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ActionMenu, ActionMenuItem } from '../ui/ActionMenu';

interface User {
    id: string;
    email: string;
    nickname: string;
    created_at: string;
    roles: {
        role: string;
        scope_type: string;
        scope_id: string | null;
        class_name?: string;
        school_name?: string;
    }[];
    primaryRole: string;
    last_sign_in_at?: string;
    avatar_url?: string;
}

function formatDate(dateStr?: string) {
    if (!dateStr) return '从未';
    return new Date(dateStr).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

interface School {
    id: string;
    name: string;
}

interface Class {
    id: string;
    name: string;
    school_id: string;
}

export function UserManagement() {
    const { jwt, profile } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [schools, setSchools] = useState<School[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // User Modal
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [userRole, setUserRole] = useState('student');
    const [userScopeType, setUserScopeType] = useState('class');
    const [userScopeId, setUserScopeId] = useState('');
    const [userSchoolId, setUserSchoolId] = useState('');

    // Role Modal
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [newRole, setNewRole] = useState('student');
    const [newScopeType, setNewScopeType] = useState('global');
    const [selectedSchoolId, setSelectedSchoolId] = useState('');
    const [newScopeId, setNewScopeId] = useState('');

    const isSystemAdmin = profile?.role === 'system_admin';
    const isSchoolAdmin = profile?.role === 'school_admin';
    const isClassAdmin = profile?.role === 'class_admin';

    useEffect(() => {
        if (jwt) fetchData();
    }, [jwt]);

    async function fetchData() {
        try {
            const headers = { Authorization: `Bearer ${jwt}` };

            const uRes = await fetch('http://localhost:3000/admin/users', { headers });
            if (!uRes.ok) throw new Error('获取用户列表失败');
            const uData = await uRes.json();
            setUsers(uData.users);

            try {
                const sRes = await fetch('http://localhost:3000/admin/schools', { headers });
                if (sRes.ok) {
                    const sData = await sRes.json();
                    setSchools(sData.schools);
                }
            } catch (e) { console.log('Schools fetch failed (expected for class_admin)', e); }

            try {
                const cRes = await fetch('http://localhost:3000/admin/classes', { headers });
                if (cRes.ok) {
                    const cData = await cRes.json();
                    setClasses(cData.classes);
                }
            } catch (e) { console.log('Classes fetch failed', e); }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleUserSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            const url = editingUser
                ? `http://localhost:3000/admin/users/${editingUser.id}`
                : 'http://localhost:3000/admin/users';
            const method = editingUser ? 'PUT' : 'POST';
            const body: any = { email, nickname };
            if (password) body.password = password;

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error('保存用户失败');
            const savedUser = await res.json();

            // Assign role if creating new user
            if (!editingUser && savedUser.id) {
                try {
                    let finalScopeId = userScopeId;
                    let finalScopeType = userScopeType;
                    let finalRole = userRole;

                    if (isClassAdmin) {
                        const classRole = profile?.roles?.find((r: any) => r.role === 'class_admin' && r.scope_type === 'class');
                        if (classRole?.scope_id) {
                            finalScopeId = classRole.scope_id;
                            finalScopeType = 'class';
                            finalRole = 'student';
                        }
                    }

                    if (finalRole && (finalRole !== 'student' || finalScopeId)) {
                        await fetch(`http://localhost:3000/admin/users/${savedUser.id}/roles`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${jwt}`,
                            },
                            body: JSON.stringify({
                                role: finalRole,
                                scope_type: finalScopeType,
                                scope_id: finalScopeId
                            })
                        });
                    }
                } catch (error) {
                    console.error('Error assigning role:', error);
                    alert('User created but failed to assign role');
                }
            }

            setPassword('');
            setNickname('');
            setEditingUser(null);
            setShowUserModal(false);
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    }

    async function handleDeleteUser(id: string) {
        if (!confirm('确定要删除吗？')) return;
        try {
            const res = await fetch(`http://localhost:3000/admin/users/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${jwt}` },
            });
            if (!res.ok) throw new Error('删除用户失败');
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    }

    async function handleRemoveRole(userId: string, role: string, scopeId: string | null) {
        if (!confirm('确定要移除该角色吗？')) return;

        try {
            const res = await fetch(`http://localhost:3000/admin/users/${userId}/roles`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify({ role, scope_id: scopeId })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '移除角色失败');
            }

            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    }

    async function handleAddRole() {
        if (!selectedUserId) return;
        if (newRole === 'student' && !newScopeId) {
            alert('学生角色需要选择班级');
            return;
        }

        try {
            const res = await fetch(`http://localhost:3000/admin/users/${selectedUserId}/roles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify({
                    role: newRole,
                    scope_type: newScopeType,
                    scope_id: newScopeId
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '添加角色失败');
            }

            setShowRoleModal(false);
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    }

    const filteredUsers = users.filter(user => {
        const searchLower = searchTerm.toLowerCase();
        return (
            user.nickname.toLowerCase().includes(searchLower) ||
            user.email.toLowerCase().includes(searchLower) ||
            user.roles.some(r => r.role.toLowerCase().includes(searchLower))
        );
    });

    if (loading) return <div>加载中...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">用户管理</h2>
                {(isSystemAdmin || isSchoolAdmin || isClassAdmin) && (
                    <button
                        onClick={() => {
                            setEditingUser(null);
                            setEmail('');
                            setPassword('');
                            setNickname('');
                            setUserRole('student');
                            setUserScopeType('class');
                            setUserScopeId('');
                            setUserSchoolId('');

                            if (isClassAdmin) {
                                const classRole = profile?.roles?.find((r: any) => r.role === 'class_admin' && r.scope_type === 'class');
                                if (classRole?.scope_id) {
                                    setUserScopeId(classRole.scope_id);
                                }
                            }

                            if (isSchoolAdmin && schools.length > 0) {
                                setUserSchoolId(schools[0].id);
                            }

                            setShowUserModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                    >
                        添加用户
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
                        placeholder="搜索用户姓名、邮箱或角色..."
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
                            <th className="px-6 py-4">昵称</th>
                            <th className="px-6 py-4">邮箱</th>
                            {isSystemAdmin && <th className="px-6 py-4">学校</th>}
                            {(isSystemAdmin || isSchoolAdmin) && <th className="px-6 py-4">班级</th>}
                            {!isClassAdmin && <th className="px-6 py-4">角色</th>}
                            <th className="px-6 py-4">上次活跃</th>
                            <th className="px-6 py-4 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-medium text-white">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex items-center justify-center shrink-0">
                                            {user.avatar_url ? (
                                                <img src={user.avatar_url} alt={user.nickname} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xs text-slate-300">{(user.nickname || user.email || '?')[0].toUpperCase()}</span>
                                            )}
                                        </div>
                                        <span>{user.nickname}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">{user.email}</td>
                                {isSystemAdmin && (
                                    <td className="px-6 py-4">
                                        {Array.from(new Set(user.roles.map(r => r.school_name).filter(Boolean))).join(', ') || '-'}
                                    </td>
                                )}
                                {(isSystemAdmin || isSchoolAdmin) && (
                                    <td className="px-6 py-4">
                                        {Array.from(new Set(user.roles.map(r => r.class_name).filter(Boolean))).join(', ') || '-'}
                                    </td>
                                )}
                                {!isClassAdmin && (
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-2">
                                            {user.roles.map((r, idx) => (
                                                <span
                                                    key={idx}
                                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${r.role === 'system_admin' ? 'bg-purple-900/30 border-purple-500/30 text-purple-300' :
                                                        r.role === 'school_admin' ? 'bg-blue-900/30 border-blue-500/30 text-blue-300' :
                                                            r.role === 'class_admin' ? 'bg-cyan-900/30 border-cyan-500/30 text-cyan-300' :
                                                                'bg-slate-700/50 border-slate-600 text-slate-300'
                                                        }`}
                                                >
                                                    {r.role}
                                                    {r.scope_type === 'school' && <span className="opacity-70">@学校</span>}
                                                    {r.scope_type === 'class' && <span className="opacity-70">@{r.class_name || '班级'}</span>}
                                                    {(isSystemAdmin || (isSchoolAdmin && user.roles.length > 1)) && (
                                                        <button
                                                            onClick={() => handleRemoveRole(user.id, r.role, r.scope_id)}
                                                            className="ml-1 hover:text-red-400"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </span>
                                            ))}
                                            <button
                                                onClick={() => {
                                                    setSelectedUserId(user.id);
                                                    setShowRoleModal(true);
                                                    setNewRole('student');
                                                    setNewScopeType('class');
                                                    setSelectedSchoolId('');
                                                    setNewScopeId('');
                                                }}
                                                className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1"
                                            >
                                                +
                                            </button>

                                        </div>
                                    </td>
                                )}
                                <td className="px-6 py-4 text-slate-400 text-xs">
                                    {formatDate(user.last_sign_in_at)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {(isSystemAdmin || isSchoolAdmin || isClassAdmin) && (
                                        <ActionMenu>
                                            <ActionMenuItem
                                                onClick={() => {
                                                    setEditingUser(user);
                                                    setEmail(user.email);
                                                    setNickname(user.nickname);
                                                    setPassword('');
                                                    setShowUserModal(true);
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                                编辑
                                            </ActionMenuItem>
                                            {(isSystemAdmin || isSchoolAdmin) && (
                                                <ActionMenuItem
                                                    danger
                                                    onClick={() => handleDeleteUser(user.id)}
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                    删除
                                                </ActionMenuItem>
                                            )}
                                        </ActionMenu>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    未找到匹配 "{searchTerm}" 的用户
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div >

            {/* User Modal */}
            {
                showUserModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                        <div className="w-full max-w-md bg-[#1A2633] border border-white/10 rounded-xl shadow-2xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">
                                {editingUser ? '编辑用户' : '添加用户'}
                            </h3>
                            <form onSubmit={handleUserSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">邮箱</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">昵称</label>
                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">密码 {editingUser && '(留空保持不变)'}</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                        required={!editingUser}
                                    />
                                </div>
                                {!editingUser && (
                                    <div className="space-y-3 pt-2 border-t border-white/10">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">角色</label>
                                            <select
                                                value={userRole}
                                                onChange={e => {
                                                    const r = e.target.value;
                                                    setUserRole(r);
                                                    setUserSchoolId('');
                                                    setUserScopeId('');
                                                    if (r === 'system_admin') setUserScopeType('global');
                                                    else if (r === 'school_admin') setUserScopeType('school');
                                                    else if (r === 'class_admin') setUserScopeType('class');
                                                    else if (r === 'student') setUserScopeType('class');
                                                }}
                                                disabled={isClassAdmin}
                                                className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50"
                                            >
                                                {isSystemAdmin && <option value="system_admin">系统管理员</option>}
                                                {(isSystemAdmin) && <option value="school_admin">学校管理员</option>}
                                                {(isSystemAdmin || isSchoolAdmin) && <option value="class_admin">班级管理员</option>}
                                                <option value="student">学生</option>
                                            </select>
                                        </div>

                                        {userRole === 'school_admin' && (
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1">选择学校</label>
                                                <select
                                                    value={userScopeId}
                                                    onChange={e => setUserScopeId(e.target.value)}
                                                    className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                                    required
                                                >
                                                    <option value="">-- 选择学校 --</option>
                                                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                        )}

                                        {(userRole === 'class_admin' || userRole === 'student') && (
                                            <>
                                                {schools.length > 0 && !isClassAdmin && (isSystemAdmin || schools.length > 1) && (
                                                    <div>
                                                        <label className="block text-xs text-slate-400 mb-1">选择学校</label>
                                                        <select
                                                            value={userSchoolId}
                                                            onChange={e => {
                                                                setUserSchoolId(e.target.value);
                                                                setUserScopeId('');
                                                            }}
                                                            className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                                        >
                                                            <option value="">-- 选择学校 --</option>
                                                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                        </select>
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="block text-xs text-slate-400 mb-1">选择班级</label>
                                                    <select
                                                        value={userScopeId}
                                                        onChange={e => setUserScopeId(e.target.value)}
                                                        disabled={isClassAdmin}
                                                        className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:opacity-50"
                                                        required
                                                    >
                                                        <option value="">-- 选择班级 --</option>
                                                        {classes
                                                            .filter(c => !userSchoolId || c.school_id === userSchoolId)
                                                            .map(c => (
                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                            ))}
                                                    </select>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowUserModal(false)}
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
                )
            }

            {/* Role Modal */}
            {
                showRoleModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                        <div className="w-full max-w-md bg-[#1A2633] border border-white/10 rounded-xl shadow-2xl p-6 space-y-4">
                            <h3 className="text-lg font-bold text-white">添加角色</h3>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">角色</label>
                                    <select
                                        value={newRole}
                                        onChange={e => {
                                            const r = e.target.value;
                                            setSelectedSchoolId('');
                                            setNewScopeId('');
                                            setNewRole(r);
                                            if (r === 'system_admin') setNewScopeType('global');
                                            else if (r === 'school_admin') setNewScopeType('school');
                                            else if (r === 'class_admin') setNewScopeType('class');
                                            else if (r === 'student') setNewScopeType('class');
                                        }}
                                        className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                    >
                                        {isSystemAdmin && <option value="system_admin">系统管理员</option>}
                                        {(isSystemAdmin) && <option value="school_admin">学校管理员</option>}
                                        {(isSystemAdmin || isSchoolAdmin) && <option value="class_admin">班级管理员</option>}
                                        <option value="student">学生</option>
                                    </select>
                                </div>

                                {newRole === 'school_admin' && (
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">选择学校</label>
                                        <select
                                            value={newScopeId}
                                            onChange={e => setNewScopeId(e.target.value)}
                                            className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                        >
                                            <option value="">-- 选择学校 --</option>
                                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                )}

                                {(newRole === 'class_admin' || newRole === 'student') && (
                                    <>
                                        {schools.length > 0 && (
                                            <div>
                                                <label className="block text-xs text-slate-400 mb-1">选择学校</label>
                                                <select
                                                    value={selectedSchoolId}
                                                    onChange={e => {
                                                        setSelectedSchoolId(e.target.value);
                                                        setNewScopeId('');
                                                    }}
                                                    className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                                >
                                                    <option value="">-- 选择学校 --</option>
                                                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">选择班级</label>
                                            <select
                                                value={newScopeId}
                                                onChange={e => setNewScopeId(e.target.value)}
                                                className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                            >
                                                <option value="">-- 选择班级 --</option>
                                                {classes
                                                    .filter(c => !selectedSchoolId || c.school_id === selectedSchoolId)
                                                    .map(c => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setShowRoleModal(false)}
                                    className="px-4 py-2 text-sm text-slate-300 hover:text-white"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleAddRole}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded font-medium"
                                >
                                    添加角色
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
