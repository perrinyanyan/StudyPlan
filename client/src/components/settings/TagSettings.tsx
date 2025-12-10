import { useState, useEffect } from 'react'
import { getApiUrl } from '../../config'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'

interface Tag {
    id: string
    name: string
    created_at: string
}

interface TagSettingsProps {
    authHeaders: Record<string, string>
    showToast?: (msg: string) => void
}

export function TagSettings({ authHeaders, showToast }: TagSettingsProps) {
    const { profile } = useAuth()
    const [tags, setTags] = useState<Tag[]>([])
    const [loading, setLoading] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [editingTag, setEditingTag] = useState<Tag | null>(null)
    const [tagName, setTagName] = useState('')

    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, name: string, tasks?: { title: string, due_at: string | null }[] } | null>(null)
    const [confirmEmail, setConfirmEmail] = useState('')
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        fetchTags()
    }, [])

    async function fetchTags() {
        setLoading(true)
        try {
            const r = await fetch(getApiUrl('/tags'), { headers: authHeaders })
            const j = await r.json()
            if (r.ok && Array.isArray(j.items)) {
                setTags(j.items)
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    function openAdd() {
        setEditingTag(null)
        setTagName('')
        setModalOpen(true)
    }

    function openEdit(t: Tag) {
        setEditingTag(t)
        setTagName(t.name)
        setModalOpen(true)
    }

    async function handleSubmit() {
        if (!tagName.trim()) return

        const payload = { name: tagName.trim() }
        try {
            let r
            if (editingTag) {
                r = await fetch(getApiUrl(`/tags/${editingTag.id}`), {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', ...authHeaders },
                    body: JSON.stringify(payload)
                })
            } else {
                r = await fetch(getApiUrl('/tags'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders },
                    body: JSON.stringify(payload)
                })
            }

            if (r.ok) {
                setModalOpen(false)
                fetchTags()
                if (showToast) showToast(editingTag ? '标签已更新' : '标签已添加')
            } else {
                alert('操作失败')
            }
        } catch (e) {
            alert('网络错误')
        }
    }

    async function handleDelete(id: string, name: string, force = false) {
        if (force) setDeleting(true)

        try {
            const url = force ? getApiUrl(`/tags/${id}?force=true`) : getApiUrl(`/tags/${id}`)
            const r = await fetch(url, {
                method: 'DELETE',
                headers: authHeaders
            })

            if (r.ok) {
                fetchTags()
                setDeleteConfirm(null)
                setConfirmEmail('')
                if (showToast) showToast('标签已删除')
            } else if (r.status === 409 && !force) {
                const j = await r.json()
                setDeleteConfirm({ id, name, tasks: j.tasks })
            } else {
                alert('删除失败')
            }
        } catch (e) {
            alert('网络错误')
        } finally {
            if (force) setDeleting(false)
        }
    }

    return (
        <section className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur-sm transition-all hover:border-slate-600/50">
            <div className="p-6 border-b border-slate-700/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <span className="material-symbols-outlined">label</span>
                    </span>
                    <div>
                        <h2 className="text-lg font-semibold text-white">任务标签</h2>
                        <p className="text-sm text-slate-400">管理任务标签</p>
                    </div>
                </div>
                <button
                    onClick={openAdd}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors flex items-center gap-1"
                >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    添加标签
                </button>
            </div>

            <div className="p-4">
                {loading ? (
                    <div className="text-center text-slate-500 py-4">加载中...</div>
                ) : tags.length === 0 ? (
                    <div className="text-center text-slate-500 py-4">暂无标签</div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {tags.map(t => (
                            <div key={t.id} className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-slate-900/50 border border-slate-700/30 group hover:border-slate-600/50 hover:bg-slate-800/50 transition-all">
                                <span className="text-slate-200 text-sm font-medium mr-1">{t.name}</span>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openEdit(t)}
                                        className="p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                                        title="编辑"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">edit</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(t.id, t.name)}
                                        className="p-1 rounded-full text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                        title="删除"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Modal */}
            {modalOpen && createPortal(
                <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4 z-[9999] backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                            <h3 className="text-sm font-medium text-white">{editingTag ? '编辑标签' : '添加标签'}</h3>
                            <button
                                className="text-white/60 hover:text-white"
                                onClick={() => setModalOpen(false)}
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>
                        <div className="px-4 py-4 space-y-4">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs text-slate-300">标签名称</span>
                                <input
                                    className="h-9 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                                    placeholder="例如：重要、紧急..."
                                    value={tagName}
                                    onChange={(e) => setTagName(e.target.value)}
                                    autoFocus
                                />
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/10 bg-slate-900">
                            <button
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600"
                                onClick={() => setModalOpen(false)}
                            >
                                取消
                            </button>
                            <button
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#137fec] hover:bg-[#0f6cc8]"
                                onClick={handleSubmit}
                            >
                                保存
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Warning Modal */}
            {deleteConfirm && deleteConfirm.tasks && createPortal(
                <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4 z-[9999] backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-slate-900 shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 text-red-400">
                            <span className="material-symbols-outlined">warning</span>
                            <h3 className="text-lg font-bold">确认删除</h3>
                        </div>
                        <div className="px-6 py-4">
                            <p className="text-slate-300 mb-3">
                                标签 <span className="font-bold text-white">{deleteConfirm.name}</span> 正在被以下任务使用：
                            </p>
                            <ul className="list-disc list-inside text-sm text-slate-400 space-y-1 bg-slate-950/50 p-3 rounded-lg border border-slate-800 mb-4">
                                {deleteConfirm.tasks.map((t, i) => (
                                    <li key={i} className="truncate flex items-center gap-2">
                                        <span className="truncate flex-1">{t.title}</span>
                                        {t.due_at && (
                                            <span className="text-slate-500 text-xs whitespace-nowrap">
                                                {new Date(t.due_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
                                            </span>
                                        )}
                                    </li>
                                ))}
                                {deleteConfirm.tasks.length >= 5 && <li>...</li>}
                            </ul>

                            <div className="space-y-2">
                                <label className="block text-sm text-slate-300">
                                    请输入您的邮箱 <span className="text-white font-medium">{profile?.email}</span> 以确认删除：
                                </label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500 outline-none"
                                    placeholder={profile?.email}
                                    value={confirmEmail}
                                    onChange={e => setConfirmEmail(e.target.value)}
                                />
                                <p className="text-xs text-red-400/80">
                                    注意：删除后，这些任务的该标签将被移除。
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/10 bg-slate-900">
                            <button
                                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700"
                                onClick={() => {
                                    setDeleteConfirm(null)
                                    setConfirmEmail('')
                                }}
                            >
                                取消
                            </button>
                            <button
                                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                disabled={confirmEmail !== profile?.email || deleting}
                                onClick={() => handleDelete(deleteConfirm.id, deleteConfirm.name, true)}
                            >
                                {deleting ? '删除中...' : '确认删除'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </section>
    )
}
