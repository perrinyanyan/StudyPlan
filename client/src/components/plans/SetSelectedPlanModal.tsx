import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'

interface SetSelectedPlanModalProps {
    planId: string
    planName: string
    onClose: () => void
    onSuccess: () => void
}

interface ClassItem {
    id: string
    name: string
}

export function SetSelectedPlanModal({ planId, planName, onClose, onSuccess }: SetSelectedPlanModalProps) {
    const { headers } = useAuth()
    const [adminClasses, setAdminClasses] = useState<ClassItem[]>([])
    const [selectedClassId, setSelectedClassId] = useState<string>('')
    const [effectiveFrom, setEffectiveFrom] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchAdminClasses = async () => {
            try {
                // Fetch user's profile to get their classes where they are admin
                const profileRes = await fetch('/auth/me', { headers: headers() })
                if (!profileRes.ok) throw new Error('Failed to fetch profile')
                const profile = await profileRes.json()

                // For now, fetch all classes - in production, this should be filtered server-side
                const classesRes = await fetch('/admin/classes', { headers: headers() })
                if (!classesRes.ok) throw new Error('Failed to fetch classes')
                const classesData = await classesRes.json()

                // TODO: Filter to only classes where user is admin
                // For MVP, showing all classes (admin check is done server-side on PUT)
                setAdminClasses(classesData.classes || [])

                if (classesData.classes && classesData.classes.length > 0) {
                    setSelectedClassId(classesData.classes[0].id)
                }
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        fetchAdminClasses()
    }, [])

    const handleSubmit = async () => {
        if (!selectedClassId) {
            alert('请选择一个班级')
            return
        }

        setSubmitting(true)
        setError(null)

        try {
            const body: any = { optional_plan_id: planId }
            if (effectiveFrom) {
                body.effective_from = effectiveFrom
            }

            const res = await fetch(`/classes/${selectedClassId}/selected-plan`, {
                method: 'PUT',
                headers: { ...headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!res.ok) {
                const errData = await res.json()
                throw new Error(errData.error || 'Failed to set selected plan')
            }

            onSuccess()
            onClose()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 rounded-xl shadow-xl w-full max-w-md border border-white/10 text-white">
                <div className="p-6 border-b border-white/10">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold text-white">设为选定计划</h2>
                            <p className="text-sm text-slate-400 mt-1">{planName}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white text-2xl"
                        >
                            &times;
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : error && adminClasses.length === 0 ? (
                        <div className="text-red-400 text-center py-4">{error}</div>
                    ) : adminClasses.length === 0 ? (
                        <div className="text-slate-400 text-center py-8">
                            <p>您没有管理任何班级</p>
                            <p className="text-sm mt-2">只有班级管理员可以设置选定计划</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    选择班级 <span className="text-red-400">*</span>
                                </label>
                                <select
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                >
                                    {adminClasses.map(cls => (
                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    生效日期（可选）
                                </label>
                                <input
                                    type="date"
                                    value={effectiveFrom}
                                    onChange={(e) => setEffectiveFrom(e.target.value)}
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    留空表示立即生效
                                </p>
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
                        disabled={submitting}
                        className="px-4 py-2 text-slate-300 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || loading || adminClasses.length === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {submitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                设置中...
                            </>
                        ) : (
                            '确认设置'
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
