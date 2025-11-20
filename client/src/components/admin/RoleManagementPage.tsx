import { useState, useEffect } from 'react'
import { UserRole } from '../../types'

interface RoleManagementPageProps {
    jwt: string
    headers: () => Record<string, string>
    currentUserRole?: UserRole
}

interface User {
    id: string
    email: string
    nickname: string
    created_at: string
    roles: {
        role: UserRole
        scope_type: 'global' | 'school' | 'class'
        scope_id: string | null
        class_name?: string
    }[]
    primaryRole: UserRole
}

interface School {
    id: string
    name: string
}

interface Class {
    id: string
    name: string
    school_id: string
}

export function RoleManagementPage({ jwt, headers, currentUserRole }: RoleManagementPageProps) {
    const [users, setUsers] = useState<User[]>([])
    const [schools, setSchools] = useState<School[]>([])
    const [classes, setClasses] = useState<Class[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [newRole, setNewRole] = useState<UserRole>('student')
    const [newScopeType, setNewScopeType] = useState<'global' | 'school' | 'class'>('global')
    const [selectedSchoolId, setSelectedSchoolId] = useState('')
    const [newScopeId, setNewScopeId] = useState('')

    useEffect(() => {
        if (currentUserRole === 'system_admin') {
            fetchData()
        }
    }, [currentUserRole])

    async function fetchData() {
        setLoading(true)
        try {
            const [uRes, sRes, cRes] = await Promise.all([
                fetch('/admin/users', { headers: headers() }),
                fetch('/admin/schools', { headers: headers() }),
                fetch('/admin/classes', { headers: headers() })
            ])

            if (!uRes.ok) throw new Error('Failed to fetch users')
            if (!sRes.ok) throw new Error('Failed to fetch schools')
            if (!cRes.ok) throw new Error('Failed to fetch classes')

            const uData = await uRes.json()
            const sData = await sRes.json()
            const cData = await cRes.json()

            setUsers(uData.users)
            setSchools(sData.schools)
            setClasses(cData.classes)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleAddRole() {
        if (!selectedUserId) return
        if (newRole === 'student' && !newScopeId) {
            alert('Student role requires a class selection')
            return
        }

        try {
            const res = await fetch(`/admin/users/${selectedUserId}/roles`, {
                method: 'POST',
                headers: {
                    ...headers(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role: newRole,
                    scope_type: newScopeType,
                    scope_id: newScopeId
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to add role')
            }

            setSuccessMsg('Role added successfully')
            setShowModal(false)
            fetchData()
            setTimeout(() => setSuccessMsg(''), 3000)
        } catch (err: any) {
            alert(err.message)
        }
    }

    async function handleRemoveRole(userId: string, role: string, scopeId: string | null) {
        if (!confirm('Are you sure you want to remove this role?')) return

        try {
            const res = await fetch(`/admin/users/${userId}/roles`, {
                method: 'DELETE',
                headers: {
                    ...headers(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role, scope_id: scopeId })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to remove role')
            }

            setSuccessMsg('Role removed successfully')
            fetchData()
            setTimeout(() => setSuccessMsg(''), 3000)
        } catch (err: any) {
            alert(err.message)
        }
    }


    if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>
    if (error) return <div className="p-8 text-center text-red-400">Error: {error}</div>

    if (currentUserRole && currentUserRole !== 'system_admin') {
        return <div className="p-8 text-center text-red-400">Access Denied: System Admin only.</div>
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Role Management</h2>
                <button
                    onClick={fetchData}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm text-white"
                >
                    Refresh
                </button>
            </div>

            {successMsg && (
                <div className="p-4 bg-emerald-900/30 border border-emerald-500/30 rounded text-emerald-400">
                    {successMsg}
                </div>
            )}

            <div className="bg-[#1A2633] rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-white/5 text-xs uppercase font-semibold text-slate-400">
                        <tr>
                            <th className="px-6 py-4">User</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">学校</th>
                            <th className="px-6 py-4">班级</th>
                            <th className="px-6 py-4">Roles & Scopes</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-white/5">
                                <td className="px-6 py-4 font-medium text-white">
                                    {user.nickname || 'No Name'}
                                </td>
                                <td className="px-6 py-4">{user.email}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {(() => {
                                            // Schools from direct school roles
                                            const schoolRoles = user.roles.filter(r => r.scope_type === 'school')
                                            const directSchools = schoolRoles.map(r => r.scope_id).filter(Boolean)

                                            // Schools from class roles (students/class_admins)
                                            const classRoles = user.roles.filter(r => r.scope_type === 'class')
                                            const classIds = classRoles.map(r => r.scope_id).filter(Boolean)
                                            const schoolsFromClasses = classIds.map(cid => {
                                                const cls = classes.find(c => c.id === cid)
                                                return cls?.school_id
                                            }).filter(Boolean)

                                            const allSchoolIds = [...directSchools, ...schoolsFromClasses]
                                            const uniqueSchools = Array.from(new Set(allSchoolIds))

                                            return uniqueSchools.length > 0 ? uniqueSchools.map((sid, idx) => {
                                                const school = schools.find(s => s.id === sid)
                                                return <span key={idx} className="text-xs px-2 py-0.5 bg-slate-700/50 rounded">{school?.name || sid}</span>
                                            }) : <span className="text-slate-500 text-xs">-</span>
                                        })()}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {(() => {
                                            const classRoles = user.roles.filter(r => r.scope_type === 'class')
                                            const uniqueClasses = Array.from(new Set(classRoles.map(r => r.scope_id).filter(Boolean)))
                                            return uniqueClasses.length > 0 ? uniqueClasses.map((cid, idx) => {
                                                const cls = classes.find(c => c.id === cid)
                                                return <span key={idx} className="text-xs px-2 py-0.5 bg-slate-700/50 rounded">{cls?.name || cid}</span>
                                            }) : <span className="text-slate-500 text-xs">-</span>
                                        })()}
                                    </div>
                                </td>
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
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => {
                                            setSelectedUserId(user.id)
                                            setShowModal(true)
                                            setNewRole('student')
                                            setNewScopeType('global')
                                            setSelectedSchoolId('')
                                            setNewScopeId('')
                                        }}
                                        className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                                    >
                                        Add Role
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add Role Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-[#1A2633] border border-white/10 rounded-xl shadow-2xl p-6 space-y-4">
                        <h3 className="text-lg font-bold text-white">Add Role</h3>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">角色</label>
                                <select
                                    value={newRole}
                                    onChange={e => {
                                        const r = e.target.value as UserRole
                                        setSelectedSchoolId('')
                                        setNewScopeId('')
                                        setNewRole(r)
                                        // Auto-set scope type based on role
                                        if (r === 'system_admin') setNewScopeType('global')
                                        else if (r === 'school_admin') setNewScopeType('school')
                                        else if (r === 'class_admin') setNewScopeType('class')
                                        else if (r === 'student') setNewScopeType('class')
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
                                    <label className="block text-xs text-slate-400 mb-1">选择学校</label>
                                    <select
                                        value={newScopeId}
                                        onChange={e => setNewScopeId(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                    >
                                        <option value="">-- 请选择学校 --</option>
                                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {(newRole === 'class_admin' || newRole === 'student') && (
                                <>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">选择学校</label>
                                        <select
                                            value={selectedSchoolId}
                                            onChange={e => {
                                                setSelectedSchoolId(e.target.value)
                                                setNewScopeId('') // Reset class selection when school changes
                                            }}
                                            className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                        >
                                            <option value="">-- 请先选择学校 --</option>
                                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>

                                    {selectedSchoolId && (
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">选择班级</label>
                                            <select
                                                value={newScopeId}
                                                onChange={e => setNewScopeId(e.target.value)}
                                                className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                            >
                                                <option value="">-- 请选择班级 --</option>
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
                                onClick={() => setShowModal(false)}
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
    )
}
