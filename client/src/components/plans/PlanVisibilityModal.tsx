import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'

interface PlanVisibilityModalProps {
    planId: string
    planName: string
    planScope: 'global' | 'school' | 'class' | 'personal'
    onClose: () => void
    onSuccess: () => void
}

interface School {
    id: string
    name: string
}

interface Class {
    id: string
    name: string
}

export function PlanVisibilityModal({ planId, planName, planScope, onClose, onSuccess }: PlanVisibilityModalProps) {
    const { headers } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [schools, setSchools] = useState<School[]>([])
    const [classes, setClasses] = useState<Class[]>([])
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch existing visibility rules
                const visRes = await fetch(`/plans/${planId}/visibility`, { headers: headers() })
                if (!visRes.ok) throw new Error('Failed to fetch visibility rules')
                const visData = await visRes.json()

                const currentIds = new Set<string>()
                visData.visibility.forEach((rule: any) => {
                    currentIds.add(rule.target_id)
                })
                setSelectedIds(currentIds)

                // Fetch available targets based on plan scope
                if (planScope === 'global') {
                    // Fetch all schools for system admin
                    const res = await fetch('/admin/schools', { headers: headers() })
                    if (!res.ok) throw new Error('Failed to fetch schools')
                    const data = await res.json()
                    setSchools(data.schools || [])
                } else if (planScope === 'school') {
                    // Fetch all classes for school admin
                    const res = await fetch('/admin/classes', { headers: headers() })
                    if (!res.ok) throw new Error('Failed to fetch classes')
                    const data = await res.json()
                    setClasses(data.classes || [])
                }
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [planId, planScope])

    const handleToggle = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelectedIds(newSet)
    }

    const handleSelectAll = () => {
        if (planScope === 'global') {
            if (selectedIds.size === schools.length) {
                setSelectedIds(new Set())
            } else {
                setSelectedIds(new Set(schools.map(s => s.id)))
            }
        } else {
            if (selectedIds.size === classes.length) {
                setSelectedIds(new Set())
            } else {
                setSelectedIds(new Set(classes.map(c => c.id)))
            }
        }
    }

    const handleSave = async () => {
        setSaving(true)
        setError(null)

        try {
            const targets = Array.from(selectedIds).map(id => ({
                type: planScope === 'global' ? 'school' : 'class',
                id
            }))

            const res = await fetch(`/plans/${planId}/visibility`, {
                method: 'PUT',
                headers: { ...headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets })
            })

            if (!res.ok) {
                const errData = await res.json()
                throw new Error(errData.error || 'Failed to update visibility')
            }

            onSuccess()
            onClose()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const targetList = planScope === 'global' ? schools : classes
    const targetType = planScope === 'global' ? '学校' : '班级'

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-white/10 text-white">
                <div className="p-6 border-b border-white/10">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold text-white">管理计划可见性</h2>
                            <p className="text-sm text-slate-400 mt-1">{planName}</p>
                            <p className="text-xs text-slate-500 mt-1">
                                选择可以看到此计划的{targetType}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white text-2xl"
                        >
                            &times;
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : error && targetList.length === 0 ? (
                        <div className="text-red-400 text-center py-4">{error}</div>
                    ) : targetList.length === 0 ? (
                        <div className="text-slate-400 text-center py-8">
                            <p>没有可选的{targetType}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-slate-300">
                                    已选择 {selectedIds.size} / {targetList.length}
                                </p>
                                <button
                                    onClick={handleSelectAll}
                                    className="text-sm text-blue-400 hover:text-blue-300 font-medium"
                                >
                                    {selectedIds.size === targetList.length ? '取消全选' : '全选'}
                                </button>
                            </div>

                            <div className="grid gap-2">
                                {targetList.map(item => (
                                    <label
                                        key={item.id}
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedIds.has(item.id)
                                                ? 'bg-blue-500/10 border-blue-500/50'
                                                : 'bg-slate-800 border-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(item.id)}
                                            onChange={() => handleToggle(item.id)}
                                            className="h-4 w-4 rounded border-slate-600"
                                        />
                                        <span className="text-white">{item.name}</span>
                                    </label>
                                ))}
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading || targetList.length === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                保存中...
                            </>
                        ) : (
                            '保存'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
