import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

interface ConflictItem {
    sessionId: string;
    proposedTitle: string;
    proposedStart: string; // ISO string
    proposedEnd: string;   // ISO string
    existingBlockId?: string;
    existingTitle: string;
    existingStart: string; // ISO string
    existingEnd: string;   // ISO string
    proposedContent?: string;
    existingContent?: string;
}

interface ConflictModalProps {
    conflicts: ConflictItem[];
    onCancel: () => void;
    onConfirm: () => void;
    onResolve: (sessionId: string, start: string, end: string) => Promise<boolean>;
    onResolveExisting: (blockId: string, start: string, end: string) => Promise<boolean>;
    isApplying: boolean;
    sessionOverrides: Record<string, { start: string, end: string }>;
    existingOverrides: Record<string, { start: string, end: string }>;
}

export function ConflictModal({ conflicts, onCancel, onConfirm, onResolve, onResolveExisting, isApplying, sessionOverrides, existingOverrides }: ConflictModalProps) {
    // New (Proposed) Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editStart, setEditStart] = useState('');
    const [editEnd, setEditEnd] = useState('');

    // Existing Editing State
    const [editingExId, setEditingExId] = useState<string | null>(null);
    const [editExStart, setEditExStart] = useState('');
    const [editExEnd, setEditExEnd] = useState('');

    const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
    const [originalConflicts, setOriginalConflicts] = useState<Map<string, ConflictItem>>(new Map());

    // Keep track of all conflicts seen to show "Resolved" status even if they disappear from props
    useEffect(() => {
        const newMap = new Map(originalConflicts);
        let hasNew = false;
        conflicts.forEach(c => {
            const key = c.sessionId + (c.existingBlockId || '');
            if (!newMap.has(key)) {
                newMap.set(key, c);
                hasNew = true;
            }
        });
        if (hasNew) setOriginalConflicts(newMap);

        // Calculate resolved IDs
        const currentKeys = new Set(conflicts.map(c => c.sessionId + (c.existingBlockId || '')));
        const newResolved = new Set<string>();
        for (const key of newMap.keys()) {
            if (!currentKeys.has(key)) {
                newResolved.add(key);
            }
        }
        setResolvedIds(newResolved);
    }, [conflicts]);

    const formatTime = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        } catch {
            return '??:??';
        }
    };

    const formatDate = (isoString: string) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
        } catch {
            return '';
        }
    }

    // --- Proposed Editing ---
    const startEditing = (c: ConflictItem) => {
        setEditStart(formatDateTimeLocal(c.proposedStart));
        setEditEnd(formatDateTimeLocal(c.proposedEnd));
        setEditingId(c.sessionId);
        setEditingExId(null);
    };

    const handleSaveEdit = async (sessionId: string) => {
        if (!editStart || !editEnd) return;
        const startStr = editStart.replace('T', ' ');
        const endStr = editEnd.replace('T', ' ');
        const success = await onResolve(sessionId, startStr, endStr);
        if (success) {
            setEditingId(null);
        }
    };

    // --- Existing Editing ---
    const formatDateTimeLocal = (isoString: string) => {
        const d = new Date(isoString);
        // Correct for timezone offset to show local time in input
        const offsetMs = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d.getTime() - offsetMs)).toISOString().slice(0, 16);
        return localISOTime;
    };

    const startEditingEx = (c: ConflictItem) => {
        if (!c.existingBlockId) return;
        setEditExStart(formatDateTimeLocal(c.existingStart));
        setEditExEnd(formatDateTimeLocal(c.existingEnd));
        setEditingExId(c.existingBlockId);
        setEditingId(null);
    };

    const handleSaveEditEx = async (blockId: string) => {
        if (!editExStart || !editExEnd) return;
        const startStr = editExStart.replace('T', ' ');
        const endStr = editExEnd.replace('T', ' ');

        const success = await onResolveExisting(blockId, startStr, endStr);
        if (success) {
            setEditingExId(null);
        }
    };

    // Combine current conflicts and resolved ones for display
    const displayItems = Array.from(originalConflicts.values()).map(c => {
        const key = c.sessionId + (c.existingBlockId || '');

        // Check for session overrides (Proposed)
        let displayProposedStart = c.proposedStart;
        let displayProposedEnd = c.proposedEnd;
        if (sessionOverrides[c.sessionId]) {
            const ov = sessionOverrides[c.sessionId];
            // If override is time only "HH:mm", we need to combine with date. 
            // BUT our new logic supports full ISO.
            // Let's assume the override IS the new time string if it contains T or -
            if (ov.start.includes('T') || ov.start.includes('-')) {
                displayProposedStart = ov.start;
                displayProposedEnd = ov.end;
            } else {
                // Fallback: This matches backend logic roughly, but here for display
                // we might just want to show the Time part if the date hasn't changed?
                // Simple approach: Construct a new ISO string for display if possible, OR just trust what the override says.
                // However, formatTime/formatDate expects ISO. 
                // If ov.start is just "10:00", we should probably reconstruct it.
                // Ideally overrides are full ISOs now.
            }
        }

        // Check for existing overrides
        let displayExistingStart = c.existingStart;
        let displayExistingEnd = c.existingEnd;
        if (c.existingBlockId && existingOverrides[c.existingBlockId]) {
            const ov = existingOverrides[c.existingBlockId];
            if (ov.start.includes('T') || ov.start.includes('-')) {
                displayExistingStart = ov.start;
                displayExistingEnd = ov.end;
            }
        }

        return {
            ...c,
            // Override display values
            proposedStart: displayProposedStart,
            proposedEnd: displayProposedEnd,
            existingStart: displayExistingStart,
            existingEnd: displayExistingEnd,

            isResolved: resolvedIds.has(key),
            uniqueKey: key
        };
    });

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-5xl rounded-xl border border-orange-500/30 bg-slate-900 shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-orange-500/10 rounded-t-xl">
                    <div className="p-2 bg-orange-500/20 rounded-full">
                        <span className="material-symbols-outlined text-orange-400 text-xl">warning</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">发现时间冲突</h2>
                        <p className="text-sm text-slate-400">
                            {conflicts.length > 0
                                ? `检测到 ${conflicts.length} 个日程与现有安排重叠`
                                : '所有冲突已解决！'}
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {conflicts.length > 0 && (
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5 text-sm text-slate-300">
                            <p>双击 <span className="text-[#137fec] font-bold">时间</span> 可直接修改。也可忽略冲突继续后，在规划视图中通过冲突筛选调整解决</p>
                        </div>
                    )}

                    {/* Header Row (Desktop) */}
                    <div className="hidden md:flex items-center gap-4 px-4 text-sm font-bold uppercase tracking-wider opacity-80 mb-2">
                        <div className="flex-1 text-[#137fec]">拟添加 New</div>
                        {/* Spacer for connector */}
                        <div className="w-8"></div>
                        <div className="flex-1 text-orange-400">现有 Existing</div>
                    </div>

                    <div className="space-y-3">
                        {displayItems.map((c) => (
                            <div
                                key={c.uniqueKey}
                                className={`flex flex-col md:flex-row gap-4 rounded-lg p-4 border relative items-center transition-all duration-300 ${c.isResolved
                                    ? 'bg-green-500/10 border-green-500/30 opacity-60'
                                    : 'bg-slate-800/40 border-white/5'
                                    }`}
                            >


                                {/* Connector Icon (Desktop) */}
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block z-10">
                                    <div className={`rounded-full p-1 border ${c.isResolved ? 'bg-green-900 border-green-700' : 'bg-red-900/40 border-red-500/50'}`}>
                                        <span className={`material-symbols-outlined text-sm ${c.isResolved ? 'text-green-400' : 'text-red-500'}`}>
                                            {c.isResolved ? 'check' : 'close'}
                                        </span>
                                    </div>
                                </div>

                                {/* Proposed (New) */}
                                <div className={`flex-1 w-full bg-[#137fec]/10 border border-[#137fec]/30 rounded-md p-3 relative group ${c.isResolved ? '' : 'cursor-pointer hover:bg-[#137fec]/20'}`}>
                                    <div className="md:hidden text-[10px] uppercase font-bold text-[#137fec] mb-1">拟添加 New</div>
                                    <div className="font-semibold text-white break-words whitespace-pre-wrap">{c.proposedTitle}</div>
                                    {c.proposedContent && (
                                        <div className="text-xs text-slate-400 mt-1 max-h-40 overflow-y-auto custom-scrollbar break-words prose prose-invert prose-xs max-w-none">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                                {c.proposedContent}
                                            </ReactMarkdown>
                                        </div>
                                    )}


                                    {editingId === c.sessionId ? (
                                        <div className="mt-1 flex flex-col gap-1">
                                            <input
                                                type="datetime-local"
                                                className="w-full bg-slate-900 border border-[#137fec] rounded px-2 py-1 text-xs text-white focus:outline-none"
                                                value={editStart}
                                                onChange={e => setEditStart(e.target.value)}
                                            />
                                            <input
                                                type="datetime-local"
                                                className="w-full bg-slate-900 border border-[#137fec] rounded px-2 py-1 text-xs text-white focus:outline-none"
                                                value={editEnd}
                                                onChange={e => setEditEnd(e.target.value)}
                                            />
                                            <div className="flex justify-end gap-2 mt-1">
                                                <button onClick={() => setEditingId(null)} className="text-[10px] text-slate-400 hover:text-white">取消</button>
                                                <button onClick={() => handleSaveEdit(c.sessionId)} className="text-[10px] text-[#137fec] hover:text-[#0f6cc8] font-bold">确定</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className="flex items-center gap-2 text-xs text-[#137fec]/80 mt-1"
                                            onDoubleClick={() => !c.isResolved && startEditing(c)}
                                        >
                                            <span>📅 {formatDate(c.proposedStart)}</span>
                                            <span>⏰ {formatTime(c.proposedStart)} - {formatTime(c.proposedEnd)}</span>
                                            {!c.isResolved && <span className="material-symbols-outlined text-[10px] opacity-0 group-hover:opacity-100">edit</span>}
                                        </div>
                                    )}
                                </div>

                                {/* Connector for Mobile */}
                                <div className="md:hidden flex justify-center w-full -my-2 z-10">
                                    <span className="material-symbols-outlined text-slate-500 text-sm bg-slate-800 rounded-full p-1">arrow_downward</span>
                                </div>

                                {/* Existing (Old) */}
                                <div className={`flex-1 w-full bg-orange-500/10 border border-orange-500/30 rounded-md p-3 relative group ${c.isResolved || !c.existingBlockId ? '' : 'cursor-pointer hover:bg-orange-500/20'}`}>
                                    <div className="md:hidden text-[10px] uppercase font-bold text-orange-400 mb-1">现有 Existing</div>
                                    <div className="font-semibold text-white/90 break-words whitespace-pre-wrap">{c.existingTitle}</div>
                                    {c.existingContent && (
                                        <div className="text-xs text-orange-300/70 mt-1 max-h-40 overflow-y-auto custom-scrollbar break-words prose prose-invert prose-xs max-w-none">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                                {c.existingContent}
                                            </ReactMarkdown>
                                        </div>
                                    )}


                                    {editingExId === c.existingBlockId ? (
                                        <div className="mt-1 flex flex-col gap-1">
                                            <input
                                                type="datetime-local"
                                                className="w-full bg-slate-900 border border-orange-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                                value={editExStart}
                                                onChange={e => setEditExStart(e.target.value)}
                                            />
                                            <input
                                                type="datetime-local"
                                                className="w-full bg-slate-900 border border-orange-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                                value={editExEnd}
                                                onChange={e => setEditExEnd(e.target.value)}
                                            />
                                            <div className="flex justify-end gap-2 mt-1">
                                                <button onClick={() => setEditingExId(null)} className="text-[10px] text-slate-400 hover:text-white">取消</button>
                                                <button onClick={() => handleSaveEditEx(c.existingBlockId!)} className="text-[10px] text-orange-400 hover:text-orange-300 font-bold">确定</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className="flex items-center gap-2 text-xs text-orange-400/80 mt-1"
                                            onDoubleClick={() => !c.isResolved && startEditingEx(c)}
                                        >
                                            <span>📅 {formatDate(c.existingStart)}</span>
                                            <span>⏰ {formatTime(c.existingStart)} - {formatTime(c.existingEnd)}</span>
                                            {!c.isResolved && c.existingBlockId && <span className="material-symbols-outlined text-[10px] opacity-0 group-hover:opacity-100">edit</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/10 bg-slate-900 rounded-b-xl flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isApplying}
                        className="px-4 py-2 text-slate-300 hover:bg-white/5 rounded-lg text-sm font-medium transition-colors"
                    >
                        取消应用
                    </button>
                    {conflicts.length === 0 ? (
                        <button
                            onClick={onConfirm}
                            disabled={isApplying}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-green-900/20"
                        >
                            {isApplying ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    处理中...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-sm">check</span>
                                    所有冲突已解决，确认应用
                                </>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={onConfirm}
                            disabled={isApplying}
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-orange-900/20"
                        >
                            {isApplying ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    处理中...
                                </>
                            ) : (
                                <>
                                    忽略剩余 {conflicts.length} 个冲突并继续
                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
