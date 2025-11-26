import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { PlanVisibilityModal } from './PlanVisibilityModal';
import { SetSelectedPlanModal } from './SetSelectedPlanModal';

interface PlanDetailsModalProps {
    planId: string;
    onClose: () => void;
    onPlanDeleted?: () => void;
}

interface Session {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    location: string;
}

interface Course {
    id: string;
    code: string;
    name: string;
    sessions: Session[];
}

interface PlanItem {
    id: string;
    kind: string;
    course: Course;
}

interface PlanDetails {
    plan: {
        id: string;
        name: string;
        description: string;
        category: string;
        scope_type: string;
        scope_id: string;
        created_by: string;
    };
    items: PlanItem[];
}

interface CourseSettings {
    type: string;
    priority: number;
    tags: string[];
}

type TypeRow = { id: string; name: string; color: string }

export function PlanDetailsModal({ planId, onClose, onPlanDeleted }: PlanDetailsModalProps) {
    const { headers } = useAuth();
    const [details, setDetails] = useState<PlanDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
    const [applying, setApplying] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [courseSettings, setCourseSettings] = useState<Map<string, CourseSettings>>(new Map());

    const [types, setTypes] = useState<TypeRow[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);

    const [showVisibilityModal, setShowVisibilityModal] = useState(false);
    const [showSelectedPlanModal, setShowSelectedPlanModal] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [userRoles, setUserRoles] = useState<any[]>([]);

    // Type creation state
    const [typeModalOpen, setTypeModalOpen] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [newTypeColor, setNewTypeColor] = useState('#F87171');
    const TYPE_COLOR_OPTIONS = [
        '#F87171', // Red
        '#FB923C', // Orange
        '#FACC15', // Yellow
        '#4ADE80', // Green
        '#2DD4BF', // Teal
        '#60A5FA', // Blue
        '#818CF8', // Indigo
        '#A78BFA', // Purple
        '#F472B6', // Pink
    ];

    // Tag creation state (per course, but we use a temporary state for the input)
    const [tagInputs, setTagInputs] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [detailsRes, typesRes, tagsRes, profileRes] = await Promise.all([
                    fetch(`/plans/${planId}`, { headers: headers() }),
                    fetch('/task-types', { headers: headers() }),
                    fetch('/tasks/tags-list', { headers: headers() }),
                    fetch('/auth/me', { headers: headers() })
                ]);

                if (!detailsRes.ok) throw new Error('加载计划详情失败');
                const data = await detailsRes.json();
                setDetails(data);

                const defaultSettings = new Map<string, CourseSettings>();
                data.items.forEach((item: PlanItem) => {
                    defaultSettings.set(item.course.id, { type: 'Class', priority: 1, tags: [] });
                });
                setCourseSettings(defaultSettings);

                if (typesRes.ok) {
                    const j = await typesRes.json();
                    if (Array.isArray(j.items)) {
                        const list = (j.items as any[]).map((x) => ({ id: String(x.id), name: String(x.name), color: String(x.color) })) as TypeRow[];
                        // Ensure default types exist if not in DB
                        const defaults = [
                            { id: 'class', name: 'Class', color: '#60A5FA' },
                            { id: 'study', name: 'Study', color: '#FACC15' },
                            { id: 'exam', name: 'Exam', color: '#F87171' },
                            { id: 'activity', name: 'Activity', color: '#4ADE80' }
                        ];
                        // Merge defaults if they don't exist by name
                        defaults.forEach(d => {
                            if (!list.find(l => l.name === d.name)) {
                                list.push(d);
                            }
                        });
                        setTypes(list);
                    }
                }

                if (tagsRes.ok) {
                    const tagsData = await tagsRes.json();
                    setAvailableTags(tagsData.tags || []);
                }

                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    setUserRole(profile.role);
                    setUserId(profile.id);
                    setUserRoles(profile.roles || []);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (planId) {
            fetchData();
            setSelectedCourseIds([]);
        }
    }, [planId]);

    const handleToggleCourse = (courseId: string) => {
        setSelectedCourseIds(prev =>
            prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
        );
    };

    const handleSelectAll = () => {
        if (!details) return;
        const allIds = details.items.map(i => i.course.id);
        setSelectedCourseIds(selectedCourseIds.length === allIds.length ? [] : allIds);
    };

    const updateCourseSetting = (courseId: string, field: keyof CourseSettings, value: any) => {
        setCourseSettings(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(courseId) || { type: 'Class', priority: 1, tags: [] };
            newMap.set(courseId, { ...current, [field]: value });
            return newMap;
        });
    };

    const handleTagInput = (courseId: string, value: string) => {
        setTagInputs(prev => new Map(prev).set(courseId, value));
    };

    const addTag = (courseId: string, tag: string) => {
        const t = tag.trim();
        if (!t) return;
        const currentSettings = courseSettings.get(courseId) || { type: 'Class', priority: 1, tags: [] };
        if (!currentSettings.tags.includes(t)) {
            updateCourseSetting(courseId, 'tags', [...currentSettings.tags, t]);
        }
        setTagInputs(prev => new Map(prev).set(courseId, ''));
    };

    const removeTag = (courseId: string, tag: string) => {
        const currentSettings = courseSettings.get(courseId) || { type: 'Class', priority: 1, tags: [] };
        updateCourseSetting(courseId, 'tags', currentSettings.tags.filter(t => t !== tag));
    };

    async function addType(name: string, color: string): Promise<boolean> {
        const trimmed = name.trim();
        if (!trimmed) {
            alert('请输入类型名称');
            return false;
        }
        try {
            const r = await fetch('/task-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers() },
                body: JSON.stringify({ name: trimmed, color }),
            });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) {
                alert('创建类型失败: ' + (j.error || r.status));
                return false;
            }
            // Refresh types
            const typesRes = await fetch('/task-types', { headers: headers() });
            if (typesRes.ok) {
                const j = await typesRes.json();
                if (Array.isArray(j.items)) {
                    setTypes((j.items as any[]).map((x) => ({ id: String(x.id), name: String(x.name), color: String(x.color) })));
                }
            }
            return true;
        } catch {
            alert('创建类型失败');
            return false;
        }
    }

    async function submitNewType() {
        const ok = await addType(newTypeName, newTypeColor);
        if (!ok) return;
        setTypeModalOpen(false);
        setNewTypeName('');
    }

    const handleApply = async () => {
        if (selectedCourseIds.length === 0) return;
        setApplying(true);
        try {
            const coursesWithSettings = selectedCourseIds.map(courseId => {
                const settings = courseSettings.get(courseId) || { type: 'Class', priority: 1, tags: [] };
                const typeObj = types.find(t => t.name === settings.type);
                return {
                    courseId,
                    settings: {
                        type: settings.type,
                        color: typeObj ? typeObj.color : undefined,
                        priority: Number(settings.priority),
                        tags: settings.tags
                    }
                };
            });

            const res = await fetch(`/plans/${planId}/apply`, {
                method: 'POST',
                headers: { ...headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ courses: coursesWithSettings })
            });

            if (!res.ok) throw new Error((await res.json()).error || '应用计划失败');

            alert(`成功！已添加 ${(await res.json()).count} 个日程到您的时间表。`);
            onClose();
        } catch (err: any) {
            alert('错误: ' + err.message);
        } finally {
            setApplying(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('确定要删除此计划吗？此操作无法撤销。')) return;

        setDeleting(true);
        try {
            const res = await fetch(`/plans/${planId}`, {
                method: 'DELETE',
                headers: headers()
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '删除计划失败');
            }

            alert('计划删除成功');
            if (onPlanDeleted) onPlanDeleted();
            onClose();
        } catch (err: any) {
            alert('错误: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };

    if (!planId) return null;

    const canManageVisibility = details && (
        (details.plan.scope_type === 'global' && userRole === 'system_admin') ||
        (details.plan.scope_type === 'school' && ['school_admin', 'system_admin'].includes(userRole || ''))
    );

    const canSetSelectedPlan = ['school_admin', 'class_admin', 'system_admin'].includes(userRole || '');

    const canDelete = details && (
        (details.plan.scope_type === 'personal' && details.plan.created_by === userId) ||
        (userRole === 'system_admin') ||
        (details.plan.scope_type === 'school' && userRoles.some((r: any) => r.role === 'school_admin' && r.scope_type === 'school' && r.scope_id === details.plan.scope_id)) ||
        (details.plan.scope_type === 'class' && userRoles.some((r: any) => r.role === 'class_admin' && r.scope_type === 'class' && r.scope_id === details.plan.scope_id))
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-5xl rounded-xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div>
                        <h2 className="text-xl font-bold text-white">{loading ? '加载中...' : details?.plan.name}</h2>
                        {!loading && details && (
                            <div className="flex gap-2 mt-2">
                                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium border border-blue-500/30">{details.plan.category}</span>
                                <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs font-medium capitalize border border-slate-600">{details.plan.scope_type}</span>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#137fec]"></div>
                        </div>
                    ) : error ? (
                        <div className="text-red-400 text-center py-8">{error}</div>
                    ) : details ? (
                        <div className="space-y-6">
                            {details.plan.description && <div className="bg-slate-800/50 p-4 rounded-lg text-slate-300 border border-white/5">{details.plan.description}</div>}

                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-white">📚 课程 ({details.items.length})</h3>
                                    <button onClick={handleSelectAll} className="text-sm text-[#137fec] hover:text-[#0f6cc8] font-medium">
                                        {selectedCourseIds.length === details.items.length ? '取消全选' : '全选'}
                                    </button>
                                </div>
                                <div className="grid gap-4">
                                    {details.items.map((item) => {
                                        const isSelected = selectedCourseIds.includes(item.course.id);
                                        const settings = courseSettings.get(item.course.id) || { type: 'Class', priority: 1, tags: [] };

                                        return (
                                            <div key={item.id} className={`border rounded-lg p-4 transition-colors ${isSelected ? 'border-[#137fec] bg-[#137fec]/5' : 'border-white/10 bg-white/5'}`}>
                                                <div className="flex gap-3 mb-3">
                                                    <input
                                                        type="checkbox"
                                                        className="mt-1.5 h-4 w-4 rounded border-slate-600 bg-slate-700 text-[#137fec] focus:ring-[#137fec]"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleCourse(item.course.id)}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between mb-2">
                                                            <div>
                                                                <div className="font-bold text-lg text-[#137fec]">{item.course.code}</div>
                                                                <div className="font-medium text-white">{item.course.name}</div>
                                                            </div>
                                                            <div className="text-sm text-slate-400">{item.course.sessions.length} 节课</div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-slate-900/50 rounded border border-white/5">
                                                            {/* Category Selection */}
                                                            <div className="flex flex-col gap-2">
                                                                <label className="text-xs font-medium text-slate-400">分类</label>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {types.map((t) => (
                                                                        <button
                                                                            key={t.id}
                                                                            onClick={() => updateCourseSetting(item.course.id, 'type', t.name)}
                                                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs border transition-all ${settings.type === t.name
                                                                                ? 'bg-[#137fec]/20 border-[#137fec] text-white'
                                                                                : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500'
                                                                                }`}
                                                                        >
                                                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }}></span>
                                                                            {t.name}
                                                                        </button>
                                                                    ))}
                                                                    <button
                                                                        onClick={() => {
                                                                            setNewTypeName('');
                                                                            setNewTypeColor(TYPE_COLOR_OPTIONS[0]);
                                                                            setTypeModalOpen(true);
                                                                        }}
                                                                        className="flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-dashed border-slate-600 text-slate-500 hover:text-[#137fec] hover:border-[#137fec]"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[14px]">add</span>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Priority Selection */}
                                                            <div className="flex flex-col gap-2">
                                                                <label className="text-xs font-medium text-slate-400">优先级</label>
                                                                <div className="flex rounded-lg border border-slate-700 bg-slate-800 p-0.5">
                                                                    {[
                                                                        { val: 2, label: '高', color: 'text-red-400', bg: 'bg-red-500/20' },
                                                                        { val: 1, label: '中', color: 'text-orange-400', bg: 'bg-orange-500/20' },
                                                                        { val: 0, label: '低', color: 'text-sky-400', bg: 'bg-[#137fec]/20' }
                                                                    ].map((opt) => (
                                                                        <button
                                                                            key={opt.val}
                                                                            onClick={() => updateCourseSetting(item.course.id, 'priority', opt.val)}
                                                                            className={`flex-1 py-1 text-xs font-medium rounded ${settings.priority === opt.val
                                                                                ? `${opt.bg} ${opt.color}`
                                                                                : 'text-slate-500 hover:text-slate-300'
                                                                                }`}
                                                                        >
                                                                            {opt.label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Tags Selection */}
                                                            <div className="flex flex-col gap-2">
                                                                <label className="text-xs font-medium text-slate-400">标签</label>
                                                                <div className="flex flex-wrap gap-1.5 min-h-[32px] p-1.5 rounded border border-slate-700 bg-slate-800">
                                                                    {settings.tags.map(tag => (
                                                                        <span key={tag} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#137fec]/20 text-[#137fec] text-xs">
                                                                            #{tag}
                                                                            <button onClick={() => removeTag(item.course.id, tag)} className="hover:text-white">
                                                                                <span className="material-symbols-outlined text-[10px]">close</span>
                                                                            </button>
                                                                        </span>
                                                                    ))}
                                                                    <input
                                                                        className="flex-1 min-w-[60px] bg-transparent border-none p-0 text-xs text-white placeholder-slate-600 focus:ring-0"
                                                                        placeholder={settings.tags.length === 0 ? "添加标签..." : ""}
                                                                        value={tagInputs.get(item.course.id) || ''}
                                                                        onChange={(e) => handleTagInput(item.course.id, e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                addTag(item.course.id, tagInputs.get(item.course.id) || '');
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                                {/* Quick select tags */}
                                                                {availableTags.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {availableTags.slice(0, 5).map(tag => (
                                                                            <button
                                                                                key={tag}
                                                                                onClick={() => addTag(item.course.id, tag)}
                                                                                className={`px-1.5 py-0.5 rounded text-[10px] border ${settings.tags.includes(tag)
                                                                                    ? 'border-[#137fec] text-[#137fec] bg-[#137fec]/10'
                                                                                    : 'border-slate-700 text-slate-500 hover:border-slate-500'
                                                                                    }`}
                                                                            >
                                                                                #{tag}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="bg-slate-800/30 rounded p-3 space-y-2 mt-3 border border-white/5">
                                                            {item.course.sessions.map(s => (
                                                                <div key={s.id} className="flex text-sm text-slate-400 gap-4">
                                                                    <div className="w-32">📅 {s.date}</div>
                                                                    <div className="w-32">⏰ {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</div>
                                                                    <div>📍 {s.location}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className="px-6 py-4 border-t border-white/10 bg-slate-900 flex justify-between items-center rounded-b-xl">
                    <div className="flex items-center gap-3">
                        <div className="text-sm text-slate-400">已选 {selectedCourseIds.length} 门课程</div>
                        {canManageVisibility && (
                            <button
                                onClick={() => setShowVisibilityModal(true)}
                                className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/50 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                            >
                                <span>👁️</span>
                                管理可见性
                            </button>
                        )}
                        {canSetSelectedPlan && (
                            <button
                                onClick={() => setShowSelectedPlanModal(true)}
                                className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                            >
                                <span>⭐</span>
                                设为选定计划
                            </button>
                        )}
                        {canDelete && (
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                                <span>🗑️</span>
                                删除计划
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:bg-white/5 rounded-lg text-sm font-medium" disabled={applying}>关闭</button>
                        <button onClick={handleApply} className={`px-4 py-2 bg-[#137fec] text-white rounded-lg hover:bg-[#0f6cc8] text-sm font-semibold flex items-center gap-2 ${(selectedCourseIds.length === 0 || applying) ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={selectedCourseIds.length === 0 || applying}>
                            {applying ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>应用中...</> : '应用到日程'}
                        </button>
                    </div>
                </div>
            </div>

            {showVisibilityModal && details && (
                <PlanVisibilityModal
                    planId={planId}
                    planName={details.plan.name}
                    planScope={details.plan.scope_type as 'global' | 'school' | 'class' | 'personal'}
                    onClose={() => setShowVisibilityModal(false)}
                    onSuccess={() => {
                        alert('可见性设置已更新！');
                        setShowVisibilityModal(false);
                    }}
                />
            )}

            {showSelectedPlanModal && details && (
                <SetSelectedPlanModal
                    planId={planId}
                    planName={details.plan.name}
                    onClose={() => setShowSelectedPlanModal(false)}
                    onSuccess={() => {
                        alert('已成功设置为选定计划！');
                        setShowSelectedPlanModal(false);
                    }}
                />
            )}

            {typeModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4 z-[60]">
                    <div className="w-full max-w-sm rounded-xl border border-white/10 bg-slate-900 shadow-xl flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                            <h3 className="text-sm font-medium text-white">添加任务类型</h3>
                            <button
                                className="text-white/60 hover:text-white"
                                type="button"
                                onClick={() => setTypeModalOpen(false)}
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>
                        <div className="px-4 py-4 space-y-4">
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs text-slate-300">类型名称</span>
                                <input
                                    className="h-9 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                                    placeholder="例如：阅读、练习、复习..."
                                    value={newTypeName}
                                    onChange={(e) => setNewTypeName(e.target.value)}
                                />
                            </label>
                            <div className="flex flex-col gap-2">
                                <span className="text-xs text-slate-300">颜色</span>
                                <div className="flex flex-wrap gap-2">
                                    {TYPE_COLOR_OPTIONS.map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            className={`w-7 h-7 rounded-full border-2 ${newTypeColor === c ? 'border-white ring-2 ring-[#137fec]' : 'border-transparent'
                                                }`}
                                            style={{ backgroundColor: c }}
                                            onClick={() => setNewTypeColor(c)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/10 bg-slate-900 rounded-b-xl">
                            <button
                                type="button"
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600"
                                onClick={() => setTypeModalOpen(false)}
                            >
                                取消
                            </button>
                            <button
                                type="button"
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#137fec] hover:bg-[#0f6cc8]"
                                onClick={submitNewType}
                            >
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
