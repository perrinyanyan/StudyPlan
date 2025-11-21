import { useState, useRef } from 'react'

interface PlanImportModalProps {
    onClose: () => void
    onSuccess: () => void
}

export function PlanImportModal({ onClose, onSuccess }: PlanImportModalProps) {
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [scopeType, setScopeType] = useState<'personal' | 'class' | 'school' | 'global'>('personal')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setError(null)
        }
    }

    const handleUpload = async () => {
        if (!file) return

        setUploading(true)
        setError(null)

        const formData = new FormData()
        formData.append('file', file)
        formData.append('scope_type', scopeType)

        try {
            const token = localStorage.getItem('jwt')
            const res = await fetch('/plans/import', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            })

            const data = await res.json()

            if (!res.ok) {
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
                            <option value="class">班级 (Class)</option>
                            <option value="school">学校 (School)</option>
                            <option value="global">全局 (Global)</option>
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">
                            注意：非管理员只能选择"仅自己"。管理员可选择相应权限范围。
                        </p>
                    </div>

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
                        disabled={!file || uploading}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {uploading ? '导入中...' : '开始导入'}
                    </button>
                </div>
            </div>
        </div>
    )
}
