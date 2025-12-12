import { useMemo, useState } from 'react'
import type { Task } from '../../types'
import { TaskTypeSelector } from './TaskTypeSelector'
import { TaskTagSelector } from './TaskTagSelector'
import { TaskPrioritySelector } from './TaskPrioritySelector'

export interface PlannerListViewProps {
  state: any
  actions: any
}

export function PlannerListView({ state, actions }: PlannerListViewProps) {
  const { unscheduled, unschedMenuOpenId, listEdit, taskMetaMap } = state || {}
  const { fetchUnscheduled, setUnschedMenuOpenId, setListEdit, setEditTask, setScheduleFor, deleteTask, setShowCreateTask, updateTaskAdvanced, updateTaskMeta } = actions || {}

  const [editingCell, setEditingCell] = useState<{ id: string, field: string, value: any } | null>(null)

  const list = useMemo(() => {
    const raw = (unscheduled || []) as Task[]
    return [...raw].sort((a, b) => {
      // 1. Today Must
      const aMust = a.recurrence_rule?.includes('TODAY_MUST') ? 1 : 0
      const bMust = b.recurrence_rule?.includes('TODAY_MUST') ? 1 : 0
      if (aMust !== bMust) return bMust - aMust

      // 2. Pinned
      const aPinned = a.recurrence_rule?.includes('PINNED') ? 1 : 0
      const bPinned = b.recurrence_rule?.includes('PINNED') ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned

      // 3. Priority (2 > 1 > 0 > null)
      const aPrio = typeof a.priority === 'number' ? a.priority : -1
      const bPrio = typeof b.priority === 'number' ? b.priority : -1
      if (aPrio !== bPrio) return bPrio - aPrio

      // 4. Title
      return (a.title || '').localeCompare(b.title || '')
    })
  }, [unscheduled])

  const handleSave = (id: string, field: string, value: any, extras?: any) => {
    setEditingCell(null)
    if (field === 'title') {
      updateTaskAdvanced(id, { title: value })
    } else if (field === 'duration') {
      updateTaskAdvanced(id, { estimate_min: value })
    } else {
      // For meta fields (priority, type, tags)
      const t = list.find(t => String(t.id) === id)
      if (!t) return
      const updates: any = {}
      if (field === 'priority') updates.priority = value
      if (field === 'type') {
        updates.type = value
        if (extras?.color) updates.color = extras.color
      }
      if (field === 'tags') updates.tags = value

      updateTaskMeta(id, updates)
    }
  }

  return (
    <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <h2 className="font-semibold mb-3">任务池</h2>
      <div className="mb-3">
        <div className="flex flex-col gap-2">
          {list.length === 0 && <div className="text-xs text-slate-400">暂无未排程任务</div>}
          {list.map((t, index) => {
            const isLast = index === list.length - 1
            const menuPositionClass = isLast ? 'bottom-full mb-1' : 'top-full mt-1'
            const isTodayMust = t.recurrence_rule?.includes('TODAY_MUST')
            return (
              <div
                key={String(t.id)}
                className={`p-3 rounded-lg ${isTodayMust ? 'bg-amber-500/10' : 'bg-white/5'} hover:ring-1 hover:ring-blue-400/50`}
              >
                <div className="flex items-center gap-1.5">
                  {/* Drag Handle */}
                  <div
                    className="flex items-center justify-center w-3 h-8 cursor-grab active:cursor-grabbing hover:bg-white/10 rounded transition-colors -ml-2.5"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'pool-task',
                        taskId: String(t.id),
                        taskTitle: t.title,
                        estimateMin: t.estimate_min || 30,
                        color: t.color,
                        recurrenceRule: t.recurrence_rule || '',
                      }))
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                  >
                    {/* Grip Dots 2x3 */}
                    <div className="grid grid-cols-2 gap-0.5 opacity-40">
                      <div className="w-0.5 h-0.5 rounded-full bg-white"></div>
                      <div className="w-0.5 h-0.5 rounded-full bg-white"></div>
                      <div className="w-0.5 h-0.5 rounded-full bg-white"></div>
                      <div className="w-0.5 h-0.5 rounded-full bg-white"></div>
                      <div className="w-0.5 h-0.5 rounded-full bg-white"></div>
                      <div className="w-0.5 h-0.5 rounded-full bg-white"></div>
                    </div>
                  </div>
                  {/* Color bar */}
                  <div className="w-1.5 h-10 rounded-full" style={{ backgroundColor: (t.color || '#4B5563') + '80' }}></div>
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      {editingCell?.id === String(t.id) && editingCell.field === 'title' ? (
                        <input
                          autoFocus
                          className="bg-slate-700 text-white text-sm px-1 py-0.5 rounded w-full"
                          value={editingCell.value}
                          onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                          onBlur={() => handleSave(String(t.id), 'title', editingCell.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSave(String(t.id), 'title', editingCell.value)
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                        />
                      ) : (
                        <p
                          className="text-white text-sm font-medium leading-tight cursor-pointer hover:underline decoration-dashed decoration-slate-500"
                          onDoubleClick={() => setEditingCell({ id: String(t.id), field: 'title', value: t.title })}
                        >
                          {t.title}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-white/80">
                      {/* Priority */}
                      {editingCell?.id === String(t.id) && editingCell.field === 'priority' ? (
                        <div className="relative">
                          {typeof t.priority === 'number' ? (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium cursor-pointer hover:opacity-80 ${t.priority === 2
                                ? 'bg-red-500/20 text-red-300'
                                : t.priority === 1
                                  ? 'bg-yellow-500/20 text-yellow-300'
                                  : 'bg-green-500/20 text-green-300'
                                }`}
                              onClick={e => e.stopPropagation()}
                            >
                              {t.priority === 2 ? 'H' : t.priority === 1 ? 'M' : 'L'}
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium cursor-pointer hover:opacity-80 bg-slate-500/20 text-slate-300"
                              onClick={e => e.stopPropagation()}
                            >
                              无
                            </span>
                          )}
                          <TaskPrioritySelector
                            currentPriority={editingCell.value}
                            onSelect={(val) => {
                              handleSave(String(t.id), 'priority', val)
                              setEditingCell(null)
                            }}
                            onClose={() => setEditingCell(null)}
                          />
                        </div>
                      ) : (
                        typeof t.priority === 'number' && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium cursor-pointer hover:opacity-80 ${t.priority === 2
                              ? 'bg-red-500/20 text-red-300'
                              : t.priority === 1
                                ? 'bg-yellow-500/20 text-yellow-300'
                                : 'bg-green-500/20 text-green-300'
                              }`}
                            onDoubleClick={() => setEditingCell({ id: String(t.id), field: 'priority', value: t.priority })}
                          >
                            {t.priority === 2 ? 'H' : t.priority === 1 ? 'M' : 'L'}
                          </span>
                        )
                      )}

                      {/* Type */}
                      {editingCell?.id === String(t.id) && editingCell.field === 'type' ? (
                        <div className="relative">
                          {t.type && (
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || '#9CA3AF' }}></span>
                              <span>{t.type}</span>
                            </span>
                          )}
                          {!t.type && <span className="text-[10px] text-slate-500">无类型</span>}
                          <TaskTypeSelector
                            currentType={editingCell.value}
                            onSelect={(type) => {
                              setEditingCell({ ...editingCell, value: type.name })
                              handleSave(String(t.id), 'type', type.name, { color: type.color })
                            }}
                            onClose={() => setEditingCell(null)}
                            authHeaders={actions.headers ? actions.headers() : {}}
                          />
                          {/* Overlay to close on click outside */}
                          <div
                            className="fixed inset-0 z-40"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingCell(null)
                            }}
                          />
                        </div>
                      ) : (
                        t.type && (
                          <span
                            className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1 cursor-pointer hover:bg-slate-600"
                            onDoubleClick={() => setEditingCell({ id: String(t.id), field: 'type', value: t.type })}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || '#9CA3AF' }}></span>
                            <span>{t.type}</span>
                          </span>
                        )
                      )}

                      {/* Tags */}
                      {editingCell?.id === String(t.id) && editingCell.field === 'tags' ? (
                        <div className="relative">
                          <div className="flex flex-wrap gap-1">
                            {(editingCell.value as string[]).map((g: string) => (
                              <span key={g} className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300">
                                #{g}
                              </span>
                            ))}
                            {(editingCell.value as string[]).length === 0 && (
                              <span className="text-gray-500 text-[10px]">#</span>
                            )}
                          </div>
                          <TaskTagSelector
                            currentTags={editingCell.value as string[]}
                            availableTags={state.listTagOptions || []}
                            onSelect={(tags) => {
                              setEditingCell({ ...editingCell, value: tags })
                              handleSave(String(t.id), 'tags', tags)
                            }}
                            onClose={() => setEditingCell(null)}
                            authHeaders={actions.headers ? actions.headers() : {}}
                          />
                        </div>
                      ) : (
                        (t.tags && t.tags.length > 0) ? (
                          t.tags.map((g) => (
                            <span
                              key={g}
                              className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300 cursor-pointer hover:bg-gray-500/30"
                              onDoubleClick={() => setEditingCell({ id: String(t.id), field: 'tags', value: t.tags || [] })}
                            >
                              #{g}
                            </span>
                          ))
                        ) : (
                          <span
                            className="text-gray-500 text-[10px] cursor-pointer hover:underline decoration-dashed decoration-slate-600"
                            onDoubleClick={() => setEditingCell({ id: String(t.id), field: 'tags', value: [] })}
                          >
                            #
                          </span>
                        )
                      )}
                    </div>
                  </div>
                  {/* Duration Display */}
                  <div className="px-1.5 min-w-[3.5rem] flex justify-end">
                    {editingCell?.id === String(t.id) && editingCell.field === 'duration' ? (
                      <div className="flex items-center justify-end">
                        <input
                          autoFocus
                          type="number"
                          className="bg-slate-700 text-white text-xs px-0.5 py-0 rounded w-[40px] text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border border-blue-500/50 focus:border-blue-500 focus:ring-0"
                          value={editingCell.value}
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0
                            setEditingCell({
                              ...editingCell,
                              value: val
                            })
                          }}
                          onBlur={() => handleSave(String(t.id), 'duration', editingCell.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSave(String(t.id), 'duration', editingCell.value)
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                        />
                        <span className="text-xs text-slate-400 ml-0.5">min</span>
                      </div>
                    ) : (
                      <p
                        className="text-xs text-slate-400 cursor-pointer hover:text-slate-200 hover:underline decoration-dashed decoration-slate-500 text-right"
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setEditingCell({ id: String(t.id), field: 'duration', value: t.estimate_min || 30 })
                        }}
                      >
                        {t.estimate_min || 30} min
                      </p>
                    )}
                  </div>
                  {/* Action menu */}
                  <div className="relative">
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!setUnschedMenuOpenId) return
                        const idStr = String(t.id)
                        setUnschedMenuOpenId((prev: string | null) => (prev === idStr ? null : idStr))
                      }}
                    >
                      <span className="material-symbols-outlined text-lg">more_vert</span>
                    </button>
                    {unschedMenuOpenId === String(t.id) && (
                      <div
                        className={`absolute right-0 w-28 rounded-md bg-slate-900 border border-slate-700 shadow-lg z-20 ${menuPositionClass}`}
                      >
                        <button
                          className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                          onClick={() => {
                            setEditTask && setEditTask(t)
                            setUnschedMenuOpenId && setUnschedMenuOpenId(null)
                          }}
                        >
                          修改/安排
                        </button>
                        <button
                          className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                          onClick={async () => {
                            if (!updateTaskAdvanced) {
                              alert('updateTaskAdvanced 函数不可用')
                              return
                            }
                            setUnschedMenuOpenId && setUnschedMenuOpenId(null)
                            const parts = (t.recurrence_rule || 'POOL').split(';')
                            const isTodayMust = parts.includes('TODAY_MUST')
                            let newParts = parts.filter(p => p !== 'TODAY_MUST')
                            if (!isTodayMust) {
                              newParts.push('TODAY_MUST')
                            }
                            // Ensure POOL is present if it's the only rule or if it was there
                            if (!newParts.includes('POOL') && (parts.includes('POOL') || newParts.length === 0 || (newParts.length === 1 && newParts[0] === 'TODAY_MUST'))) {
                              if (!newParts.includes('POOL')) newParts.unshift('POOL')
                            }

                            const newRule = newParts.join(';')
                            await updateTaskAdvanced(t.id, {
                              title: t.title,
                              recurrence_rule: newRule,
                            })
                          }}
                        >
                          {t.recurrence_rule?.includes('TODAY_MUST') ? '取消今日必' : '今日必'}
                        </button>
                        <button
                          className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                          onClick={async () => {
                            if (!updateTaskAdvanced) {
                              alert('updateTaskAdvanced 函数不可用')
                              return
                            }
                            setUnschedMenuOpenId && setUnschedMenuOpenId(null)
                            const parts = (t.recurrence_rule || 'POOL').split(';')
                            const isPinned = parts.includes('PINNED')
                            let newParts = parts.filter(p => p !== 'PINNED')
                            if (!isPinned) {
                              newParts.push('PINNED')
                            }
                            if (newParts.length === 0) newParts.push('POOL')
                            const newRule = newParts.join(';')

                            const result = await updateTaskAdvanced(t.id, {
                              title: t.title,
                              recurrence_rule: newRule,
                            })
                          }}
                        >
                          {t.recurrence_rule?.includes('PINNED') ? '取消固定' : '固定'}
                        </button>

                        <button
                          className="block w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-slate-800"
                          onClick={async () => {
                            if (!deleteTask) return
                            setUnschedMenuOpenId && setUnschedMenuOpenId(null)
                            await deleteTask(t.id)
                          }}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                  {/* TODAY_MUST and PINNED icons */}
                  <div className="flex flex-col items-center justify-center w-4 gap-1">
                    {t.recurrence_rule?.includes('TODAY_MUST') && (
                      <div className="w-4 h-4 rounded bg-red-500 flex items-center justify-center shadow-sm">
                        <span className="text-[10px] text-white leading-none font-bold scale-90">今</span>
                      </div>
                    )}
                    {t.recurrence_rule?.includes('PINNED') && (
                      <span className="material-symbols-outlined text-[14px] text-amber-400 rotate-45">push_pin</span>
                    )}
                  </div>
                </div>
                {listEdit && listEdit.taskId === String(t.id) && (
                  <div className="mt-2 ml-5 flex flex-wrap items-center gap-2 text-xs text-slate-200">
                    <select
                      className="px-2 py-1 rounded bg-slate-800 border border-slate-600"
                      value={listEdit.priority == null ? '' : String(listEdit.priority)}
                      onChange={(e) => {
                        const v = e.target.value
                        setListEdit &&
                          setListEdit((prev: any) =>
                            prev && prev.taskId === String(t.id)
                              ? { ...prev, priority: v === '' ? null : Number(v) }
                              : prev,
                          )
                      }}
                    >
                      <option value="">优先级(无)</option>
                      <option value="2">高</option>
                      <option value="1">中</option>
                      <option value="0">低</option>
                    </select>
                    <input
                      className="px-2 py-1 rounded bg-slate-800 border border-slate-600 flex-1 min-w-[6rem]"
                      placeholder="任务类型"
                      value={listEdit.type}
                      onChange={(e) =>
                        setListEdit &&
                        setListEdit((prev: any) =>
                          prev && prev.taskId === String(t.id)
                            ? { ...prev, type: e.target.value }
                            : prev,
                        )
                      }
                    />
                    <input
                      className="px-2 py-1 rounded bg-slate-800 border border-slate-600 flex-1 min-w-[8rem]"
                      placeholder="标签，用空格或逗号分隔"
                      value={listEdit.tagsInput}
                      onChange={(e) =>
                        setListEdit &&
                        setListEdit((prev: any) =>
                          prev && prev.taskId === String(t.id)
                            ? { ...prev, tagsInput: e.target.value }
                            : prev,
                        )
                      }
                    />
                    <button
                      className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                      onClick={() => setListEdit && setListEdit(null)}
                    >
                      取消
                    </button>
                    <button
                      className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500"
                      onClick={async () => {
                        if (!listEdit || listEdit.taskId !== String(t.id) || !actions.updateTaskMeta) return
                        const tags = listEdit.tagsInput
                          .split(/[\s,]+/)
                          .map((s2: string) => s2.trim().toLowerCase())
                          .filter(Boolean)
                        await actions.updateTaskMeta(String(t.id), {
                          priority: listEdit.priority,
                          type: listEdit.type.trim() ? listEdit.type.trim() : null,
                          tags,
                        })
                        setListEdit && setListEdit(null)
                      }}
                    >
                      保存
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <button
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#137fec] py-2.5 text-sm font-bold text-white hover:bg-[#0f6cc8]"
        onClick={() => setShowCreateTask && setShowCreateTask(true)}
      >
        <span className="material-symbols-outlined text-xl">add_circle</span>
        添加新任务
      </button>
    </section >
  )
}
