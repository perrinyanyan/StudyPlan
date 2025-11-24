import { useState, useEffect } from 'react';

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
    }[];
    primaryRole: string;
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

    // Role Modal
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [newRole, setNewRole] = useState('student');
    const [newScopeType, setNewScopeType] = useState('global');
    const [selectedSchoolId, setSelectedSchoolId] = useState('');
    const [newScopeId, setNewScopeId] = useState('');

    const token = localStorage.getItem('jwt');

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            const [uRes, sRes, cRes] = await Promise.all([
                fetch('http://localhost:3000/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('http://localhost:3000/admin/schools', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('http://localhost:3000/admin/classes', { headers: { Authorization: `Bearer ${token}` } }),
            ]);

            if (!uRes.ok) throw new Error('Failed to fetch users');
            if (!sRes.ok) throw new Error('Failed to fetch schools');
            if (!cRes.ok) throw new Error('Failed to fetch classes');

            const uData = await uRes.json();
            const sData = await sRes.json();
            const cData = await cRes.json();

            setUsers(uData.users);
            setSchools(sData.schools);
            setClasses(cData.classes);
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
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error('Failed to save user');

            setShowUserModal(false);
            setEmail('');
            setPassword('');
            setNickname('');
            setEditingUser(null);
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    }

    async function handleDeleteUser(id: string) {
        if (!confirm('Are you sure?')) return;
        try {
            const res = await fetch(`http://localhost:3000/admin/users/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to delete user');
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    }

    async function handleAddRole() {
        if (!selectedUserId) return;
        if (newRole === 'student' && !newScopeId) {
            alert('Student role requires a class selection');
            return;
        }

        try {
            const res = await fetch(`http://localhost:3000/admin/users/${selectedUserId}/roles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    role: newRole,
                    scope_type: newScopeType,
                    scope_id: newScopeId
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to add role');
            }

            setShowRoleModal(false);
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    }

    async function handleRemoveRole(userId: string, role: string, scopeId: string | null) {
        if (!confirm('Are you sure you want to remove this role?')) return;

        try {
            const res = await fetch(`http://localhost:3000/admin/users/${userId}/roles`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ role, scope_id: scopeId })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to remove role');
            }

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

    if (loading) return <div>Loading...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">User Management</h2>
                <button
                    onClick={() => {
                        setEditingUser(null);
                        setEmail('');
                        setPassword('');
                        setNickname('');
                        setShowUserModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                    Add User
                </button>
            </div>

            <div className="flex gap-4 mb-4">
                <div className="relative flex-1 max-w-md">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <span className="material-symbols-outlined text-sm">search</span>
                    </span>
                    <input
                        type="text"
                        placeholder="Search users by name, email or role..."
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
                            <th className="px-6 py-4">Nickname</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Roles</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-medium text-white">{user.nickname}</td>
                                <td className="px-6 py-4">{user.email}</td>
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
                                                {r.scope_type === 'school' && <span className="opacity-70">@School</span>}
                                                {r.scope_type === 'class' && <span className="opacity-70">@{r.class_name || 'Class'}</span>}
                                                <button
                                                    onClick={() => handleRemoveRole(user.id, r.role, r.scope_id)}
                                                    className="ml-1 hover:text-red-400"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                        <button
                                            onClick={() => {
                                                setSelectedUserId(user.id);
                                                setShowRoleModal(true);
                                                setNewRole('student');
                                                setNewScopeType('global');
                                                setSelectedSchoolId('');
                                                setNewScopeId('');
                                            }}
                                            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1"
                                        >
                                            + Add Role
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right space-x-2">
                                    <button
                                        onClick={() => {
                                            setEditingUser(user);
                                            setEmail(user.email);
                                            setNickname(user.nickname);
                                            setPassword('');
                                            setShowUserModal(true);
                                        }}
                                        className="text-blue-400 hover:text-blue-300"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="text-red-400 hover:text-red-300"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredUsers.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    No users found matching "{searchTerm}"
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* User Modal */}
            {showUserModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-[#1A2633] border border-white/10 rounded-xl shadow-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4">
                            {editingUser ? 'Edit User' : 'Add User'}
                        </h3>
                        <form onSubmit={handleUserSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Nickname</label>
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Password {editingUser && '(Leave blank to keep current)'}</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                    required={!editingUser}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowUserModal(false)}
                                    className="px-4 py-2 text-sm text-slate-300 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded font-medium"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Role Modal */}
            {showRoleModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-[#1A2633] border border-white/10 rounded-xl shadow-2xl p-6 space-y-4">
                        <h3 className="text-lg font-bold text-white">Add Role</h3>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Role</label>
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
                                    <option value="system_admin">System Admin</option>
                                    <option value="school_admin">School Admin</option>
                                    <option value="class_admin">Class Admin</option>
                                    <option value="student">Student</option>
                                </select>
                            </div>

                            {newRole === 'school_admin' && (
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Select School</label>
                                    <select
                                        value={newScopeId}
                                        onChange={e => setNewScopeId(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                    >
                                        <option value="">-- Select School --</option>
                                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {(newRole === 'class_admin' || newRole === 'student') && (
                                <>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Select School</label>
                                        <select
                                            value={selectedSchoolId}
                                            onChange={e => {
                                                setSelectedSchoolId(e.target.value);
                                                setNewScopeId('');
                                            }}
                                            className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                        >
                                            <option value="">-- Select School --</option>
                                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>

                                    {selectedSchoolId && (
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Select Class</label>
                                            <select
                                                value={newScopeId}
                                                onChange={e => setNewScopeId(e.target.value)}
                                                className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                            >
                                                <option value="">-- Select Class --</option>
                                                {classes.filter(c => c.school_id === selectedSchoolId).map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setShowRoleModal(false)}
                                className="px-4 py-2 text-sm text-slate-300 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddRole}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded font-medium"
                            >
                                Add Role
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
