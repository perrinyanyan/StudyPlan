import React, { useEffect, useState } from 'react';
import { getApiUrl } from '../../config';
import { useAuth } from '../../hooks/useAuth';
import { PlanVisibilityModal } from './PlanVisibilityModal';
import { ConflictModal } from './ConflictModal';
import { TaskTypeSelector } from '../planner/TaskTypeSelector';
import { TaskTagSelector } from '../planner/TaskTagSelector';
import { TaskPrioritySelector } from '../planner/TaskPrioritySelector';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface PlanDetailsModalProps {
    planId: string;
    onClose: () => void;
    onPlanDeleted?: () => void;
    showToast?: (msg: string) => void;
}

interface Session {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    location: string;
    content?: string | null;
}

interface Course {
    id: string;
    code: string;
    name: string;
    sessions: Session[];
}

interface CourseSettings {
    type: string;
    priority: number;
    tags: string[];
}

interface PlanItem {
    id: string;
    kind: string;
    course: Course;
    settings?: CourseSettings;
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

type TypeRow = { id: string; name: string; color: string }

export function PlanDetailsModal({ planId, onClose, onPlanDeleted, showToast }: PlanDetailsModalProps) {
    const { headers } = useAuth();
    const [details, setDetails] = useState<PlanDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
    const [applying, setApplying] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [courseSettings, setCourseSettings] = useState<Map<string, CourseSettings>>(new Map());

    // Inline editing state
    const [editingCell, setEditingCell] = useState<{ id: string, field: string, value: any } | null>(null);

    const [types, setTypes] = useState<TypeRow[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);

    const [showVisibilityModal, setShowVisibilityModal] = useState(false);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [pendingConflicts, setPendingConflicts] = useState<any[]>([]);

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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [detailsRes, typesRes, tagsRes, profileRes] = await Promise.all([
                    fetch(getApiUrl(`/plans/${planId}`), { headers: headers() }),
                    fetch(getApiUrl('/task-types'), { headers: headers() }),
                    fetch(getApiUrl('/tasks/tags-list'), { headers: headers() }),
                    fetch(getApiUrl('/auth/me'), { headers: headers() })
                ]);

                if (!detailsRes.ok) throw new Error('加载计划详情失败');
                const data = await detailsRes.json();
                setDetails(data);

                const defaultSettings = new Map<string, CourseSettings>();
                data.items.forEach((item: PlanItem) => {
                    if (item.settings) {
                        defaultSettings.set(item.course.id, item.settings);
                    } else {
                        defaultSettings.set(item.course.id, { type: 'Class', priority: 1, tags: [] });
                    }
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

    const updateCourseSetting = async (courseId: string, field: keyof CourseSettings, value: any) => {
        // Optimistic update
        setCourseSettings(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(courseId) || { type: 'Class', priority: 1, tags: [] };
            newMap.set(courseId, { ...current, [field]: value });
            return newMap;
        });

        // Find the plan item ID
        const item = details?.items.find(i => i.course.id === courseId);
        if (!item) return;

        // Prepare new settings
        const currentSettings = courseSettings.get(courseId) || { type: 'Class', priority: 1, tags: [] };
        const newSettings = { ...currentSettings, [field]: value };

        try {
            const res = await fetch(getApiUrl(`/plans/${planId}/items/${item.id}`), {
                method: 'PATCH',
                headers: { ...headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: newSettings })
            });

            if (!res.ok) {
                throw new Error('Failed to update settings');
            }
        } catch (err) {
            console.error('Failed to persist settings:', err);
        }
    };

    async function addType(name: string, color: string): Promise<boolean> {
        const trimmed = name.trim();
        if (!trimmed) {
            alert('请输入类型名称');
            return false;
        }
        try {
            const r = await fetch(getApiUrl('/task-types'), {
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
            const typesRes = await fetch(getApiUrl('/task-types'), { headers: headers() });
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

    const [sessionOverrides, setSessionOverrides] = useState<Record<string, { start: string, end: string }>>({});
    const [existingOverrides, setExistingOverrides] = useState<Record<string, { start: string, end: string }>>({});

    const handleResolveConflict = async (sessionId: string, start: string, end: string) => {
        const tempOverrides = { ...sessionOverrides, [sessionId]: { start, end } };
        const conflicts = await checkConflicts(tempOverrides, existingOverrides, false); // Dry run

        // If the 'checkConflicts' returns null (empty), it means success implicitly if selectedCourseIds > 0
        // But we want to see if THIS item is still in conflict.
        const stillInConflict = conflicts?.some((c: any) => c.sessionId === sessionId);
        if (stillInConflict) {
            const conflict = conflicts?.find((c: any) => c.sessionId === sessionId);
            alert(`修改未生效：与 "${conflict?.existingTitle}" 时间冲突！\n(${conflict?.existingStart} - ${conflict?.existingEnd})`);
            return false;
        }

        setSessionOverrides(tempOverrides);
        // Commit: Update the UI with the new conflict state (should show resolved for this item)
        await checkConflicts(tempOverrides, existingOverrides, true);
        return true;
    };

    const handleResolveExisting = async (blockId: string, start: string, end: string) => {
        const tempExOverrides = { ...existingOverrides, [blockId]: { start, end } };
        const conflicts = await checkConflicts(sessionOverrides, tempExOverrides, false); // Dry run

        const stillInConflict = conflicts?.some((c: any) => c.existingBlockId === blockId);
        if (stillInConflict) {
            const conflict = conflicts?.find((c: any) => c.existingBlockId === blockId);
            alert(`修改未生效：修改后的现有日程与 "${conflict?.proposedTitle}" 仍有冲突！`);
            return false;
        }

        setExistingOverrides(tempExOverrides);
        // Commit
        await checkConflicts(sessionOverrides, tempExOverrides, true);
        return true;
    };

    const checkConflicts = async (overrides: Record<string, { start: string, end: string }>, exOverrides: Record<string, { start: string, end: string }> = existingOverrides, updateState = true) => {
        if (selectedCourseIds.length === 0) return [];
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

            const checkRes = await fetch(getApiUrl(`/plans/${planId}/apply`), {
                method: 'POST',
                headers: { ...headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ courses: coursesWithSettings, checkOnly: true, sessionOverrides: overrides, existingOverrides: exOverrides })
            });

            if (!checkRes.ok) throw new Error((await checkRes.json()).error || '检查冲突失败');
            const checkData = await checkRes.json();

            if (updateState) {
                setPendingConflicts(checkData.conflicts || []);
            }
            return checkData.conflicts || [];

        } catch (err: any) {
            alert('检查冲突出错: ' + err.message);
            return [];
        } finally {
            setApplying(false);
        }
    };

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

            // Step 1: Check for conflicts
            const checkRes = await fetch(getApiUrl(`/plans/${planId}/apply`), {
                method: 'POST',
                headers: { ...headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ courses: coursesWithSettings, checkOnly: true, sessionOverrides, existingOverrides })
            });

            if (!checkRes.ok) throw new Error((await checkRes.json()).error || '检查冲突失败');
            const checkData = await checkRes.json();

            if (checkData.conflicts && checkData.conflicts.length > 0) {
                setPendingConflicts(checkData.conflicts);
                setShowConflictModal(true);
                setApplying(false);
                return;
            }

            // Step 2: Apply (No conflicts)
            await executeApply(coursesWithSettings);

        } catch (err: any) {
            alert('错误: ' + err.message);
            setApplying(false);
        }
    };

    const executeApply = async (coursesPayload: any[]) => {
        setApplying(true);
        try {
            const res = await fetch(getApiUrl(`/plans/${planId}/apply`), {
                method: 'POST',
                headers: { ...headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ courses: coursesPayload, checkOnly: false, sessionOverrides, existingOverrides })
            });

            if (!res.ok) throw new Error((await res.json()).error || '应用计划失败');

            if (showToast) {
                showToast(`成功！已添加 ${(await res.json()).count} 个日程到您的时间表。`);
            } else {
                alert(`成功！已添加 ${(await res.json()).count} 个日程到您的时间表。`);
            }
            setShowConflictModal(false);
            onClose();
        } catch (err: any) {
            alert('错误: ' + err.message);
        } finally {
            setApplying(false);
        }
    }

    const handleDelete = async () => {
        if (!confirm('确定要删除此计划吗？此操作无法撤销。')) return;

        setDeleting(true);
        try {
            const res = await fetch(getApiUrl(`/plans/${planId}`), {
                method: 'DELETE',
                headers: headers()
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '删除计划失败');
            }

            if (showToast) showToast('计划删除成功');
            else alert('计划删除成功');

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



    const canDelete = details && (
        (details.plan.scope_type.toLowerCase() === 'personal' && details.plan.created_by === userId) ||
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
                            {details.plan.description || editingCell?.field === 'description' ? (
                                editingCell?.field === 'description' ? (
                                    <div className="bg-slate-800/50 p-4 rounded-lg border border-white/5 relative group">
                                        <textarea
                                            className="w-full bg-slate-900/50 text-slate-300 text-sm border border-slate-700 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                            rows={3}
                                            value={editingCell.value}
                                            onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                                            onBlur={async () => {
                                                const val = editingCell.value;
                                                // Optimistic update
                                                setDetails(prev => prev ? { ...prev, plan: { ...prev.plan, description: val } } : null);
                                                setEditingCell(null);

                                                try {
                                                    const res = await fetch(getApiUrl(`/plans/${planId}`), {
                                                        method: 'PATCH',
                                                        headers: { ...headers(), 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ description: val })
                                                    });
                                                    if (!res.ok) throw new Error('Update failed');
                                                    if (showToast) showToast('描述已更新')
                                                } catch (err) {
                                                    console.error(err);
                                                    alert('保存描述失败');
                                                }
                                            }}
                                            autoFocus
                                        />
                                        <div className="text-[10px] text-slate-500 mt-1 text-right">点击外部保存</div>
                                    </div>
                                ) : (
                                    <div
                                        className="bg-slate-800/50 p-4 rounded-lg text-slate-300 border border-white/5 cursor-pointer hover:bg-slate-800/70 transition-colors group relative"
                                        onDoubleClick={() => canDelete && setEditingCell({ id: 'plan', field: 'description', value: details.plan.description || '' })}
                                        title={canDelete ? "双击编辑描述" : ""}
                                    >
                                        <div className="prose prose-invert prose-sm max-w-none [&>p]:mb-1 [&>ul]:mb-1 [&>ol]:mb-1 last:[&>*]:mb-0 [&_mark]:bg-yellow-500/40 [&_mark]:text-yellow-100">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                                {(details.plan.description || '').replace(/==([^=]+)==/g, '<mark>$1</mark>')}
                                            </ReactMarkdown>
                                        </div>
                                        {canDelete && (
                                            <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-opacity">
                                                <span className="material-symbols-outlined text-sm">edit</span>
                                            </span>
                                        )}
                                    </div>
                                )
                            ) : (
                                canDelete && (
                                    <div
                                        className="bg-slate-800/30 p-4 rounded-lg text-slate-500 border border-dashed border-white/10 cursor-pointer hover:bg-slate-800/50 transition-colors text-center text-sm"
                                        onClick={() => setEditingCell({ id: 'plan', field: 'description', value: '' })}
                                    >
                                        + 添加计划描述...
                                    </div>
                                )
                            )}

                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-white">📚 课程 ({details.items.length})</h3>
                                    <button onClick={handleSelectAll} className="text-sm text-[#137fec] hover:text-[#0f6cc8] font-medium">
                                        {selectedCourseIds.length === details.items.length ? '取消全选' : '全选'}
                                    </button>
                                </div>
                                <div className="grid gap-2">
                                    {details.items.map((item) => {
                                        const isSelected = selectedCourseIds.includes(item.course.id);
                                        const settings = courseSettings.get(item.course.id) || { type: 'Class', priority: 1, tags: [] };
                                        const typeObj = types.find(t => t.name === settings.type);

                                        return (
                                            <div key={item.id} className={`border rounded-lg p-3 transition-colors ${isSelected ? 'border-[#137fec] bg-[#137fec]/5' : 'border-white/10 bg-white/5'}`}>
                                                <div className="flex items-start gap-3">
                                                    <input
                                                        type="checkbox"
                                                        className="mt-1.5 h-4 w-4 rounded border-slate-600 bg-slate-700 text-[#137fec] focus:ring-[#137fec]"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleCourse(item.course.id)}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-bold text-[#137fec]">{item.course.code}</span>
                                                                <span className="font-medium text-white">{item.course.name}</span>

                                                                {/* Priority */}
                                                                {editingCell?.id === item.course.id && editingCell.field === 'priority' ? (
                                                                    <div className="relative">
                                                                        <TaskPrioritySelector
                                                                            currentPriority={editingCell.value}
                                                                            onSelect={(val) => {
                                                                                updateCourseSetting(item.course.id, 'priority', val);
                                                                                setEditingCell(null);
                                                                            }}
                                                                            onClose={() => setEditingCell(null)}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <span
                                                                        className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium cursor-pointer hover:opacity-80 ${settings.priority === 2
                                                                            ? 'bg-red-500/20 text-red-300'
                                                                            : settings.priority === 1
                                                                                ? 'bg-yellow-500/20 text-yellow-300'
                                                                                : 'bg-green-500/20 text-green-300'
                                                                            }`}
                                                                        onDoubleClick={() => setEditingCell({ id: item.course.id, field: 'priority', value: settings.priority })}
                                                                    >
                                                                        {settings.priority === 2 ? '高' : settings.priority === 1 ? '中' : '低'}
                                                                    </span>
                                                                )}

                                                                {/* Type */}
                                                                {editingCell?.id === item.course.id && editingCell.field === 'type' ? (
                                                                    <div className="relative">
                                                                        <TaskTypeSelector
                                                                            currentType={editingCell.value}
                                                                            onSelect={(type) => {
                                                                                updateCourseSetting(item.course.id, 'type', type.name);
                                                                                setEditingCell(null);
                                                                            }}
                                                                            onClose={() => setEditingCell(null)}
                                                                            authHeaders={headers()}
                                                                        />
                                                                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setEditingCell(null); }} />
                                                                    </div>
                                                                ) : (
                                                                    <span
                                                                        className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1 cursor-pointer hover:bg-slate-600 text-xs"
                                                                        onDoubleClick={() => setEditingCell({ id: item.course.id, field: 'type', value: settings.type })}
                                                                    >
                                                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: typeObj?.color || '#9CA3AF' }}></span>
                                                                        <span>{settings.type}</span>
                                                                    </span>
                                                                )}

                                                                {/* Tags */}
                                                                {editingCell?.id === item.course.id && editingCell.field === 'tags' ? (
                                                                    <div className="relative">
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {(editingCell.value as string[]).map((g: string) => (
                                                                                <span key={g} className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300 text-xs">#{g}</span>
                                                                            ))}
                                                                        </div>
                                                                        <TaskTagSelector
                                                                            currentTags={editingCell.value as string[]}
                                                                            availableTags={availableTags}
                                                                            onSelect={(tags) => {
                                                                                updateCourseSetting(item.course.id, 'tags', tags);
                                                                                setEditingCell(null);
                                                                            }}
                                                                            onClose={() => setEditingCell(null)}
                                                                            authHeaders={headers()}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    settings.tags.length > 0 ? (
                                                                        settings.tags.map((g) => (
                                                                            <span
                                                                                key={g}
                                                                                className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300 cursor-pointer hover:bg-gray-500/30 text-xs"
                                                                                onDoubleClick={() => setEditingCell({ id: item.course.id, field: 'tags', value: settings.tags })}
                                                                            >
                                                                                #{g}
                                                                            </span>
                                                                        ))
                                                                    ) : (
                                                                        <span
                                                                            className="text-gray-500 text-[10px] cursor-pointer hover:underline decoration-dashed decoration-slate-600"
                                                                            onDoubleClick={() => setEditingCell({ id: item.course.id, field: 'tags', value: [] })}
                                                                        >
                                                                            #
                                                                        </span>
                                                                    )
                                                                )}
                                                            </div>

                                                            <div className="text-sm text-slate-400">{item.course.sessions.length} 节课</div>
                                                        </div>

                                                        <div className="bg-slate-800/30 rounded p-2 space-y-1 mt-2 border border-white/5">
                                                            {item.course.sessions.map(s => (
                                                                <div key={s.id} className="flex flex-col gap-1 border-b border-white/5 last:border-0 pb-1 last:pb-0">
                                                                    <div className="flex text-xs text-slate-400 gap-3">
                                                                        <div className="w-24">📅 {s.date}</div>
                                                                        <div className="w-24">⏰ {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}</div>
                                                                        <div>📍 {s.location}</div>
                                                                    </div>
                                                                    {s.content && (
                                                                        <div className="text-xs text-slate-500 pl-2 border-l-2 border-slate-700 ml-1">
                                                                            {s.content}
                                                                        </div>
                                                                    )}
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
            </div >

            {showVisibilityModal && details && (
                <PlanVisibilityModal
                    planId={planId}
                    planName={details.plan.name}
                    planScope={details.plan.scope_type as 'global' | 'school' | 'class' | 'personal'}
                    onClose={() => setShowVisibilityModal(false)}
                    onSuccess={() => {
                        if (showToast) showToast('可见性设置已更新')
                        else alert('可见性设置已更新！');
                        setShowVisibilityModal(false);
                    }}
                />
            )}

            {showConflictModal && (
                <ConflictModal
                    conflicts={pendingConflicts}
                    onCancel={() => {
                        setShowConflictModal(false);
                        setPendingConflicts([]);
                    }}
                    onResolve={handleResolveConflict}
                    onResolveExisting={handleResolveExisting}
                    onConfirm={() => {
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
                        executeApply(coursesWithSettings);
                    }}
                    isApplying={applying}
                    sessionOverrides={sessionOverrides}
                    existingOverrides={existingOverrides}
                />
            )}

            {
                typeModalOpen && (
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
                )
            }
        </div >
    );
}
