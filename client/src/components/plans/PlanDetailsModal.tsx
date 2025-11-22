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
    tags: string;
}

export function PlanDetailsModal({ planId, onClose, onPlanDeleted }: PlanDetailsModalProps) {
    const { headers } = useAuth();
    const [details, setDetails] = useState<PlanDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
    const [applying, setApplying] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [courseSettings, setCourseSettings] = useState<Map<string, CourseSettings>>(new Map());

    const [availableTypes, setAvailableTypes] = useState<string[]>(['Class', 'Study', 'Exam', 'Activity']);
    const [availableTags, setAvailableTags] = useState<string[]>([]);

    const [showVisibilityModal, setShowVisibilityModal] = useState(false);
    const [showSelectedPlanModal, setShowSelectedPlanModal] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [userRoles, setUserRoles] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [detailsRes, typesRes, tagsRes, profileRes] = await Promise.all([
                    fetch(`/plans/${planId}`, { headers: headers() }),
                    fetch('/tasks/types', { headers: headers() }),
                    fetch('/tasks/tags-list', { headers: headers() }),
                    fetch('/auth/me', { headers: headers() })
                ]);

                if (!detailsRes.ok) throw new Error('Failed to load plan details');
                const data = await detailsRes.json();
                setDetails(data);

                const defaultSettings = new Map<string, CourseSettings>();
                data.items.forEach((item: PlanItem) => {
                    defaultSettings.set(item.course.id, { type: 'Class', priority: 1, tags: '' });
                });
                setCourseSettings(defaultSettings);

                if (typesRes.ok) {
                    const typesData = await typesRes.json();
                    const allTypes = Array.from(new Set(['Class', 'Study', 'Exam', 'Activity', ...(typesData.types || [])]));
                    setAvailableTypes(allTypes);
                }

                if (tagsRes.ok) {
                    const tagsData = await tagsRes.json();
                    setAvailableTags(tagsData.tags || []);
                }

                // Check user role for visibility management
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
            const current = newMap.get(courseId) || { type: 'Class', priority: 1, tags: '' };
            newMap.set(courseId, { ...current, [field]: value });
            return newMap;
        });
    };

    const handleApply = async () => {
        if (selectedCourseIds.length === 0) return;
        setApplying(true);
        try {
            const coursesWithSettings = selectedCourseIds.map(courseId => ({
                courseId,
                settings: {
                    type: (courseSettings.get(courseId) || { type: 'Class', priority: 1, tags: '' }).type,
                    priority: Number((courseSettings.get(courseId) || { type: 'Class', priority: 1, tags: '' }).priority),
                    tags: (courseSettings.get(courseId) || { type: 'Class', priority: 1, tags: '' }).tags.split(',').map(s => s.trim()).filter(Boolean)
                }
            }));

            const res = await fetch(`/plans/${planId}/apply`, {
                method: 'POST',
                headers: { ...headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ courses: coursesWithSettings })
            });

            if (!res.ok) throw new Error((await res.json()).error || 'Failed to apply plan');

            alert(`Success! Added ${(await res.json()).count} sessions to your schedule.`);
            onClose();
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setApplying(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) return;

        setDeleting(true);
        try {
            const res = await fetch(`/plans/${planId}`, {
                method: 'DELETE',
                headers: headers()
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete plan');
            }

            alert('Plan deleted successfully');
            if (onPlanDeleted) onPlanDeleted();
            onClose();
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };

    if (!planId) return null;

    // Determine if user can manage visibility
    const canManageVisibility = details && (
        (details.plan.scope_type === 'global' && userRole === 'system_admin') ||
        (details.plan.scope_type === 'school' && ['school_admin', 'system_admin'].includes(userRole || ''))
    );

    // Determine if user can set selected plan (School Admin or Class Admin)
    const canSetSelectedPlan = ['school_admin', 'class_admin', 'system_admin'].includes(userRole || '');

    // Determine if user can delete plan
    const canDelete = details && (
        (details.plan.scope_type === 'personal' && details.plan.created_by === userId) ||
        (userRole === 'system_admin') ||
        (details.plan.scope_type === 'school' && userRoles.some((r: any) => r.role === 'school_admin' && r.scope_type === 'school' && r.scope_id === details.plan.scope_id)) ||
        (details.plan.scope_type === 'class' && userRoles.some((r: any) => r.role === 'class_admin' && r.scope_type === 'class' && r.scope_id === details.plan.scope_id))
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col text-gray-900">
                <div className="p-6 border-b flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold">{loading ? 'Loading...' : details?.plan.name}</h2>
                        {!loading && details && (
                            <div className="flex gap-2 mt-2">
                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">{details.plan.category}</span>
                                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium capitalize">{details.plan.scope_type}</span>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : error ? (
                        <div className="text-red-500 text-center py-8">{error}</div>
                    ) : details ? (
                        <div className="space-y-6">
                            {details.plan.description && <div className="bg-gray-50 p-4 rounded-lg text-gray-700">{details.plan.description}</div>}

                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold">📚 Courses ({details.items.length})</h3>
                                    <button onClick={handleSelectAll} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                                        {selectedCourseIds.length === details.items.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                <div className="grid gap-4">
                                    {details.items.map((item) => {
                                        const isSelected = selectedCourseIds.includes(item.course.id);
                                        const settings = courseSettings.get(item.course.id) || { type: 'Class', priority: 1, tags: '' };

                                        return (
                                            <div key={item.id} className={`border rounded-lg p-4 ${isSelected ? 'border-blue-500 bg-blue-50/30' : ''}`}>
                                                <div className="flex gap-3 mb-3">
                                                    <input type="checkbox" className="mt-1.5 h-4 w-4" checked={isSelected} onChange={() => handleToggleCourse(item.course.id)} />
                                                    <div className="flex-1">
                                                        <div className="flex justify-between mb-2">
                                                            <div>
                                                                <div className="font-bold text-lg text-blue-600">{item.course.code}</div>
                                                                <div className="font-medium">{item.course.name}</div>
                                                            </div>
                                                            <div className="text-sm text-gray-500">{item.course.sessions.length} sessions</div>
                                                        </div>

                                                        <div className="grid grid-cols-3 gap-3 p-3 bg-white rounded border">
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                                                                <input list={`t-${item.course.id}`} className="w-full text-sm p-1.5 rounded border" value={settings.type} onChange={e => updateCourseSetting(item.course.id, 'type', e.target.value)} placeholder="Type or select..." />
                                                                <datalist id={`t-${item.course.id}`}>{availableTypes.map(t => <option key={t} value={t} />)}</datalist>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                                                                <select className="w-full text-sm p-1.5 rounded border" value={settings.priority} onChange={e => updateCourseSetting(item.course.id, 'priority', Number(e.target.value))}>
                                                                    <option value={0}>Low</option>
                                                                    <option value={1}>Medium</option>
                                                                    <option value={2}>High</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-gray-600 mb-1">Tags</label>
                                                                <input list={`tg-${item.course.id}`} className="w-full text-sm p-1.5 rounded border" value={settings.tags} onChange={e => updateCourseSetting(item.course.id, 'tags', e.target.value)} placeholder="Commaseparated" />
                                                                <datalist id={`tg-${item.course.id}`}>{availableTags.map(t => <option key={t} value={t} />)}</datalist>
                                                            </div>
                                                        </div>

                                                        <div className="bg-gray-50 rounded p-3 space-y-2 mt-3">
                                                            {item.course.sessions.map(s => (
                                                                <div key={s.id} className="flex text-sm text-gray-600 gap-4">
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

                <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-500">{selectedCourseIds.length} courses selected</div>
                        {canManageVisibility && (
                            <button
                                onClick={() => setShowVisibilityModal(true)}
                                className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                            >
                                <span>👁️</span>
                                管理可见性
                            </button>
                        )}
                        {canSetSelectedPlan && (
                            <button
                                onClick={() => setShowSelectedPlanModal(true)}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
                            >
                                <span>⭐</span>
                                设为选定计划
                            </button>
                        )}
                        {canDelete && (
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                                <span>🗑️</span>
                                删除计划
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg" disabled={applying}>Close</button>
                        <button onClick={handleApply} className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 ${(selectedCourseIds.length === 0 || applying) ? 'opacity-50' : ''}`} disabled={selectedCourseIds.length === 0 || applying}>
                            {applying ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>Applying...</> : 'Apply to Schedule'}
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
        </div>
    );
}
