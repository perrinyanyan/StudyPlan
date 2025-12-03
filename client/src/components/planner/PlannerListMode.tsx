import type { Task } from '../../types'
import { useState, useMemo } from 'react'
import { PlannerListView } from './PlannerListView'

export interface PlannerListModeProps {
  state: any
  actions: any
}

export function PlannerListMode({ state, actions }: PlannerListModeProps) {
  const {
    listFilterType,
    listFilterPriority,
    listFilterTag,
    listFilterOverdue,
    listFilterDone,
    listTypeOptions,
    listTagOptions,
    rangeBlocks,
    blocks,
    now,
    rangeBlocksLoading,
    taskStatusMap,
    taskTitleMap,
    taskMetaMap,
    listMenuOpenId,
    listEdit,
    tasks,
    unscheduled,
    rangeTasks,
    unschedMenuOpenId,
  } = state || {}

  const {
    setListFilterType,
    setListFilterPriority,
    setListFilterTag,
    setListFilterOverdue,
    setListFilterDone,
    setListMenuOpenId,
    setListEdit,
    setCenterAlert,
    updateTaskMeta,
    completeTask,
    deleteTask,
    fmtHHmm,
    todayStr,
    formatYmdWeek,
    fetchUnscheduled,
    setUnschedMenuOpenId,
    setEditTask,
    setScheduleFor,
    setShowCreateTask,
    updateTaskAdvanced,
    updateBlock,
    headers,
  } = actions || {}

  const [editingCell, setEditingCell] = useState<{ id: string, field: string, value: any } | null>(null)

  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())

  const filteredItems = useMemo(() => {
    const baseBlocks = rangeBlocks !== null ? rangeBlocks : blocks || []
    let arr = [...baseBlocks].sort(
      (a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    )
    if (listFilterOverdue !== 'all') {
      arr = arr.filter((b: any) => {
        const status = b.task_id ? taskStatusMap[String(b.task_id)] : 'open'
        const over = new Date(b.end_at).getTime() < now.getTime()
        const isOverdue = over && status !== 'done'
        return listFilterOverdue === 'yes' ? isOverdue : !isOverdue
      })
    }
    if (listFilterDone !== 'all') {
      arr = arr.filter((b: any) => {
        const st = b.task_id ? taskStatusMap[String(b.task_id)] : 'open'
        return listFilterDone === 'done' ? st === 'done' : st !== 'done'
      })
    }
    if (
      listFilterType !== 'all' ||
      listFilterPriority !== 'all' ||
      listFilterTag !== 'all'
    ) {
      arr = arr.filter((b: any) => {
        if (!b.task_id) return false
        const taskIdStr = String(b.task_id)
        const meta = taskMetaMap[taskIdStr]
        if (!meta) return false
        if (listFilterPriority !== 'all') {
          const p = meta.priority ?? null
          if (String(p ?? '') !== listFilterPriority) return false
        }
        if (listFilterType !== 'all') {
          const t = meta.type || ''
          if (t !== listFilterType) return false
        }
        if (listFilterTag !== 'all') {
          const tags = meta.tags || []
          if (!tags.includes(listFilterTag)) return false
        }
        return true
      })
    }
    return arr
  }, [rangeBlocks, blocks, listFilterOverdue, listFilterDone, listFilterType, listFilterPriority, listFilterTag, taskStatusMap, taskMetaMap, now])

  const visibleTaskIds = useMemo(() => {
    const ids = new Set<string>()
    filteredItems.forEach((b: any) => {
      if (b.task_id) ids.add(String(b.task_id))
    })
    return ids
  }, [filteredItems])

  const handleSave = async (id: string, field: string, value: any) => {
    const block = (rangeBlocks || blocks || []).find((b: any) => String(b.id) === id)
    if (!block) return

    if (field === 'time') {
      const parts = value.split('-').map((s: string) => s.trim())
      if (parts.length !== 2) return
      const [startStr, endStr] = parts

      const getDateWithTime = (baseDate: Date, timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number)
        if (isNaN(h) || isNaN(m)) return null
        const d = new Date(baseDate)
        d.setHours(h)
        d.setMinutes(m)
        d.setSeconds(0)
        d.setMilliseconds(0)
        return d
      }

      const baseDate = new Date(block.start_at)
      const newStart = getDateWithTime(baseDate, startStr)
      const newEnd = getDateWithTime(baseDate, endStr)

      if (newStart && newEnd && updateBlock) {
        await updateBlock(id, { start_at: newStart.toISOString(), end_at: newEnd.toISOString() })
      }
    } else if (field === 'title') {
      if (block.task_id && updateTaskAdvanced) {
        await updateTaskAdvanced(block.task_id, { title: value })
      }
    } else {
      if (block.task_id && updateTaskMeta) {
        const updates: any = {}
        if (field === 'priority') updates.priority = value
        if (field === 'type') updates.type = value
        if (field === 'tags') updates.tags = value
        await updateTaskMeta(block.task_id, updates)
      }
    }
    setEditingCell(null)
  }

  const toggleSelectAll = () => {
    if (visibleTaskIds.size > 0 && Array.from(visibleTaskIds).every(id => selectedTaskIds.has(id))) {
      setSelectedTaskIds(new Set())
    } else {
      setSelectedTaskIds(new Set(visibleTaskIds))
    }
  }

  const toggleSelect = (taskId: string) => {
    const newSet = new Set(selectedTaskIds)
    if (newSet.has(taskId)) {
      newSet.delete(taskId)
    } else {
      newSet.add(taskId)
    }
    setSelectedTaskIds(newSet)
  }

  const handleBulkComplete = async () => {
    if (!completeTask) return
    if (!confirm(`确定要完成选中的 ${selectedTaskIds.size} 个任务吗？`)) return

    // Execute in parallel
    await Promise.all(Array.from(selectedTaskIds).map(id => completeTask(id)))
    setSelectedTaskIds(new Set())
  }

  const handleBulkDelete = async () => {
    if (!deleteTask) return
    if (!confirm(`确定要删除选中的 ${selectedTaskIds.size} 个任务吗？此操作不可撤销。`)) return

    // Execute in parallel
    await Promise.all(Array.from(selectedTaskIds).map(id => deleteTask(id)))
    setSelectedTaskIds(new Set())
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 lg:grid-cols-6 gap-4 lg:gap-6">
      <div className="md:col-span-3 lg:col-span-4">
        <div className="rounded-xl border border-white/10 bg-slate-800/50 overflow-hidden">
          <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-sm p-3 border-b border-white/10">
            <div className="flex flex-wrap gap-3 text-white/90 text-sm items-center">
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                <input
                  type="checkbox"
                  className="rounded border-slate-600 bg-slate-700 text-[#137fec] focus:ring-[#137fec] h-4 w-4"
                  checked={visibleTaskIds.size > 0 && Array.from(visibleTaskIds).every(id => selectedTaskIds.has(id))}
                  onChange={toggleSelectAll}
                />
                <span className="text-xs text-white/70">全选</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                <span className="text-xs text-white/70">类型</span>
                <select
                  className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                  value={listFilterType}
                  onChange={(e) => setListFilterType && setListFilterType(e.target.value)}
                >
                  <option value="all" className="text-slate-900">
                    所有
                  </option>
                  {(listTypeOptions || []).map((name: string) => (
                    <option key={name} value={name} className="text-slate-900">
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                <span className="text-xs text-white/70">优先</span>
                <select
                  className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                  value={listFilterPriority}
                  onChange={(e) => setListFilterPriority && setListFilterPriority(e.target.value as any)}
                >
                  <option value="all" className="text-slate-900">
                    所有
                  </option>
                  <option value="2" className="text-slate-900">
                    高
                  </option>
                  <option value="1" className="text-slate-900">
                    中
                  </option>
                  <option value="0" className="text-slate-900">
                    低
                  </option>
                </select>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                <span className="text-xs text-white/70">标签</span>
                <select
                  className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                  value={listFilterTag}
                  onChange={(e) => setListFilterTag && setListFilterTag(e.target.value)}
                >
                  <option value="all" className="text-slate-900">
                    所有
                  </option>
                  {(listTagOptions || []).map((name: string) => (
                    <option key={name} value={name} className="text-slate-900">
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                <span className="text-xs text-white/70">逾期</span>
                <select
                  className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                  value={listFilterOverdue}
                  onChange={(e) => setListFilterOverdue && setListFilterOverdue(e.target.value as any)}
                >
                  <option value="all" className="text-slate-900">
                    所有
                  </option>
                  <option value="yes" className="text-slate-900">
                    是
                  </option>
                  <option value="no" className="text-slate-900">
                    否
                  </option>
                </select>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                <span className="text-xs text-white/70">完成</span>
                <select
                  className="rounded-lg bg-white/10 border-white/20 text-white text-xs py-1.5 pl-2 pr-6 focus:ring-[#137fec] focus:border-[#137fec]"
                  value={listFilterDone}
                  onChange={(e) => setListFilterDone && setListFilterDone(e.target.value as any)}
                >
                  <option value="all" className="text-slate-900">
                    所有
                  </option>
                  <option value="done" className="text-slate-900">
                    已完成
                  </option>
                  <option value="open" className="text-slate-900">
                    未完成
                  </option>
                </select>
              </div>
            </div>
          </div>
          <div className="space-y-4 p-3 text-white">
            {(() => {
              if (rangeBlocksLoading && rangeBlocks === null)
                return <div className="text-sm text-white/60">加载中...</div>
              if (filteredItems.length === 0)
                return <div className="text-sm text-white/60">该日期范围内暂无条目</div>

              const sections: { key: string; date: Date; items: typeof filteredItems }[] = []
              for (const b of filteredItems) {
                const d = new Date(b.start_at)
                const key = todayStr ? todayStr(d) : d.toISOString().slice(0, 10)
                let sec = sections.find((s2) => s2.key === key)
                if (!sec) {
                  sec = { key, date: d, items: [] as typeof filteredItems }
                  sections.push(sec)
                }
                sec.items.push(b)
              }

              return sections.map((section, sectionIndex) => (
                <div key={section.key} className="space-y-2">
                  <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <span className="inline-flex h-5 w-1 rounded-full bg-slate-400" />
                    <span>
                      {formatYmdWeek ? formatYmdWeek(section.date) : section.key}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {section.items.map((b, itemIndex) => {
                      const s = new Date(b.start_at)
                      const e = new Date(b.end_at)
                      const name = b.task_id ? taskTitleMap[String(b.task_id)] : undefined
                      const over = e.getTime() < now.getTime()
                      const status = b.task_id ? taskStatusMap[String(b.task_id)] : 'open'
                      const isOverdue = over && status !== 'done'
                      const blockId = String(b.id)
                      const taskIdStr = b.task_id ? String(b.task_id) : null
                      const meta = taskIdStr ? taskMetaMap[taskIdStr] : undefined
                      const prio = meta?.priority ?? null
                      const prioLabel =
                        prio === 2 ? '高' : prio === 1 ? '中' : prio === 0 ? '低' : null
                      const prioClass =
                        prio === 2
                          ? 'bg-red-500/20 text-red-300'
                          : prio === 1
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : prio === 0
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-slate-500/20 text-slate-300'
                      const type = meta?.type || null
                      const tags = meta?.tags || []
                      const isMenuOpen = listMenuOpenId === blockId
                      const isLastSection = sectionIndex === sections.length - 1
                      const isLastItem = isLastSection && itemIndex === section.items.length - 1
                      const menuPositionClass = isLastItem ? 'bottom-full mb-1' : 'top-full mt-1'
                      const isEditing = !!(
                        listEdit && taskIdStr && listEdit.taskId === taskIdStr
                      )
                      const isCurrentNow =
                        todayStr &&
                        todayStr(s) === todayStr(now) &&
                        s <= now &&
                        now < e

                      return (
                        <div
                          key={blockId}
                          className={`relative flex flex-col gap-1 rounded-lg bg-white/5 p-2.5 border ${isCurrentNow
                            ? 'border-amber-400 ring-2 ring-amber-400 bg-amber-500/10'
                            : 'border-transparent'
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="rounded border-slate-600 bg-slate-700 text-[#137fec] focus:ring-[#137fec] h-4 w-4"
                                checked={!!taskIdStr && selectedTaskIds.has(taskIdStr)}
                                onChange={(e) => {
                                  if (taskIdStr) toggleSelect(taskIdStr)
                                }}
                                disabled={!taskIdStr}
                              />
                            </div>
                            <div
                              className="w-1.5 h-10 rounded-full"
                              style={{ backgroundColor: (meta?.color || '#60A5FA') + 'CC' }}
                            ></div>
                            <div className="flex items-center justify-between w-full text-sm">
                              <div className="flex flex-col flex-1">
                                <div className="flex items-center gap-1">
                                  {status === 'done' && (
                                    <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[0.65rem] font-medium text-emerald-300">
                                      完成
                                    </span>
                                  )}
                                  {editingCell?.id === blockId && editingCell.field === 'title' ? (
                                    <input
                                      autoFocus
                                      className="bg-slate-700 text-white text-sm px-1 py-0.5 rounded w-full max-w-[200px]"
                                      value={editingCell.value}
                                      onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                                      onBlur={() => handleSave(blockId, 'title', editingCell.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleSave(blockId, 'title', editingCell.value)
                                        if (e.key === 'Escape') setEditingCell(null)
                                      }}
                                      onClick={e => e.stopPropagation()}
                                    />
                                  ) : (
                                    <p
                                      className={`font-medium cursor-pointer hover:underline decoration-dashed decoration-slate-500 ${status === 'done' ? 'line-through opacity-60' : ''
                                        }`}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation()
                                        setEditingCell({ id: blockId, field: 'title', value: name || '' })
                                      }}
                                    >
                                      {name || '时间块'}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-white/80">
                                  {editingCell?.id === blockId && editingCell.field === 'type' ? (
                                    <input
                                      autoFocus
                                      className="bg-slate-700 text-white text-[11px] px-1 py-0 rounded w-20"
                                      value={editingCell.value}
                                      onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                                      onBlur={() => handleSave(blockId, 'type', editingCell.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') handleSave(blockId, 'type', editingCell.value)
                                        if (e.key === 'Escape') setEditingCell(null)
                                      }}
                                      onClick={e => e.stopPropagation()}
                                    />
                                  ) : (
                                    type && (
                                      <span
                                        className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1 cursor-pointer hover:bg-slate-600"
                                        onDoubleClick={(e) => {
                                          e.stopPropagation()
                                          setEditingCell({ id: blockId, field: 'type', value: type })
                                        }}
                                      >
                                        <span
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: meta?.color || '#9CA3AF' }}
                                        ></span>
                                        <span>{type}</span>
                                      </span>
                                    )
                                  )}

                                  {editingCell?.id === blockId && editingCell.field === 'tags' ? (
                                    <input
                                      autoFocus
                                      className="bg-slate-700 text-white text-[11px] px-1 py-0 rounded w-32"
                                      value={editingCell.value}
                                      onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                                      onBlur={() => {
                                        const tags = editingCell.value.split(/[\s,]+/).map((s: string) => s.trim()).filter(Boolean)
                                        handleSave(blockId, 'tags', tags)
                                      }}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          const tags = editingCell.value.split(/[\s,]+/).map((s: string) => s.trim()).filter(Boolean)
                                          handleSave(blockId, 'tags', tags)
                                        }
                                        if (e.key === 'Escape') setEditingCell(null)
                                      }}
                                      onClick={e => e.stopPropagation()}
                                    />
                                  ) : (
                                    tags.map((g: string) => (
                                      <span
                                        key={g}
                                        className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300 cursor-pointer hover:bg-gray-500/30"
                                        onDoubleClick={(e) => {
                                          e.stopPropagation()
                                          setEditingCell({ id: blockId, field: 'tags', value: tags.join(', ') })
                                        }}
                                      >
                                        #{g}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                              <div
                                className={`flex items-center text-white/80 gap-2 text-xs ${status === 'done' ? 'opacity-60' : ''
                                  }`}
                              >
                                {isCurrentNow && (
                                  <button
                                    className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-400"
                                    onClick={() => {
                                      const title = name || '当前时间段任务'
                                      setCenterAlert &&
                                        setCenterAlert({
                                          title: '专注模式',
                                          detail: `请专注完成：${title}`,
                                        })
                                    }}
                                  >
                                    <span className="material-symbols-outlined text-sm">
                                      center_focus_strong
                                    </span>
                                    <span>专注</span>
                                  </button>
                                )}
                                {isOverdue && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-red-500/80 px-2 py-1 font-bold text-white text-xs">
                                    <span className="material-symbols-outlined text-sm">
                                      error
                                    </span>
                                    逾期
                                  </span>
                                )}

                                {editingCell?.id === blockId && editingCell.field === 'time' ? (
                                  <input
                                    autoFocus
                                    className="bg-slate-700 text-white text-xs px-1 py-0.5 rounded w-24 text-center"
                                    value={editingCell.value}
                                    onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                                    onBlur={() => handleSave(blockId, 'time', editingCell.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleSave(blockId, 'time', editingCell.value)
                                      if (e.key === 'Escape') setEditingCell(null)
                                    }}
                                    onClick={e => e.stopPropagation()}
                                  />
                                ) : (
                                  <p
                                    className="whitespace-nowrap cursor-pointer hover:underline decoration-dashed decoration-slate-500"
                                    onDoubleClick={(e) => {
                                      e.stopPropagation()
                                      const timeStr = `${fmtHHmm ? fmtHHmm(s) : ''} - ${fmtHHmm ? fmtHHmm(e) : ''}`
                                      setEditingCell({ id: blockId, field: 'time', value: timeStr })
                                    }}
                                  >
                                    {fmtHHmm ? fmtHHmm(s) : ''} - {fmtHHmm ? fmtHHmm(e) : ''}
                                  </p>
                                )}

                                {editingCell?.id === blockId && editingCell.field === 'priority' ? (
                                  <select
                                    autoFocus
                                    className="bg-slate-700 text-white text-[10px] px-1 py-0 rounded"
                                    value={editingCell.value ?? ''}
                                    onChange={e => {
                                      const val = e.target.value === '' ? null : Number(e.target.value)
                                      setEditingCell({ ...editingCell, value: val })
                                      handleSave(blockId, 'priority', val)
                                    }}
                                    onBlur={() => setEditingCell(null)}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <option value="">无</option>
                                    <option value="2">高</option>
                                    <option value="1">中</option>
                                    <option value="0">低</option>
                                  </select>
                                ) : (
                                  prioLabel && (
                                    <span
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium cursor-pointer hover:opacity-80 ${prioClass}`}
                                      onDoubleClick={(e) => {
                                        e.stopPropagation()
                                        setEditingCell({ id: blockId, field: 'priority', value: prio })
                                      }}
                                    >
                                      <span>{prioLabel}</span>
                                    </span>
                                  )
                                )}
                              </div>
                              <div className="flex items-center gap-2 pl-3">
                                {taskIdStr && (
                                  <div className="relative">
                                    <button
                                      className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setListMenuOpenId &&
                                          setListMenuOpenId(
                                            isMenuOpen ? null : blockId,
                                          )
                                      }}
                                    >
                                      <span className="material-symbols-outlined text-lg">
                                        more_vert
                                      </span>
                                    </button>
                                    {isMenuOpen && (
                                      <div
                                        className={`absolute right-0 w-28 rounded-md bg-slate-900 border border-slate-700 shadow-lg z-20 ${menuPositionClass}`}
                                      >
                                        <button
                                          className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                                          onClick={() => {
                                            if (!taskIdStr) return
                                            const candidates: Task[] = []
                                              ; (tasks.today || []).forEach((x: Task) =>
                                                candidates.push(x),
                                              )
                                              ; (tasks.overdue || []).forEach((x: Task) =>
                                                candidates.push(x),
                                              )
                                              ; (unscheduled || []).forEach((x: Task) =>
                                                candidates.push(x),
                                              )
                                              ; (rangeTasks || []).forEach((x: Task) =>
                                                candidates.push(x),
                                              )
                                            const t = candidates.find(
                                              (x) => String(x.id) === taskIdStr,
                                            )
                                            if (t && setEditTask) {
                                              setEditTask(t)
                                            }
                                            setListMenuOpenId &&
                                              setListMenuOpenId(null)
                                          }}
                                        >
                                          修改
                                        </button>
                                        <button
                                          className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                                          onClick={async () => {
                                            if (!taskIdStr || !completeTask) return
                                            setListMenuOpenId &&
                                              setListMenuOpenId(null)
                                            await completeTask(taskIdStr)
                                          }}
                                        >
                                          完成
                                        </button>
                                        <button
                                          className="block w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-slate-800"
                                          onClick={async () => {
                                            if (!taskIdStr || !deleteTask) return
                                            setListMenuOpenId &&
                                              setListMenuOpenId(null)
                                            await deleteTask(taskIdStr)
                                          }}
                                        >
                                          删除
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          {isEditing && taskIdStr && listEdit && setListEdit && (
                            <div className="mt-1 ml-5 flex flex-wrap items-center gap-2 text-xs text-slate-200">
                              <select
                                className="px-2 py-1 rounded bg-slate-800 border border-slate-600"
                                value={listEdit.priority == null ? '' : String(listEdit.priority)}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setListEdit((prev: any) =>
                                    prev && prev.taskId === taskIdStr
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
                                  setListEdit((prev: any) =>
                                    prev && prev.taskId === taskIdStr
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
                                  setListEdit((prev: any) =>
                                    prev && prev.taskId === taskIdStr
                                      ? { ...prev, tagsInput: e.target.value }
                                      : prev,
                                  )
                                }
                              />
                              <button
                                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
                                onClick={() => setListEdit(null)}
                              >
                                取消
                              </button>
                              <button
                                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500"
                                onClick={async () => {
                                  if (!taskIdStr || !listEdit || listEdit.taskId !== taskIdStr || !updateTaskMeta)
                                    return
                                  const tags = listEdit.tagsInput
                                    .split(/[\s,]+/)
                                    .map((s2: string) => s2.trim().toLowerCase())
                                    .filter(Boolean)
                                  await updateTaskMeta(taskIdStr, {
                                    priority: listEdit.priority,
                                    type: listEdit.type.trim() ? listEdit.type.trim() : null,
                                    tags,
                                  })
                                  setListEdit(null)
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
              ))
            })()}
          </div>
        </div>
      </div>
      <div className="md:col-span-2 lg:col-span-2">
        <PlannerListView
          state={{ unscheduled, unschedMenuOpenId, listEdit, listTagOptions }}
          actions={{
            fetchUnscheduled,
            setUnschedMenuOpenId,
            setListEdit,
            setEditTask,
            setScheduleFor,
            deleteTask,
            setShowCreateTask,
            updateTaskMeta,
            updateTaskAdvanced,
            headers,
          }}
        />
      </div>

      {
        selectedTaskIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur border border-slate-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 z-50 animate-in fade-in slide-in-from-bottom-4">
            <span className="text-white font-medium">已选择 {selectedTaskIds.size} 项</span>
            <div className="h-4 w-px bg-slate-700"></div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkComplete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors text-sm font-medium"
              >
                <span className="material-symbols-outlined text-lg">check_circle</span>
                完成
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
                删除
              </button>
            </div>
            <button
              onClick={() => setSelectedTaskIds(new Set())}
              className="ml-2 text-slate-400 hover:text-white"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        )
      }
    </div >
  )
}
