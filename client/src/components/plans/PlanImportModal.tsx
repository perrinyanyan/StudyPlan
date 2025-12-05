import { useState, useRef, useEffect } from 'react'
import { getApiUrl } from '../../config'
import { useAuth } from '../../hooks/useAuth'

interface PlanImportModalProps {
    onClose: () => void
    onSuccess: () => void
}

interface ScopeTarget {
    id: string
    name: string
}

export function PlanImportModal({ onClose, onSuccess }: PlanImportModalProps) {
    const { headers } = useAuth()
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [scopeType, setScopeType] = useState<'personal' | 'class' | 'school' | 'global'>('personal')
    const [scopeId, setScopeId] = useState<string>('')

    const [adminSchools, setAdminSchools] = useState<ScopeTarget[]>([])
    const [adminClasses, setAdminClasses] = useState<ScopeTarget[]>([])
    const [loadingTargets, setLoadingTargets] = useState(false)

    const [userRoles, setUserRoles] = useState<any[]>([])
    const [isSystemAdmin, setIsSystemAdmin] = useState(false)
    const [isSchoolAdmin, setIsSchoolAdmin] = useState(false)
    const [isClassAdmin, setIsClassAdmin] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const fetchUserRoles = async () => {
            try {
                const res = await fetch(getApiUrl('/auth/me'), { headers: headers() })
                if (res.ok) {
                    const data = await res.json()
                    const roles = data.roles || []
                    setUserRoles(roles)
                    setIsSystemAdmin(roles.some((r: any) => r.role === 'system_admin'))
                    setIsSchoolAdmin(roles.some((r: any) => r.role === 'school_admin'))
                    setIsClassAdmin(roles.some((r: any) => r.role === 'class_admin'))
                }
            } catch (err) {
                console.error('Failed to fetch user roles', err)
            }
        }
        fetchUserRoles()
    }, [])

    useEffect(() => {
        const fetchTargets = async () => {
            setLoadingTargets(true)
            try {
                // Fetch available targets
                const [schoolsRes, classesRes] = await Promise.all([
                    fetch(getApiUrl('/admin/schools'), { headers: headers() }),
                    fetch(getApiUrl('/admin/classes'), { headers: headers() })
                ])

                if (schoolsRes.ok) {
                    const data = await schoolsRes.json()
                    setAdminSchools(data.schools || [])
                }

                if (classesRes.ok) {
                    const data = await classesRes.json()
                    setAdminClasses(data.classes || [])
                }

            } catch (err) {
                console.error('Failed to fetch scope targets', err)
            } finally {
                setLoadingTargets(false)
            }
        }

        if (scopeType === 'school' || scopeType === 'class') {
            fetchTargets()
        } else {
            setScopeId('')
        }
    }, [scopeType])

    // Auto-select first option when targets load
    useEffect(() => {
        if (scopeType === 'school' && adminSchools.length > 0 && !scopeId) {
            setScopeId(adminSchools[0].id)
        }
        if (scopeType === 'class' && adminClasses.length > 0 && !scopeId) {
            setScopeId(adminClasses[0].id)
        }
    }, [scopeType, adminSchools, adminClasses])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setError(null)
        }
    }

    const handleUpload = async () => {
        if (!file) return
        if ((scopeType === 'school' || scopeType === 'class') && !scopeId) {
            setError(`请选择具体的${scopeType === 'school' ? '学校' : '班级'}`)
            return
        }

        setUploading(true)
        setError(null)

        const formData = new FormData()
        formData.append('file', file)
        formData.append('scope_type', scopeType)
        if (scopeId) {
            formData.append('scope_id', scopeId)
        }

        try {
            // Note: When using FormData, do NOT set Content-Type header manually. 
            // useAuth().headers() might set Content-Type to application/json.
            // We need to override that.
            const authHeaders = headers()
            // Ensure Content-Type is not set (let browser set it with boundary)
            if ((authHeaders as any)['Content-Type']) {
                delete (authHeaders as any)['Content-Type']
            }

            const uploadRes = await fetch(getApiUrl('/plans/import'), {
                method: 'POST',
                headers: authHeaders,
                body: formData
            })

            const data = await uploadRes.json()

            if (!uploadRes.ok) {
                throw new Error(data.error || 'Upload failed')
            }

            onSuccess()
            onClose()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-white/10">
                <h2 className="text-lg font-semibold text-white mb-4">导入课程计划 (CSV)</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-slate-400 mb-1">可见范围</label>
                        <select
                            value={scopeType}
                            onChange={e => setScopeType(e.target.value as any)}
                            className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                        >
                            <option value="personal">仅自己 (Personal)</option>
                            {(isSystemAdmin || isSchoolAdmin || isClassAdmin) && (
                                <option value="class">班级 (Class)</option>
                            )}
                            {(isSystemAdmin || isSchoolAdmin) && (
                                <option value="school">学校 (School)</option>
                            )}
                            {isSystemAdmin && (
                                <option value="global">全局 (Global)</option>
                            )}
                        </select>
                    </div>

                    {scopeType === 'school' && (
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">选择学校</label>
                            {loadingTargets ? (
                                <div className="text-xs text-slate-500">加载中...</div>
                            ) : (
                                <select
                                    value={scopeId}
                                    onChange={e => setScopeId(e.target.value)}
                                    className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                >
                                    {adminSchools.length === 0 && <option value="">无可用学校</option>}
                                    {adminSchools.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {scopeType === 'class' && (
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">选择班级</label>
                            {loadingTargets ? (
                                <div className="text-xs text-slate-500">加载中...</div>
                            ) : (
                                <select
                                    value={scopeId}
                                    onChange={e => setScopeId(e.target.value)}
                                    className="w-full bg-slate-900 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                                >
                                    {adminClasses.length === 0 && <option value="">无可用班级</option>}
                                    {adminClasses.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    <div
                        className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".csv"
                            className="hidden"
                        />
                        {file ? (
                            <div className="text-sm text-blue-400 font-medium">{file.name}</div>
                        ) : (
                            <div className="text-sm text-slate-400">点击选择 CSV 文件</div>
                        )}
                    </div>

                    {error && (
                        <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded">
                            {error}
                        </div>
                    )}

                    <div className="text-xs text-slate-500">
                        <p className="mb-1">CSV 格式要求 (包含表头):</p>
                        <code className="block bg-slate-900 p-2 rounded text-[10px] overflow-x-auto">
                            plan_name, category, course_code, course_name, date, start_time, end_time, location
                        </code>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading || ((scopeType === 'school' || scopeType === 'class') && !scopeId)}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {uploading ? '导入中...' : '开始导入'}
                    </button>
                </div>
            </div>
        </div>
    )
}
