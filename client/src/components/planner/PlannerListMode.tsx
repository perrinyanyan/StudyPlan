import type { Task } from '../../types'
import { useState, useMemo, Fragment } from 'react'
import { PlannerListView } from './PlannerListView'
import { MultiSelect } from '../ui/MultiSelect'
import { TypeFilterDropdown } from '../ui/TypeFilterDropdown'
import { TaskTypeSelector } from './TaskTypeSelector'
import { TaskTagSelector } from './TaskTagSelector'
import { TaskPrioritySelector } from './TaskPrioritySelector'
import { getConflictIds } from '../../utils/conflicts'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { fmtRange, todayStr } from '../../utils/datetime'

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
    listFilterConflict,
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
    setListFilterConflict,
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
    createTaskAdvanced,
  } = actions || {}

  const handleCopyToPool = async (task: any) => {
    if (!createTaskAdvanced || !task) return
    const payload = {
      title: task.title,
      recurrence_rule: 'POOL',
      priority: task.priority,
      type: task.type,
      color: task.color,
      tags: task.tags,
      estimated_time: task.estimated_time,
      description: task.description,
    }
    await createTaskAdvanced(payload)
  }

  const [editingCell, setEditingCell] = useState<{ id: string, field: string, value: any } | null>(null)

  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  // Optimistic Blocks State
  const [optimisticBlocks, setOptimisticBlocks] = useState<any[]>([])

  // External Drag State
  const [externalDragOver, setExternalDragOver] = useState<{
    dateKey: string,
    insertIndex: number | null,
    suggestedStart: Date | null,
    suggestedEnd: Date | null,
    hasConflict: boolean
  } | null>(null)

  const handleExternalDragOver = (e: React.DragEvent, dateKey: string, sectionItems: any[]) => {
    e.preventDefault()
    e.stopPropagation()

    // 1. Calculate Insert Index based on Mouse Y
    // Use target element (container) to get relative position? No, container has many items.
    // Better to use the item elements. We assume items are rendered in order.
    // Simple heuristic: Iterate items, find first item where mouseY < itemMiddle.
    // If none found, index = length (append).

    const mouseY = e.clientY
    // Find all item divs in this section container
    // We can't access DOM refs easily here without refs map.
    // Alternative: Use e.target if it's an item, or calculate geometry if we assume uniform height? Items vary.
    // A robust way: `document.elementsFromPoint` or assume the container is `e.currentTarget`.
    // Let's rely on the SECTION container's geometry and items' relative positions roughly.
    // Actually, `e.currentTarget` is the section container div.
    const container = e.currentTarget as HTMLElement
    // Get all direct children (task items) - skipping headers which might be first child?
    // Our render: Header is 1st child, Items div is 2nd child (space-y-2).
    // The handler is on the WRAPPER div (line 493/modified).
    // Structure:
    // <div wrapper>
    //   <div header> ... </div>
    //   <div items-wrapper>
    //      <div item>...</div> ...
    //   </div>
    // </div>
    // Wait, the handler is on the wrapper `div key={section.key}`.
    // The items are in the second child div.

    const itemsWrapper = container.children[1] as HTMLElement
    if (!itemsWrapper) return

    let insertIndex = sectionItems.length
    const items = Array.from(itemsWrapper.children) as HTMLElement[]

    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect()
      const middle = rect.top + rect.height / 2
      if (mouseY < middle) {
        insertIndex = i
        break
      }
    }

    // 2. Identify Tasks Above and Below
    const prevTask = insertIndex > 0 ? sectionItems[insertIndex - 1] : null
    const nextTask = insertIndex < sectionItems.length ? sectionItems[insertIndex] : null

    // 3. Get Drag Data (Estimated Dur)
    let estimateMin = 60
    let data = (window as any).__dragPoolTask
    if (!data) {
      // Try fallback if feasible, else default
    }
    if (data && data.estimateMin) estimateMin = data.estimateMin

    // 4. Calculate Times
    const targetDate = new Date(dateKey)
    let suggestedStart: Date | null = null
    let suggestedEnd: Date | null = null

    // Case A: Between Two Tasks (Next exists, Prev exists)
    // "如果在两个任务之间，那开始时间是上方任务的截止时间"
    if (prevTask && nextTask) {
      suggestedStart = new Date(prevTask.end_at)
    }
    // Case B: Top of List (No Prev, Next exists)
    // "如果在当日第一个任务上方，那截止时间是对方的开始时间"
    else if (!prevTask && nextTask) {
      const nextStart = new Date(nextTask.start_at)
      suggestedStart = new Date(nextStart.getTime() - estimateMin * 60000)
    }
    // Case C: Bottom of List (Prev exists, No Next)
    // "如果在当日最后一个任务下方，那开始时间是对方的截止时间"
    else if (prevTask && !nextTask) {
      suggestedStart = new Date(prevTask.end_at)
    }
    // Case D: Empty List
    else if (!prevTask && !nextTask) {
      // Default 09:00
      suggestedStart = new Date(targetDate)
      suggestedStart.setHours(9, 0, 0, 0)
    }

    if (!suggestedStart) { // Fallback safety
      suggestedStart = new Date(targetDate)
      suggestedStart.setHours(9, 0, 0, 0)
    }

    // Set End Time
    suggestedEnd = new Date(suggestedStart.getTime() + estimateMin * 60000)

    // 5. Conflict Check (Space Check)
    // "如果空闲时长不够...不允许放置"
    let hasConflict = false
    const startMs = suggestedStart.getTime()
    const endMs = suggestedEnd.getTime()

    // Validate boundaries (00:00 - 24:00)
    const dayStart = new Date(targetDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate); dayEnd.setHours(24, 0, 0, 0);

    if (startMs < dayStart.getTime() || endMs > dayEnd.getTime()) {
      hasConflict = true
    }

    // Check overlaps with ANY task in the list (not just adjacent, though logic implies adjacent is constrained)
    // Since we are inserting at specific index, we mainly care about:
    //  - If Prev exists: suggestedStart >= Prev.End (Guaranteed by logic generally)
    //  - If Next exists: suggestedEnd <= Next.Start
    if (nextTask) {
      const nextStartMs = new Date(nextTask.start_at).getTime()
      if (endMs > nextStartMs) {
        hasConflict = true
        // Clamp for visual (optional, but requirement says "show conflict hint")
        // preventing placement is done loop drop logic
      }
    }
    // Double check prev task overlap just in case
    if (prevTask) {
      const prevEndMs = new Date(prevTask.end_at).getTime()
      if (startMs < prevEndMs) {
        hasConflict = true
      }
    }

    // Also check other tasks just in case? Sorted list implies locality is sufficient.

    setExternalDragOver({
      dateKey,
      insertIndex,
      suggestedStart,
      suggestedEnd,
      hasConflict
    })
  }

  const handleExternalDragLeave = () => {
    setExternalDragOver(null)
  }

  const handleExternalDrop = async (e: React.DragEvent, dateKey: string) => {
    e.preventDefault()
    // Capture state before clearing
    const dropState = externalDragOver
    setExternalDragOver(null)

    if (!dropState || dropState.hasConflict || !dropState.suggestedStart || !dropState.suggestedEnd) {
      if (dropState?.hasConflict && setCenterAlert) {
        setCenterAlert({ title: '无法放置', detail: '该时间段没有足够的空闲时间' })
      }
      return
    }

    try {
      let data = (window as any).__dragPoolTask
      if (!data) {
        try {
          const json = e.dataTransfer.getData('application/json')
          if (json) data = JSON.parse(json)
        } catch (e) { /* ignore */ }
      }

      if (!data) return
      if (data.type && data.type !== 'pool-task') return

      const startTime = dropState.suggestedStart
      const endTime = dropState.suggestedEnd
      const estimateMin = data.estimateMin || 60

      // Optimistic Update
      const tempId = data.taskId || 'temp-' + Date.now()
      const optimisticBlock = {
        id: tempId,
        task_id: data.taskId,
        start_at: startTime.toISOString(),
        end_at: endTime.toISOString(),
      }
      setOptimisticBlocks(prev => [...prev, optimisticBlock])

      try {
        if (updateTaskAdvanced) {
          const isPinned = data.recurrenceRule?.includes('PINNED')
          if (isPinned && createTaskAdvanced) {
            await createTaskAdvanced({
              title: data.taskTitle,
              estimate_min: estimateMin,
              due_at: endTime.toISOString(),
              priority: data.priority,
              tags: data.tags,
              type: data.taskType,
              content: data.content,
              recurrence_rule: '',
              color: data.color
            })
          } else {
            await updateTaskAdvanced(data.taskId, {
              title: data.taskTitle,
              due_at: endTime.toISOString(),
              estimate_min: estimateMin,
              recurrence_rule: '',
            })
          }
          if (fetchUnscheduled) fetchUnscheduled()
        }
      } finally {
        setOptimisticBlocks(prev => prev.filter(b => b.id !== tempId))
      }

    } catch (err) {
      console.error(err)
      setOptimisticBlocks(prev => [])
    }
  }

  // Merge optimistic blocks with rangeBlocks
  const mergedRangeBlocks = useMemo(() => {
    const base = rangeBlocks || blocks || []
    const optIds = new Set(optimisticBlocks.map(b => String(b.id)))
    const filteredBase = base.filter((b: any) => !optIds.has(String(b.id)))
    return [...filteredBase, ...optimisticBlocks]
  }, [rangeBlocks, blocks, optimisticBlocks])

  const filteredItems = useMemo(() => {
    const baseBlocks = mergedRangeBlocks
    let arr = [...baseBlocks].sort(
      (a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    )

    if (listFilterConflict === 'conflicts') {
      const conflictIds = getConflictIds(arr)
      arr = arr.filter((b: any) => conflictIds.has(String(b.id)))
    }

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
        if (listFilterTag && listFilterTag.length > 0 && !listFilterTag.includes('all')) {
          const tags = meta.tags || []
          if (!listFilterTag.some((t: string) => tags.includes(t))) return false
        }
        return true
      })
    }
    return arr
  }, [rangeBlocks, blocks, listFilterOverdue, listFilterDone, listFilterType, listFilterPriority, listFilterTag, listFilterConflict, taskStatusMap, taskMetaMap, now])

  const visibleTaskIds = useMemo(() => {
    const ids = new Set<string>()
    filteredItems.forEach((b: any) => {
      if (b.task_id) ids.add(String(b.task_id))
    })
    return ids
  }, [filteredItems])

  const handleSave = (id: string, field: string, value: any, extras?: any) => {
    setEditingCell(null)
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
        updateBlock(id, { start_at: newStart.toISOString(), end_at: newEnd.toISOString() })
      }
    } else if (field === 'duration') {
      if (updateBlock) {
        const { start, currentDurationMin, newDurationMin } = value

        // Optimistic update
        const newEnd = new Date(start.getTime() + newDurationMin * 60000)
        updateBlock(id, {
          start_at: start.toISOString(),
          end_at: newEnd.toISOString()
        })
      }
    } else if (field === 'title') {
      if (block.task_id && updateTaskAdvanced) {
        updateTaskAdvanced(block.task_id, { title: value })
      }
    } else if (field === 'content') {
      if (block.task_id && updateTaskAdvanced) {
        updateTaskAdvanced(block.task_id, { content: value })
      }
    } else {
      if (block.task_id && updateTaskMeta) {
        const updates: any = {}
        if (field === 'priority') updates.priority = value
        if (field === 'type') {
          updates.type = value
          if (extras?.color) updates.color = extras.color
        }
        if (field === 'tags') updates.tags = value
        updateTaskMeta(block.task_id, updates)
      }
    }
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
      <div className="md:col-span-3 lg:col-span-4 relative">
        {/* Filter Toggle Button */}
        <div className="absolute -top-[3.25rem] right-0 z-10 flex items-center gap-2">
          <button
            onClick={() => actions.setShowCreateTask && actions.setShowCreateTask(true)}
            className="p-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700 text-white/70 hover:text-white transition-colors border border-white/10"
            title="新建任务"
          >
            <span className="material-symbols-outlined text-sm">add</span>
          </button>
          <button
            onClick={() => actions.setShowFilters && actions.setShowFilters(!state.showFilters)}
            className="p-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-700 text-white/70 hover:text-white transition-colors border border-white/10"
            title={state.showFilters ? "隐藏筛选" : "显示筛选"}
          >
            <span className="material-symbols-outlined text-sm">
              {state.showFilters ? 'filter_alt_off' : 'filter_alt'}
            </span>
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-slate-800/50">
          {state.showFilters && (
            <div className="sticky top-0 z-50 bg-black/20 backdrop-blur-sm p-3 border-b border-white/10">
              <div className="flex flex-wrap gap-3 text-white/90 text-sm items-center">
                <div className="flex items-center gap-2">
                  <button
                    className={`px-2 py-1 rounded text-xs transition-colors border border-white/10 ${isSelectionMode ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                    onClick={() => {
                      if (isSelectionMode) {
                        setSelectedTaskIds(new Set()) // Clear selection when closing
                      }
                      setIsSelectionMode(!isSelectionMode)
                    }}
                  >
                    {isSelectionMode ? '关闭选择' : '选择'}
                  </button>
                  {isSelectionMode && (
                    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5">
                      <input
                        type="checkbox"
                        className="rounded border-slate-600 bg-slate-700 text-[#137fec] focus:ring-[#137fec] h-4 w-4"
                        checked={visibleTaskIds.size > 0 && Array.from(visibleTaskIds).every(id => selectedTaskIds.has(id))}
                        onChange={toggleSelectAll}
                      />
                      <span className="text-xs text-white/70">全选</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/70">类型</span>
                  <TypeFilterDropdown
                    value={listFilterType}
                    onChange={(val) => setListFilterType && setListFilterType(val)}
                    options={listTypeOptions || []}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/70">优先</span>
                  <select
                    className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                    value={listFilterPriority}
                    onChange={(e) => setListFilterPriority && setListFilterPriority(e.target.value as any)}
                  >
                    <option value="all" className="bg-slate-800 text-white">
                      所有
                    </option>
                    <option value="2" className="bg-slate-800 text-white">
                      高
                    </option>
                    <option value="1" className="bg-slate-800 text-white">
                      中
                    </option>
                    <option value="0" className="bg-slate-800 text-white">
                      低
                    </option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <MultiSelect
                    label="标签"
                    options={listTagOptions || []}
                    value={listFilterTag || []}
                    onChange={(tags) => setListFilterTag && setListFilterTag(tags)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/70">逾期</span>
                  <select
                    className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                    value={listFilterOverdue}
                    onChange={(e) => setListFilterOverdue && setListFilterOverdue(e.target.value as any)}
                  >
                    <option value="all" className="bg-slate-800 text-white">
                      所有
                    </option>
                    <option value="yes" className="bg-slate-800 text-white">
                      是
                    </option>
                    <option value="no" className="bg-slate-800 text-white">
                      否
                    </option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/70">完成</span>
                  <select
                    className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                    value={listFilterDone}
                    onChange={(e) => setListFilterDone && setListFilterDone(e.target.value as any)}
                  >
                    <option value="all" className="bg-slate-800 text-white">
                      所有
                    </option>
                    <option value="done" className="bg-slate-800 text-white">
                      已完成
                    </option>
                    <option value="open" className="bg-slate-800 text-white">
                      未完成
                    </option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/70">冲突</span>
                  <select
                    className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                    value={listFilterConflict || 'all'}
                    onChange={(e) => setListFilterConflict && setListFilterConflict(e.target.value)}
                  >
                    <option value="all" className="bg-slate-800 text-white">所有</option>
                    <option value="conflicts" className="bg-slate-800 text-white">仅冲突</option>
                  </select>
                </div>
              </div>
            </div>
          )}
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
                <div
                  key={section.key}
                  className={`space-y-2 rounded-lg transition-all ${externalDragOver?.dateKey === section.key ? 'bg-blue-500/10 ring-2 ring-blue-500 p-2' : ''}`}
                  onDragOver={(e) => handleExternalDragOver(e, section.key, section.items)}
                  onDragLeave={handleExternalDragLeave}
                  onDrop={(e) => handleExternalDrop(e, section.key)}
                >
                  <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <span className="inline-flex h-5 w-1 rounded-full bg-slate-400" />
                    <span>
                      {formatYmdWeek ? formatYmdWeek(section.date) : section.key}
                    </span>
                    {externalDragOver?.dateKey === section.key && (
                      <span className="text-xs text-blue-400 ml-2">释放以添加任务</span>
                    )}
                  </div>
                  <div className="space-y-2 relative">
                    {/* Insert Line at Top (Index 0) */}
                    {externalDragOver?.dateKey === section.key && externalDragOver.insertIndex === 0 && (
                      <div className={`mt-1 mb-1 h-0.5 rounded flex items-center justify-between px-1 text-[10px] ${externalDragOver.hasConflict ? 'bg-red-500 text-red-300' : 'bg-blue-500 text-blue-300'}`}>
                        <span>{externalDragOver.suggestedStart ? fmtHHmm(externalDragOver.suggestedStart) : '--:--'} - {externalDragOver.suggestedEnd ? fmtHHmm(externalDragOver.suggestedEnd) : '--:--'}</span>
                        {externalDragOver.hasConflict && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">warning</span>冲突</span>}
                      </div>
                    )}

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
                        prio === 2 ? 'H' : prio === 1 ? 'M' : prio === 0 ? 'L' : null
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
                        <Fragment key={blockId}>
                          <div
                            className={`relative flex flex-col gap-1 rounded-lg bg-white/5 p-2.5 border hover:ring-1 hover:ring-blue-400/50 transition-all ${isCurrentNow
                              ? 'border-amber-400 ring-2 ring-amber-400 bg-amber-500/10'
                              : 'border-transparent'
                              }`}
                          >
                            <div className="flex items-center gap-2.5">
                              {isSelectionMode && (
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
                              )}
                              <div
                                className="w-1.5 h-10 rounded-full"
                                style={{ backgroundColor: (meta?.color || '#60A5FA') + 'CC' }}
                              ></div>
                              <div className="flex items-center justify-between w-full text-sm">
                                <div className="flex flex-col flex-1">
                                  <div className="flex items-center gap-1">
                                    {status === 'done' && (
                                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20" title="已完成">
                                        <span className="material-symbols-outlined text-emerald-400 text-sm">check</span>
                                      </span>
                                    )}
                                    {/* Overdue Icon */}
                                    {isOverdue && (
                                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500/20" title="逾期">
                                        <span className="material-symbols-outlined text-red-500 text-sm">close</span>
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
                                        className={`font-medium cursor-pointer hover:underline decoration-dashed decoration-slate-500 ${status === 'done' ? 'opacity-60' : ''
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
                                    {/* Priority Label */}
                                    {editingCell?.id === blockId && editingCell.field === 'priority' ? (
                                      <div className="relative">
                                        <span
                                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium cursor-pointer hover:opacity-80 ${prioClass}`}
                                          onClick={e => e.stopPropagation()}
                                        >
                                          {prioLabel || '无'}
                                        </span>
                                        <TaskPrioritySelector
                                          currentPriority={editingCell.value}
                                          onSelect={(val) => {
                                            handleSave(blockId, 'priority', val)
                                            setEditingCell(null)
                                          }}
                                          onClose={() => setEditingCell(null)}
                                        />
                                      </div>
                                    ) : (
                                      prioLabel && (
                                        <span
                                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium cursor-pointer hover:opacity-80 ${prioClass}`}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation()
                                            setEditingCell({ id: blockId, field: 'priority', value: prio })
                                          }}
                                        >
                                          {prioLabel}
                                        </span>
                                      )
                                    )}
                                    {/* Type */}
                                    {editingCell?.id === blockId && editingCell.field === 'type' ? (
                                      <div className="relative">
                                        <span
                                          className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1 cursor-pointer hover:bg-slate-600"
                                          onClick={e => e.stopPropagation()}
                                        >
                                          <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: meta?.color || '#9CA3AF' }}
                                          ></span>
                                          <span>{editingCell.value || '无类型'}</span>
                                        </span>
                                        <TaskTypeSelector
                                          currentType={editingCell.value}
                                          authHeaders={actions.headers()}
                                          onSelect={(t) => {
                                            handleSave(blockId, 'type', t.name, { color: t.color })
                                            setEditingCell(null)
                                          }}
                                          onClose={() => setEditingCell(null)}
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
                                          availableTags={listTagOptions || []}
                                          onSelect={(tags) => {
                                            setEditingCell({ ...editingCell, value: tags })
                                            handleSave(blockId, 'tags', tags)
                                          }}
                                          onClose={() => setEditingCell(null)}
                                          authHeaders={actions.headers ? actions.headers() : {}}
                                        />
                                        {/* Overlay handled by TaskTagSelector */}
                                      </div>
                                    ) : (
                                      (tags && tags.length > 0) ? (
                                        tags.map((g: string) => (
                                          <span
                                            key={g}
                                            className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300 cursor-pointer hover:bg-gray-500/30"
                                            onDoubleClick={(e) => {
                                              e.stopPropagation()
                                              setEditingCell({ id: blockId, field: 'tags', value: tags })
                                            }}
                                          >
                                            #{g}
                                          </span>
                                        ))
                                      ) : (
                                        <span
                                          className="text-gray-500 text-[10px] cursor-pointer hover:underline decoration-dashed decoration-slate-600"
                                          onDoubleClick={(e) => {
                                            e.stopPropagation()
                                            setEditingCell({ id: blockId, field: 'tags', value: [] })
                                          }}
                                        >
                                          #
                                        </span>
                                      )
                                    )}
                                  </div>
                                  {/* Content Field Display */}
                                  {/* Content Field Display */}
                                  {editingCell?.id === blockId && editingCell.field === 'content' ? (
                                    <textarea
                                      autoFocus
                                      className="bg-slate-700 text-white text-xs px-2 py-1.5 mt-1 rounded w-full resize-y focus:outline-none focus:ring-1 focus:ring-slate-500"
                                      style={{ minHeight: '150px', lineHeight: '1.5' }}
                                      value={editingCell.value}
                                      onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                                      onBlur={() => handleSave(blockId, 'content', editingCell.value)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault()
                                          handleSave(blockId, 'content', editingCell.value)
                                        }
                                        if (e.key === 'Escape') setEditingCell(null)
                                      }}
                                      onClick={e => e.stopPropagation()}
                                    />
                                  ) : (
                                    (meta?.content) ? (
                                      <div className="w-full mt-1">
                                        <div
                                          className="text-gray-400 text-xs block cursor-pointer hover:bg-white/5 rounded p-1 -m-1 transition-colors"
                                          onDoubleClick={(e) => {
                                            e.stopPropagation()
                                            setEditingCell({ id: blockId, field: 'content', value: meta.content })
                                          }}
                                        >
                                          <div className="prose prose-invert prose-xs max-w-none [&>p]:my-0 [&>ul]:my-1 [&>ol]:my-1 [&>ul]:pl-4 [&>ol]:pl-4 [&_mark]:bg-yellow-500/30 [&_mark]:text-yellow-100">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                              {meta.content.replace(/==([^=]+)==/g, '<mark>$1</mark>')}
                                            </ReactMarkdown>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="w-full mt-1">
                                        <span
                                          className="text-gray-600 text-xs italic cursor-pointer hover:text-gray-400"
                                          onDoubleClick={(e) => {
                                            e.stopPropagation()
                                            setEditingCell({ id: blockId, field: 'content', value: '' })
                                          }}
                                        >
                                          双击添加描述...
                                        </span>
                                      </div>
                                    )
                                  )}
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


                                  {editingCell?.id === blockId && editingCell.field === 'time' ? (
                                    <div
                                      className="flex items-center gap-0.5 bg-slate-800 rounded px-0.5 time-edit-container"
                                      onClick={e => e.stopPropagation()}
                                      onBlur={(e) => {
                                        const target = e.relatedTarget as HTMLElement | null
                                        if (target && target.closest('.time-edit-container')) return
                                        const timeStr = `${editingCell.value.startStr} - ${editingCell.value.endStr}`
                                        handleSave(blockId, 'time', timeStr)
                                      }}
                                    >
                                      <input
                                        type="time"
                                        className="bg-transparent text-white text-[10px] p-0 border-none focus:ring-0 w-[32px] h-4 leading-none [&::-webkit-calendar-picker-indicator]:hidden text-center"
                                        value={editingCell.value.startStr}
                                        onChange={e => setEditingCell({
                                          ...editingCell,
                                          value: { ...editingCell.value, startStr: e.target.value }
                                        })}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            const timeStr = `${editingCell.value.startStr} - ${editingCell.value.endStr}`
                                            handleSave(blockId, 'time', timeStr)
                                          }
                                          if (e.key === 'Escape') setEditingCell(null)
                                        }}
                                      />
                                      <span className="text-[10px]">-</span>
                                      <input
                                        type="time"
                                        className="bg-transparent text-white text-[10px] p-0 border-none focus:ring-0 w-[32px] h-4 leading-none [&::-webkit-calendar-picker-indicator]:hidden text-center"
                                        value={editingCell.value.endStr}
                                        onChange={e => setEditingCell({
                                          ...editingCell,
                                          value: { ...editingCell.value, endStr: e.target.value }
                                        })}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            const timeStr = `${editingCell.value.startStr} - ${editingCell.value.endStr}`
                                            handleSave(blockId, 'time', timeStr)
                                          }
                                          if (e.key === 'Escape') setEditingCell(null)
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center gap-1">
                                      <p
                                        className="whitespace-nowrap cursor-pointer hover:underline decoration-dashed decoration-slate-500"
                                        onDoubleClick={(ev) => {
                                          ev.stopPropagation()
                                          const fmt = (d: Date) => {
                                            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                                          }
                                          setEditingCell({
                                            id: blockId,
                                            field: 'time',
                                            value: {
                                              startStr: fmt(s),
                                              endStr: fmt(e)
                                            }
                                          })
                                        }}
                                      >
                                        {fmtRange(s, e)}
                                      </p>
                                      {editingCell?.id === blockId && editingCell.field === 'duration' ? (
                                        <div className="flex items-center justify-center">
                                          <input
                                            autoFocus
                                            type="number"
                                            className="bg-slate-700 text-white text-[10px] px-0.5 py-0 rounded w-[40px] text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border border-blue-500/50 focus:border-blue-500 focus:ring-0"
                                            value={editingCell.value.newDurationMin}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => {
                                              const val = parseInt(e.target.value) || 0
                                              setEditingCell({
                                                ...editingCell,
                                                value: { ...editingCell.value, newDurationMin: val }
                                              })
                                            }}
                                            onBlur={() => handleSave(blockId, 'duration', editingCell.value)}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') handleSave(blockId, 'duration', editingCell.value)
                                              if (e.key === 'Escape') setEditingCell(null)
                                            }}
                                          />
                                          <span className="text-[10px] text-slate-400 ml-0.5">min</span>
                                        </div>
                                      ) : (
                                        <p
                                          className="text-slate-400 cursor-pointer hover:text-slate-300 hover:underline decoration-dashed decoration-slate-500"
                                          onDoubleClick={(ev) => {
                                            ev.stopPropagation()
                                            const durationMin = Math.round((e.getTime() - s.getTime()) / 60000)
                                            setEditingCell({
                                              id: blockId,
                                              field: 'duration',
                                              value: {
                                                start: s,
                                                currentDurationMin: durationMin,
                                                newDurationMin: durationMin
                                              }
                                            })
                                          }}
                                        >
                                          {Math.round((e.getTime() - s.getTime()) / 60000)} min
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 pl-3">
                                  {taskIdStr && (
                                    <div className="relative">
                                      <button
                                        className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const isOpen = listMenuOpenId === taskIdStr
                                          setListMenuOpenId &&
                                            setListMenuOpenId(
                                              isOpen ? null : taskIdStr,
                                            )
                                        }}
                                      >
                                        <span className="material-symbols-outlined text-lg">
                                          more_vert
                                        </span>
                                      </button>
                                      {listMenuOpenId === taskIdStr &&
                                        (() => {
                                          if (!taskIdStr) return null
                                          const candidates: Task[] = []
                                            ; (tasks?.today || []).forEach((x: Task) => candidates.push(x))
                                            ; (tasks?.overdue || []).forEach((x: Task) => candidates.push(x))
                                            ; (unscheduled || []).forEach((x: Task) => candidates.push(x))
                                            ; (rangeTasks || []).forEach((x: Task) => candidates.push(x))
                                          const t = candidates.find((x) => String(x.id) === taskIdStr)
                                          const isDone = t?.status === 'done'

                                          return (
                                            <div
                                              className={`absolute right-0 w-28 rounded-md bg-slate-900 border border-slate-700 shadow-lg z-20 ${menuPositionClass}`}
                                            >
                                              <button
                                                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                                                onClick={() => {
                                                  if (t && setEditTask) {
                                                    setEditTask(t)
                                                  }
                                                  setListMenuOpenId && setListMenuOpenId(null)
                                                }}
                                              >
                                                修改
                                              </button>
                                              <button
                                                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                                                onClick={async () => {
                                                  if (!taskIdStr || !completeTask) return
                                                  setListMenuOpenId && setListMenuOpenId(null)
                                                  await completeTask(taskIdStr, isDone ? 'open' : 'done')
                                                }}
                                              >
                                                {isDone ? '取消完成' : '完成'}
                                              </button>
                                              <button
                                                className="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-800"
                                                onClick={() => {
                                                  if (t) {
                                                    handleCopyToPool(t)
                                                  }
                                                  setListMenuOpenId && setListMenuOpenId(null)
                                                }}
                                              >
                                                到任务池
                                              </button>
                                              <button
                                                className="block w-full px-3 py-1.5 text-left text-xs text-rose-300 hover:bg-slate-800"
                                                onClick={async () => {
                                                  if (!taskIdStr || !deleteTask) return
                                                  setListMenuOpenId && setListMenuOpenId(null)
                                                  await deleteTask(taskIdStr)
                                                }}
                                              >
                                                删除
                                              </button>
                                            </div>
                                          )
                                        })()}
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

                          {/* Insert Line After Item */}
                          {externalDragOver?.dateKey === section.key && externalDragOver.insertIndex === itemIndex + 1 && (
                            <div className={`mt-1 mb-1 h-0.5 rounded flex items-center justify-between px-1 text-[10px] ${externalDragOver.hasConflict ? 'bg-red-500 text-red-300' : 'bg-blue-500 text-blue-300'}`}>
                              <span>{externalDragOver.suggestedStart ? fmtHHmm(externalDragOver.suggestedStart) : '--:--'} - {externalDragOver.suggestedEnd ? fmtHHmm(externalDragOver.suggestedEnd) : '--:--'}</span>
                              {externalDragOver.hasConflict && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">warning</span>冲突</span>}
                            </div>
                          )}
                        </Fragment>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
          </div>
        </div>
      </div>
      <div className="md:col-span-2 lg:col-span-2 sticky top-0 max-h-[calc(100vh-140px)] overflow-y-auto pl-1 no-scrollbar">
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
