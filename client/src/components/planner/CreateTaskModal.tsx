import { useEffect, useState } from 'react'
import type { Task } from '../../types'
import { todayStr, fmtHHmm, parseDurationMin } from '../../utils/datetime'

export type CreateTaskPayload = {
  title: string
  type?: string
  color?: string
  type_id?: string
  due_at?: string
  estimate_min?: number
  priority?: number
  recurrence_rule?: string
  tags?: string[]
}

export type CreateTaskModalProps = {
  defaultDate: string
  onClose: () => void
  onSuccess: () => void
  onSchedule?: (task: Task) => void
  authHeaders: Record<string, string>
  availableTags: string[]
  initialTask?: Task | null
  actions: {
    createTaskAdvanced: (payload: any) => Promise<boolean>
    updateTaskAdvanced: (id: string, payload: any) => Promise<boolean>
  }
}

export function CreateTaskModal({ defaultDate, onClose, onSuccess, onSchedule, authHeaders, availableTags, initialTask, actions }: CreateTaskModalProps) {
  const isEdit = !!initialTask

  function toInputLocal(d: Date): string {
    return `${todayStr(d)}T${fmtHHmm(d)}`
  }

  const [title, setTitle] = useState(initialTask ? initialTask.title : '')
  type TypeRow = { id: string; name: string; color: string }
  const [types, setTypes] = useState<TypeRow[]>([])
  const [typeIdx, setTypeIdx] = useState<number>(-1)
  const [timeMode, setTimeMode] = useState<'duration' | 'end' | 'undecided'>(() => {
    if (!initialTask) return 'duration'
    if (initialTask.due_at && typeof initialTask.estimate_min === 'number' && initialTask.estimate_min > 0) return 'duration'
    if (initialTask.due_at) return 'end'
    return 'undecided'
  })
  const [startAt, setStartAt] = useState<string>(() => {
    if (!initialTask || !initialTask.due_at) return `${defaultDate}T20:00`
    const end = new Date(initialTask.due_at)
    let start = end
    if (typeof initialTask.estimate_min === 'number' && initialTask.estimate_min > 0) {
      start = new Date(end.getTime() - initialTask.estimate_min * 60000)
    }
    return toInputLocal(start)
  })
  const [duration, setDuration] = useState<string>(() => {
    if (!initialTask || typeof initialTask.estimate_min !== 'number') return ''
    return String(initialTask.estimate_min)
  })
  const [endAt, setEndAt] = useState<string>(() => {
    if (!initialTask || !initialTask.due_at) return ''
    const end = new Date(initialTask.due_at)
    return toInputLocal(end)
  })
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(() => {
    if (!initialTask || initialTask.priority == null) return 'medium'
    return initialTask.priority === 2 ? 'high' : initialTask.priority === 1 ? 'medium' : 'low'
  })
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'pool'>(() => {
    if (!initialTask || !initialTask.recurrence_rule) return 'none'
    if (initialTask.recurrence_rule === 'POOL') return 'pool'
    if (initialTask.recurrence_rule.startsWith('DAILY')) return 'daily'
    if (initialTask.recurrence_rule.startsWith('WEEKLY')) return 'weekly'
    if (initialTask.recurrence_rule.startsWith('MONTHLY')) return 'monthly'
    return 'none'
  })
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(() => {
    if (!initialTask || !initialTask.recurrence_rule) return ''
    // Parse UNTIL=YYYYMMDD
    const match = initialTask.recurrence_rule.match(/UNTIL=(\d{8})/)
    if (match) {
      const s = match[1]
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
    }
    return ''
  })
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>(() => {
    if (!initialTask || !initialTask.recurrence_rule) return []
    const match = initialTask.recurrence_rule.match(/BYDAY=([^;]+)/)
    return match ? match[1].split(',') : []
  })
  const [recurrenceMonthDays, setRecurrenceMonthDays] = useState<string[]>(() => {
    if (!initialTask || !initialTask.recurrence_rule) return []
    const match = initialTask.recurrence_rule.match(/BYMONTHDAY=([^;]+)/)
    return match ? match[1].split(',') : []
  })
  const [pinned, setPinned] = useState<boolean>(() => {
    if (!initialTask || !initialTask.recurrence_rule) return false
    return initialTask.recurrence_rule.includes('PINNED')
  })
  const [tags, setTags] = useState<string[]>(() => initialTask?.tags || [])
  const [tagInput, setTagInput] = useState('')
  const [typeModalOpen, setTypeModalOpen] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeColor, setNewTypeColor] = useState('#F87171')
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
  ]

  async function loadTypes(selectId?: string) {
    try {
      const r = await fetch('/task-types', { headers: authHeaders })
      const j = await r.json().catch(() => ({}))
      if (r.ok && Array.isArray(j.items)) {
        const list = (j.items as any[]).map((x) => ({ id: String(x.id), name: String(x.name), color: String(x.color) })) as TypeRow[]
        setTypes(list)
        if (selectId) {
          const k = list.findIndex((t) => String(t.id) === String(selectId))
          setTypeIdx(k >= 0 ? k : (list.length > 0 ? 0 : -1))
        } else if (!isEdit && typeIdx === -1 && list.length > 0) {
          setTypeIdx(0)
        }
      }
    } catch { }
  }

  useEffect(() => {
    loadTypes()
  }, [])

  useEffect(() => {
    if (!initialTask) return
    if (typeIdx !== -1) return
    if (types.length === 0) return
    if (!initialTask.type) return
    const k = types.findIndex((t) => t.name === initialTask.type)
    if (k >= 0) setTypeIdx(k)
  }, [initialTask, types, typeIdx])

  // 当使用“开始 & 结束”模式时，如果尚未设置结束时间，则默认使用与开始时间相同的日期时间
  // 一旦用户手动设置了结束时间，后续修改开始时间将不会再自动修改结束时间
  useEffect(() => {
    if (timeMode !== 'end') return
    if (!startAt) return
    setEndAt((prev) => (prev ? prev : startAt))
  }, [timeMode, startAt])

  // Reset recurrence when timeMode changes
  useEffect(() => {
    if (timeMode === 'undecided') {
      setRecurrence('pool')
    } else {
      if (recurrence === 'pool') {
        setRecurrence('none')
      }
    }
  }, [timeMode])

  async function addType(name: string, color: string): Promise<boolean> {
    const trimmed = name.trim()
    if (!trimmed) {
      alert('请输入类型名称')
      return false
    }
    try {
      const r = await fetch('/task-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ name: trimmed, color }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) {
        alert('创建类型失败: ' + (j.error || r.status))
        return false
      }
      await loadTypes(String(j.id))
      return true
    } catch {
      alert('创建类型失败')
      return false
    }
  }

  async function submitNewType() {
    const ok = await addType(newTypeName, newTypeColor)
    if (!ok) return
    setTypeModalOpen(false)
    setNewTypeName('')
  }

  async function submit(mode: 'save' | 'schedule' | 'pool' = 'save') {
    // If we are saving (not explicitly scheduling) and the task was originally in the pool (or unscheduled),
    // we should keep it in the pool.
    let effectiveMode = mode
    if (mode === 'save' && isEdit && initialTask) {
      const wasPool = initialTask.recurrence_rule === 'POOL' || !initialTask.due_at
      if (wasPool) {
        effectiveMode = 'pool'
      }
    }

    if (!title.trim()) {
      alert('请输入任务名称')
      return
    }
    let dueISO: string | undefined
    let estimateMin: number | undefined
    if (timeMode === 'duration' && effectiveMode !== 'pool') {
      if (!startAt.trim()) {
        alert('请选择开始时间')
        return
      }
      const est = parseDurationMin(duration || '')
      if (est == null || est <= 0) {
        alert('请填写正确的预计时长，如 1h 30m 或 90')
        return
      }
      const start = new Date(startAt)
      const end = new Date(start.getTime() + est * 60000)
      dueISO = end.toISOString()
      estimateMin = est
    } else if (timeMode === 'end' && effectiveMode !== 'pool') {
      if (!startAt.trim() || !endAt.trim()) {
        alert('请选择开始与结束时间')
        return
      }
      const s = new Date(startAt)
      const e = new Date(endAt)
      if (e <= s) {
        alert('结束时间必须晚于开始时间')
        return
      }
      dueISO = e.toISOString()
      estimateMin = Math.round((e.getTime() - s.getTime()) / 60000)
    } else {
      // 未定：不设置 due_at / estimate_min，进入未排程任务池
      dueISO = undefined
      estimateMin = undefined
    }
    const prio = priority === 'high' ? 2 : priority === 'medium' ? 1 : 0
    const recur =
      recurrence === 'daily'
        ? 'DAILY'
        : recurrence === 'weekly'
          ? 'WEEKLY'
          : recurrence === 'monthly'
            ? 'MONTHLY'
            : recurrence === 'pool' || effectiveMode === 'pool'
              ? 'POOL'
              : undefined

    if (recurrence !== 'none' && recurrence !== 'pool' && effectiveMode !== 'pool' && !recurrenceEndDate) {
      alert('请选择重复截止日期')
      return
    }

    let finalRecur = recur
    if (recur && recurrence !== 'pool' && effectiveMode !== 'pool') {
      const parts: string[] = [recur]
      if (recurrence === 'weekly' && recurrenceDays.length > 0) {
        parts.push(`BYDAY=${recurrenceDays.join(',')}`)
      }
      if (recurrence === 'monthly' && recurrenceMonthDays.length > 0) {
        parts.push(`BYMONTHDAY=${recurrenceMonthDays.join(',')}`)
      }
      if (recurrenceEndDate) {
        const d = new Date(recurrenceEndDate)
        const yyyy = d.getFullYear()
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        parts.push(`UNTIL=${yyyy}${mm}${dd}`)
      }
      if (pinned) {
        parts.push('PINNED')
      }
      finalRecur = parts.join(';')
    } else if (recurrence === 'pool' || effectiveMode === 'pool') {
      finalRecur = 'POOL'
      if (pinned) finalRecur += ';PINNED'
    } else if (pinned) {
      finalRecur = 'PINNED'
    }
    const finalTags = tagInput.trim() ? Array.from(new Set([...tags, tagInput.trim().toLowerCase()])) : tags
    const selectedType = typeIdx >= 0 ? types[typeIdx] : undefined
    const basePayload: any = {
      title: title.trim(),
      due_at: dueISO,
      estimate_min: estimateMin,
      priority: prio,
      recurrence_rule: finalRecur,
      tags: finalTags,
    }

    const payload = isEdit
      ? {
        ...basePayload,
        type: selectedType ? selectedType.name : undefined,
        color: selectedType ? selectedType.color : undefined,
      }
      : {
        ...basePayload,
        type_id: selectedType ? selectedType.id : undefined,
      }

    const ok = await (isEdit ? actions.updateTaskAdvanced(initialTask!.id, payload) : actions.createTaskAdvanced(payload))
    if (!ok) return

    if (effectiveMode === 'schedule' && onSchedule && isEdit && initialTask) {
      onSchedule({ ...initialTask, ...basePayload, ...payload, id: initialTask.id } as Task)
      onClose()
    } else {
      onSuccess()
    }
  }

  function addTagFromInput() {
    const t = tagInput.trim()
    if (!t) return
    if (!tags.includes(t)) setTags((arr) => [...arr, t])
    setTagInput('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-white text-lg font-semibold">{isEdit ? '编辑任务池' : '创建新任务'}</h2>
          <button className="text-white/60 hover:text-white" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-6 overflow-y-auto max-h-[70vh]">
          <label className="flex flex-col">
            <p className="text-sm font-medium text-white pb-1.5">任务名称</p>
            <input
              className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white placeholder-slate-500 px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
              placeholder="例如，完成TOEFL阅读第一部分"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="flex flex-col">
            <p className="text-sm font-medium text-white pb-1.5">任务类型</p>
            <div className="flex flex-wrap gap-3 items-center">
              {types.map((t, i) => (
                <label
                  key={i}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer border-white/10 bg-white/5 has-[:checked]:bg-[#137fec]/20 has-[:checked]:border-[#137fec]/50"
                >
                  <input
                    className="form-radio text-[#137fec] focus:ring-[#137fec]/50"
                    name="task-type"
                    type="radio"
                    checked={typeIdx === i}
                    onChange={() => setTypeIdx(i)}
                  />
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }}></span>
                  <span className="text-sm font-medium text-slate-200">{t.name}</span>
                </label>
              ))}
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-dashed border-slate-500 hover:border-[#137fec] text-slate-300 hover:text-[#137fec]"
                type="button"
                onClick={() => {
                  setNewTypeName('')
                  setNewTypeColor(TYPE_COLOR_OPTIONS[0])
                  setTypeModalOpen(true)
                }}
              >
                <span className="material-symbols-outlined text-lg">add</span>
                <span className="text-sm font-medium">添加新类型</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">时间</p>
              <div className="flex w-fit rounded-lg border border-white/10 bg-white/5 p-1">
                <label>
                  <input
                    className="sr-only peer"
                    name="time-mode"
                    type="radio"
                    value="duration"
                    checked={timeMode === 'duration'}
                    onChange={() => setTimeMode('duration')}
                  />
                  <div className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 peer-checked:bg-[#137fec] peer-checked:text-white cursor-pointer">
                    开始 & 时长
                  </div>
                </label>
                <label>
                  <input
                    className="sr-only peer"
                    name="time-mode"
                    type="radio"
                    value="end-time"
                    checked={timeMode === 'end'}
                    onChange={() => setTimeMode('end')}
                  />
                  <div className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 peer-checked:bg-[#137fec] peer-checked:text-white cursor-pointer">
                    开始 & 结束
                  </div>
                </label>
                <label>
                  <input
                    className="sr-only peer"
                    name="time-mode"
                    type="radio"
                    value="undecided"
                    checked={timeMode === 'undecided'}
                    onChange={() => setTimeMode('undecided')}
                  />
                  <div className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 peer-checked:bg-[#137fec] peer-checked:text-white cursor-pointer">
                    未定
                  </div>
                </label>
              </div>
            </div>
            {timeMode !== 'undecided' ? (
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex flex-col min-w-40 flex-1">
                  <p className="text-xs text-slate-300 pb-1.5">开始时间</p>
                  <input
                    className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                </label>
                {timeMode === 'duration' ? (
                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-xs text-slate-300 pb-1.5">预计时长</p>
                    <input
                      className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white placeholder-slate-500 px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                      placeholder="例如, 1h 30m 或 90"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                    />
                  </label>
                ) : (
                  <label className="flex flex-col min-w-40 flex-1">
                    <p className="text-xs text-slate-300 pb-1.5">结束时间</p>
                    <input
                      className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                    />
                  </label>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-400">时间未定：保存后会进入未排程任务池</div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col min-w-40 flex-1">
              <p className="text-sm font-medium text-white pb-1.5">优先级</p>
              <div className="flex w-full rounded-lg border border-white/10 p-1 bg-white/5">
                <label className="flex-1">
                  <input
                    className="sr-only peer"
                    name="priority"
                    type="radio"
                    value="high"
                    checked={priority === 'high'}
                    onChange={() => setPriority('high')}
                  />
                  <div className="w-full text-center px-4 py-2.5 rounded-md text-sm font-medium text-slate-300 peer-checked:bg-red-500/20 peer-checked:text-red-400 cursor-pointer">
                    高
                  </div>
                </label>
                <label className="flex-1">
                  <input
                    className="sr-only peer"
                    name="priority"
                    type="radio"
                    value="medium"
                    checked={priority === 'medium'}
                    onChange={() => setPriority('medium')}
                  />
                  <div className="w-full text-center px-4 py-2.5 rounded-md text-sm font-medium text-slate-300 peer-checked:bg-orange-500/20 peer-checked:text-orange-400 cursor-pointer">
                    中
                  </div>
                </label>
                <label className="flex-1">
                  <input
                    className="sr-only peer"
                    name="priority"
                    type="radio"
                    value="low"
                    checked={priority === 'low'}
                    onChange={() => setPriority('low')}
                  />
                  <div className="w-full text-center px-4 py-2.5 rounded-md text-sm font-medium text-slate-300 peer-checked:bg-[#137fec]/20 peer-checked:text-sky-400 cursor-pointer">
                    低
                  </div>
                </label>
              </div>
            </div>
            <div className="flex flex-col min-w-40 flex-1">
              <p className="text-sm font-medium text-white pb-1.5">重复</p>
              <select
                className="form-select h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
              >
                <option value="none">不重复</option>
                <option value="pool">滞留任务池</option>
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
            </div>
            {recurrence === 'weekly' && (
              <div className="flex flex-col w-full animate-in fade-in slide-in-from-left-2">
                <p className="text-sm font-medium text-white pb-1.5">重复时间</p>
                <div className="flex flex-wrap gap-2">
                  {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((day) => {
                    const active = recurrenceDays.includes(day)
                    const label =
                      day === 'MO'
                        ? '周一'
                        : day === 'TU'
                          ? '周二'
                          : day === 'WE'
                            ? '周三'
                            : day === 'TH'
                              ? '周四'
                              : day === 'FR'
                                ? '周五'
                                : day === 'SA'
                                  ? '周六'
                                  : '周日'
                    return (
                      <button
                        key={day}
                        type="button"
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border ${active
                          ? 'bg-[#137fec]/20 border-[#137fec] text-[#137fec]'
                          : 'border-slate-600 text-slate-300 hover:border-[#137fec] hover:text-[#137fec]'
                          }`}
                        onClick={() =>
                          setRecurrenceDays((prev) =>
                            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                          )
                        }
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {recurrence === 'monthly' && (
              <div className="flex flex-col w-full animate-in fade-in slide-in-from-left-2">
                <p className="text-sm font-medium text-white pb-1.5">重复日期</p>
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => {
                    const active = recurrenceMonthDays.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        className={`h-8 w-8 flex items-center justify-center rounded-md text-xs font-medium border ${active
                          ? 'bg-[#137fec]/20 border-[#137fec] text-[#137fec]'
                          : 'border-slate-600 text-slate-300 hover:border-[#137fec] hover:text-[#137fec]'
                          }`}
                        onClick={() =>
                          setRecurrenceMonthDays((prev) =>
                            prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
                          )
                        }
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {recurrence !== 'none' && recurrence !== 'pool' && (
              <div className="flex flex-col min-w-40 flex-1 animate-in fade-in slide-in-from-left-2">
                <p className="text-sm font-medium text-white pb-1.5">
                  截止日期 <span className="text-red-400">*</span>
                </p>
                <input
                  className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60 w-full"
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                />
              </div>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-white">标签</p>
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableTags.map((name) => {
                  const active = tags.includes(name)
                  return (
                    <button
                      key={name}
                      type="button"
                      className={`px-2 py-1 rounded-md text-xs font-medium border ${active
                        ? 'bg-[#137fec]/20 border-[#137fec] text-[#137fec]'
                        : 'border-slate-600 text-slate-300 hover:border-[#137fec] hover:text-[#137fec]'
                        }`}
                      onClick={() =>
                        setTags((prev) =>
                          prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
                        )
                      }
                    >
                      {name}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="form-input h-9 flex-1 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                placeholder="添加新标签..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTagFromInput()
                  }
                }}
              />
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600"
                onClick={addTagFromInput}
              >
                添加
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 text-xs text-slate-200"
                  >
                    #{t}
                    <button
                      type="button"
                      className="text-slate-400 hover:text-white"
                      onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </label>
        </div>
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-white/10 bg-slate-900">
          <button
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600"
            onClick={onClose}
          >
            取消
          </button>
          {isEdit && onSchedule && (
            <button
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500"
              onClick={() => submit('schedule')}
            >
              安排到日程
            </button>
          )}
          {!isEdit && (
            <button
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500"
              onClick={() => submit('pool')}
            >
              保存到任务池
            </button>
          )}
          <button
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#137fec] hover:bg-[#0f6cc8]"
            onClick={() => submit('save')}
          >
            {isEdit ? '保存到任务池' : '保存任务'}
          </button>
        </div>
      </div>
      {typeModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4">
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
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/10 bg-slate-900">
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
  )
}
