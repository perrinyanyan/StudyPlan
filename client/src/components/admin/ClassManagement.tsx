import { useState, useEffect } from 'react';

interface Class {
    id: string;
    name: string;
    school_id: string;
}

interface School {
    id: string;
    name: string;
}

export function ClassManagement() {
    const [classes, setClasses] = useState<Class[]>([]);
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingClass, setEditingClass] = useState<Class | null>(null);
    const [name, setName] = useState('');
    const [schoolId, setSchoolId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const token = localStorage.getItem('jwt');

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            const [cRes, sRes] = await Promise.all([
                fetch('http://localhost:3000/admin/classes', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('http://localhost:3000/admin/schools', { headers: { Authorization: `Bearer ${token}` } }),
            ]);

            if (!cRes.ok) throw new Error('Failed to fetch classes');
            if (!sRes.ok) throw new Error('Failed to fetch schools');

            const cData = await cRes.json();
            const sData = await sRes.json();

            setClasses(cData.classes);
            setSchools(sData.schools);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
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
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error('Failed to save class');

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
        if (!confirm('Are you sure?')) return;
        try {
            const res = await fetch(`http://localhost:3000/admin/classes/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to delete class');
            fetchData();
        } catch (err: any) {
            alert(err.message);
        }
    }

    const filteredClasses = classes.filter(cls => {
        const school = schools.find(s => s.id === cls.school_id);
        const schoolName = school?.name || '';
        const searchLower = searchTerm.toLowerCase();
        return cls.name.toLowerCase().includes(searchLower) || schoolName.toLowerCase().includes(searchLower);
    });

    if (loading) return <div>Loading...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Class Management</h2>
                <button
                    onClick={() => {
                        setEditingClass(null);
                        setName('');
                        setSchoolId('');
                        setShowModal(true);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                    Add Class
                </button>
            </div>

            <div className="flex gap-4 mb-4">
                <div className="relative flex-1 max-w-md">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <span className="material-symbols-outlined text-sm">search</span>
                    </span>
                    <input
                        type="text"
                        placeholder="Search classes or schools..."
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
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">School</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredClasses.map((cls) => {
                            const school = schools.find(s => s.id === cls.school_id);
                            return (
                                <tr key={cls.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{cls.name}</td>
                                    <td className="px-6 py-4">{school?.name || 'Unknown'}</td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => {
                                                setEditingClass(cls);
                                                setName(cls.name);
                                                setSchoolId(cls.school_id);
                                                setShowModal(true);
                                            }}
                                            className="text-blue-400 hover:text-blue-300"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cls.id)}
                                            className="text-red-400 hover:text-red-300"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredClasses.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                                    No classes found matching "{searchTerm}"
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
                            {editingClass ? 'Edit Class' : 'Add Class'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Name</label>
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
                                    <label className="block text-xs text-slate-400 mb-1">School</label>
                                    <select
                                        value={schoolId}
                                        onChange={(e) => setSchoolId(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                        required
                                    >
                                        <option value="">-- Select School --</option>
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
        </div>
    );
}
