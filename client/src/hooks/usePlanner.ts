import { useState, useEffect, useMemo, useRef } from 'react'
import { getApiUrl } from '../config'
import { useAuth } from './useAuth'
import { todayStr, toIso } from '../utils/datetime'
import { getConflictIds } from '../utils/conflicts'
import type { Task, Block, DailyTasks, FetchState } from '../types'

export interface UsePlannerProps {
  date: string
  tasks: DailyTasks
  blocks: Block[]
  unscheduled: Task[]
  nowTick: number
  showFutureOnly: boolean
  isSmall: boolean
  jwt: string | null
  pathOnly: string
  plannerView: string
  headers: () => Record<string, string>
  listRangeStart: string
  listRangeEnd: string
  listRangePickerOpen: boolean
  rangeReloadKey: number
  setTasks: (t: DailyTasks) => void
  setBlocks: (b: Block[]) => void
  setFetchState: (s: FetchState) => void
  setUnscheduled: (t: Task[]) => void
  setRangeReloadKey: (cb: (k: number) => number) => void
  setCenterAlert: (a: { title: string; detail?: string } | null) => void
  showToast?: (msg: string) => void
}

export function usePlanner(props: UsePlannerProps) {
  const {
    date,
    tasks,
    blocks,
    unscheduled,
    nowTick,
    showFutureOnly,
    isSmall,
    jwt,
    pathOnly,
    plannerView,
    headers,
    listRangeStart,
    listRangeEnd,
    listRangePickerOpen,
    rangeReloadKey,
    setTasks,
    setBlocks,
    setFetchState,
    setUnscheduled,
    setRangeReloadKey,
    setCenterAlert,
    showToast,
  } = props

  // Ref to track latest unscheduled state (fixes stale closure in fetchUnscheduled)
  const unscheduledRef = useRef<Task[]>(unscheduled)
  useEffect(() => {
    unscheduledRef.current = unscheduled
  }, [unscheduled])

  // UI states
  const [unschedMenuOpenId, setUnschedMenuOpenId] = useState<string | null>(null)
  const [listMenuOpenId, setListMenuOpenId] = useState<string | null>(null)
  const [listEdit, setListEdit] = useState<{ taskId: string; priority: number | null; type: string; tagsInput: string } | null>(null)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [scheduleFor, setScheduleFor] = useState<Task | null>(null)
  const [editTask, setEditTask] = useState<Task | null>(null)

  // Filters
  const [listFilterType, setListFilterType] = useState('all')
  const [listFilterPriority, setListFilterPriority] = useState('all')
  const [listFilterTag, setListFilterTag] = useState<string[]>(['all'])
  const [listFilterOverdue, setListFilterOverdue] = useState('yes') // 'yes' | 'no' | 'all'
  const [listFilterDone, setListFilterDone] = useState('open') // 'open' | 'done' | 'all'
  const [listFilterConflict, setListFilterConflict] = useState<'all' | 'conflicts'>('all')

  const now = new Date(nowTick)
  const isToday = date === todayStr(now)

  const currentBlock = useMemo(
    () =>
      isToday
        ? blocks.find((b) => new Date(b.start_at) <= now && now < new Date(b.end_at))
        : undefined,
    [isToday, blocks, now],
  )
  const currentTaskId = currentBlock?.task_id

  const HOUR_PX = 60 // Fixed height for now
  const pxPerMin = HOUR_PX / 60

  const filteredBlocks = useMemo(
    () => {
      let res = isToday && showFutureOnly
        ? blocks.filter((b) => new Date(b.end_at) >= now)
        : blocks

      if (listFilterConflict === 'conflicts') {
        const conflictIds = getConflictIds(res)
        res = res.filter(b => conflictIds.has(String(b.id)))
      }
      return res
    },
    [isToday, showFutureOnly, blocks, now, listFilterConflict],
  )

  const [hourCollapsed, setHourCollapsed] = useState<Record<number, boolean>>({})

  const [rangeBlocks, setRangeBlocks] = useState<Block[] | null>(null)
  const [rangeBlocksLoading, setRangeBlocksLoading] = useState<boolean>(false)
  const [rangeTasks, setRangeTasks] = useState<Task[] | null>(null)

  useEffect(() => {
    setHourCollapsed({})
  }, [date])

  useEffect(() => {
    const defaults: Record<number, boolean> = {}
    for (let h = 0; h < 24; h++) {
      const hourStart = h * 60
      const hourEnd = (h + 1) * 60
      const hasAny = filteredBlocks.some((b) => {
        const s = new Date(b.start_at)
        const e = new Date(b.end_at)
        const startMin = s.getHours() * 60 + s.getMinutes()
        const endMin = e.getHours() * 60 + e.getMinutes()
        return endMin > hourStart && startMin < hourEnd
      })
      defaults[h] = !hasAny
    }
    setHourCollapsed((prev) => {
      const next = { ...prev }
      let changed = false
      for (let h = 0; h < 24; h++) {
        if (!(h in next)) {
          next[h] = defaults[h]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [filteredBlocks])

  useEffect(() => {
    if (!isToday) return
    const h = now.getHours()
    setHourCollapsed((s) => (s[h] === false ? s : { ...s, [h]: false }))
  }, [now, isToday])

  function expandAllHours() {
    const all: Record<number, boolean> = {}
    for (let h = 0; h < 24; h++) all[h] = false
    setHourCollapsed(all)
  }

  function collapseAllHours() {
    const all: Record<number, boolean> = {}
    for (let h = 0; h < 24; h++) all[h] = true
    setHourCollapsed(all)
  }

  function toggleHourCollapsed(hour: number) {
    setHourCollapsed((prev) => ({ ...prev, [hour]: !(prev[hour] ?? false) }))
  }

  function expandHours(hours: number[]) {
    setHourCollapsed((prev) => {
      let changed = false
      const next = { ...prev }
      hours.forEach((h) => {
        if (next[h] !== false) {
          next[h] = false
          changed = true
        }
      })
      return changed ? next : prev
    })
  }

  function autoCollapseEmptyHours() {
    const busyHours = new Set<number>()
    blocks.forEach((b) => {
      const s = new Date(b.start_at)
      const e = new Date(b.end_at)

      // Calculate which hours this block touches
      // Simple approach: check overlap with each hour 0-23
      const startMs = s.getTime()
      const endMs = e.getTime()

      for (let h = 0; h < 24; h++) {
        // Hour range
        const hourStart = new Date(s)
        hourStart.setHours(h, 0, 0, 0)
        const hourEnd = new Date(s)
        hourEnd.setHours(h + 1, 0, 0, 0)

        // Overlap check: max(start1, start2) < min(end1, end2)
        if (Math.max(startMs, hourStart.getTime()) < Math.min(endMs, hourEnd.getTime())) {
          busyHours.add(h)
        }
      }
    })

    const newState: Record<number, boolean> = {}
    for (let h = 0; h < 24; h++) {
      // If busy (has tasks), expanded (false). If empty, collapsed (true).
      newState[h] = !busyHours.has(h)
    }
    setHourCollapsed(newState)
  }

  const tasksFlat = useMemo(
    () => [...(tasks.today || []), ...(tasks.overdue || []), ...(rangeTasks || [])],
    [tasks, rangeTasks],
  )

  const taskTitleMap = useMemo(() => {
    const m: Record<string, string> = {}
      ; (tasks.today || []).forEach((t) => {
        m[String(t.id)] = t.title
      })
      ; (tasks.overdue || []).forEach((t) => {
        m[String(t.id)] = t.title
      })
      ; (unscheduled || []).forEach((t) => {
        m[String(t.id)] = t.title
      })
      ; (rangeTasks || []).forEach((t) => {
        m[String(t.id)] = t.title
      })
    return m
  }, [tasks, unscheduled, rangeTasks])

  const taskStatusMap = useMemo(() => {
    const m: Record<string, string> = {}
      ; (tasks.today || []).forEach((t) => {
        m[String(t.id)] = t.status
      })
      ; (tasks.overdue || []).forEach((t) => {
        m[String(t.id)] = t.status
      })
      ; (rangeTasks || []).forEach((t) => {
        m[String(t.id)] = t.status
      })
    return m
  }, [tasks, rangeTasks])

  const taskMetaMap = useMemo(() => {
    const m: Record<string, { priority?: number | null; type?: string | null; tags?: string[]; color?: string | null; content?: string | null }> = {}
      ; (tasks.today || []).forEach((t) => {
        m[String(t.id)] = { priority: t.priority ?? null, type: t.type ?? null, tags: t.tags || [], color: t.color ?? null, content: t.content ?? null }
      })
      ; (tasks.overdue || []).forEach((t) => {
        m[String(t.id)] = { priority: t.priority ?? null, type: t.type ?? null, tags: t.tags || [], color: t.color ?? null, content: t.content ?? null }
      })
      ; (unscheduled || []).forEach((t) => {
        m[String(t.id)] = { priority: t.priority ?? null, type: t.type ?? null, tags: t.tags || [], color: t.color ?? null, content: t.content ?? null }
      })
      ; (rangeTasks || []).forEach((t) => {
        m[String(t.id)] = { priority: t.priority ?? null, type: t.type ?? null, tags: t.tags || [], color: t.color ?? null, content: t.content ?? null }
      })
    return m
  }, [tasks, unscheduled, rangeTasks])

  const listTypeOptions = useMemo(() => {
    const map = new Map<string, string>() // type -> color
      ; (tasks.today || []).forEach((t) => {
        if (t.type && !map.has(t.type)) map.set(t.type, t.color || '#60A5FA')
      })
      ; (tasks.overdue || []).forEach((t) => {
        if (t.type && !map.has(t.type)) map.set(t.type, t.color || '#60A5FA')
      })
      ; (unscheduled || []).forEach((t) => {
        if (t.type && !map.has(t.type)) map.set(t.type, t.color || '#60A5FA')
      })
    return Array.from(map.entries()).map(([name, color]) => ({ name, color }))
  }, [tasks, unscheduled])

  const listTagOptions = useMemo(() => {
    const set = new Set<string>()
      ; (tasks.today || []).forEach((t) => {
        ; (t.tags || []).forEach((g) => set.add(g))
      })
      ; (tasks.overdue || []).forEach((t) => {
        ; (t.tags || []).forEach((g) => set.add(g))
      })
      ; (unscheduled || []).forEach((t) => {
        ; (t.tags || []).forEach((g) => set.add(g))
      })
    return Array.from(set)
  }, [tasks, unscheduled])

  async function fetchDaily(isBackground = false) {
    if (!jwt) return
    if (!isBackground) setFetchState('loading')
    try {
      const [t, b] = await Promise.all([
        fetch(getApiUrl(`/tasks/daily?date=${date}&with=tags`), { headers: headers() }).then((r) => r.json()),
        fetch(getApiUrl(`/blocks/daily?date=${date}`), { headers: headers() }).then((r) => r.json()),
      ])
      setTasks(t as DailyTasks)
      const blocksJson = b as { items?: Block[] } | null
      setBlocks((blocksJson?.items as Block[]) || [])
      if (!isBackground) setFetchState('idle')
    } catch {
      if (!isBackground) setFetchState('error')
    }
  }

  async function fetchUnscheduled(isBackground = false) {
    if (!jwt) return
    try {
      const r = await fetch(getApiUrl('/tasks?status=open&with=tags'), { headers: headers() })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return
      const items = (j.items || []) as Task[]
      const filtered = items.filter((t) => (t.scheduling_status || 'unscheduled') !== 'scheduled' || t.recurrence_rule === 'POOL' || t.recurrence_rule?.includes('PINNED'))

      // Merge with existing temp tasks (negative IDs) to prevent flicker
      // Temp tasks are removed only when their real counterparts appear (matched by title)
      // Use ref to get latest state (fixes stale closure issue)
      const currentUnscheduled = unscheduledRef.current
      const tempTasks = currentUnscheduled.filter((t) => Number(t.id) < 0)
      const serverTitles = new Set(filtered.map((t) => t.title))
      const remainingTemps = tempTasks.filter((t) => !serverTitles.has(t.title))
      setUnscheduled([...remainingTemps, ...filtered])
    } catch {
    }
  }

  // Load time blocks for list view date range or week view
  useEffect(() => {
    if (!jwt) return
    if (pathOnly !== '/planner') return

    let start = ''
    let end = ''

    if (plannerView === 'list') {
      if (!listRangeStart || !listRangeEnd) return
      if (listRangeStart > listRangeEnd) return
      if (listRangePickerOpen) return
      start = listRangeStart
      end = listRangeEnd
    } else if (plannerView === 'week') {
      const d = new Date(date)
      const day = d.getDay() // 0 is Sunday
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
      const startOfWeek = new Date(d.setDate(diff)) // Monday
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6) // Sunday

      start = todayStr(startOfWeek)
      end = todayStr(endOfWeek)
    } else if (plannerView === 'month') {
      const d = new Date(date)
      const year = d.getFullYear()
      const month = d.getMonth()

      // First day of the month
      const firstDay = new Date(year, month, 1)
      // Last day of the month
      const lastDay = new Date(year, month + 1, 0)

      // Calculate padding for start (Monday start)
      const startDay = firstDay.getDay() // 0 is Sunday
      const startDiff = startDay === 0 ? 6 : startDay - 1
      const startDate = new Date(firstDay)
      startDate.setDate(firstDay.getDate() - startDiff)

      // Calculate padding for end (Sunday end)
      const endDay = lastDay.getDay() // 0 is Sunday
      const endDiff = endDay === 0 ? 0 : 7 - endDay
      const endDate = new Date(lastDay)
      endDate.setDate(lastDay.getDate() + endDiff)

      start = todayStr(startDate)
      end = todayStr(endDate)
    } else {
      return
    }

    let cancelled = false
      ; (async () => {
        try {
          setRangeBlocksLoading(true)
          const r = await fetch(getApiUrl(`/blocks/range?start=${start}&end=${end}`), { headers: headers() })
          const j = await r.json().catch(() => ({}))
          if (!r.ok) {
            console.error('Failed to load range blocks', j)
            return
          }
          const items = (j.items as Block[]) || []
          if (cancelled) return
          setRangeBlocks(items)
          const ids = Array.from(new Set(items.map((b) => b.task_id).filter(Boolean))).map(String)
          if (ids.length > 0) {
            const tRes = await fetch(getApiUrl(`/tasks/by-ids?ids=${encodeURIComponent(ids.join(','))}&with=tags`), { headers: headers() })
            const tJson = await tRes.json().catch(() => ({}))
            if (!tRes.ok) {
              console.error('Failed to load range tasks', tJson)
            } else {
              if (cancelled) return
              setRangeTasks((tJson.items || []) as Task[])
            }
          } else {
            if (cancelled) return
            setRangeTasks([])
          }
        } catch (e) {
          console.error('Failed to load range blocks', e)
        } finally {
          if (!cancelled) setRangeBlocksLoading(false)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [jwt, pathOnly, plannerView, listRangeStart, listRangeEnd, listRangePickerOpen, rangeReloadKey, date])

  async function updateTaskMeta(
    id: Task['id'],
    payload: { priority?: number | null; type?: string | null; color?: string | null; tags?: string[] },
  ) {
    // Optimistic update
    const updateLocalTask = (t: Task) => {
      if (String(t.id) === String(id)) {
        return { ...t, ...payload }
      }
      return t
    }
    setTasks({
      ...tasks,
      today: tasks.today?.map(updateLocalTask),
      overdue: tasks.overdue?.map(updateLocalTask),
    })
    setUnscheduled(unscheduled.map(updateLocalTask))
    if (rangeTasks) {
      setRangeTasks(rangeTasks.map(updateLocalTask))
    }

    const body: any = {}
    if ('priority' in payload) body.priority = payload.priority
    if ('type' in payload) body.type = payload.type
    if ('color' in payload) body.color = payload.color
    if ('tags' in payload) body.tags = payload.tags
    const r = await fetch(getApiUrl(`/tasks/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      alert('更新任务信息失败')
    }
    if (showToast) showToast('任务信息已更新')
    await Promise.all([fetchDaily(true), fetchUnscheduled(true)])
  }

  async function createTaskAdvanced(payload: {
    title: string
    type?: string
    color?: string
    type_id?: string
    due_at?: string
    estimate_min?: number
    priority?: number
    recurrence_rule?: string
    tags?: string[]
  }): Promise<boolean> {
    // Optimistic update
    const tempId = -Date.now()
    const tempTask: Task = {
      id: tempId,
      title: payload.title,
      type: payload.type || null,
      color: payload.color || null,
      priority: payload.priority ?? null,
      tags: payload.tags || [],
      status: 'open',
      recurrence_rule: payload.recurrence_rule || null,
      estimate_min: payload.estimate_min || null,
      due_at: payload.due_at || null,
    }

    if (payload.recurrence_rule === 'POOL') {
      setUnscheduled([tempTask, ...unscheduled])
    } else {
      setTasks({
        ...tasks,
        today: [tempTask, ...(tasks.today || [])],
      })
    }
    const r = await fetch(getApiUrl('/tasks'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      if (r.status === 409) {
        setCenterAlert({ title: '时间冲突', detail: '该时间与其他任务重叠，请调整后再试。' })
      } else {
        alert('创建任务失败 ' + (j.error || r.status))
      }
      return false
    }
    if (showToast) showToast('创建任务成功')
    await Promise.all([fetchDaily(true), fetchUnscheduled(true)])
    if (pathOnly === '/planner' && ['list', 'week', 'month'].includes(plannerView)) {
      setRangeReloadKey((k) => k + 1)
    }
    return true
  }

  async function updateTaskAdvanced(
    id: Task['id'],
    payload: {
      title: string
      type?: string
      color?: string
      type_id?: string
      due_at?: string
      estimate_min?: number
      priority?: number
      recurrence_rule?: string
      tags?: string[]
    },
  ): Promise<boolean> {
    // Optimistic update
    const updateLocalTask = (t: Task) => {
      if (String(t.id) === String(id)) {
        return { ...t, ...payload }
      }
      return t
    }
    setTasks({
      ...tasks,
      today: tasks.today?.map(updateLocalTask),
      overdue: tasks.overdue?.map(updateLocalTask),
    })
    setUnscheduled(unscheduled.map(updateLocalTask))
    if (rangeTasks) {
      setRangeTasks(rangeTasks.map(updateLocalTask))
    }

    const r = await fetch(getApiUrl(`/tasks/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert('更新任务失败 ' + (j.error || r.status))
      return false
    }
    if (showToast) showToast('更新任务成功')
    await Promise.all([fetchDaily(true), fetchUnscheduled(true)])
    if (pathOnly === '/planner' && ['list', 'week', 'month'].includes(plannerView)) {
      setRangeReloadKey((k) => k + 1)
    }
    return true
  }

  async function completeTask(id: Task['id'], status: 'done' | 'open' = 'done') {
    // Optimistic update
    const updateLocalTask = (t: Task) => {
      if (String(t.id) === String(id)) {
        return { ...t, status: status }
      }
      return t
    }
    setTasks({
      ...tasks,
      today: tasks.today?.map(updateLocalTask),
      overdue: tasks.overdue?.map(updateLocalTask),
    })
    setUnscheduled(unscheduled.map(updateLocalTask))
    if (rangeTasks) {
      setRangeTasks(rangeTasks.map(updateLocalTask))
    }

    const r = await fetch(getApiUrl(`/tasks/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ status: status }),
    })
    if (!r.ok) {
      alert('更新任务失败')
      return
    }
    if (showToast) showToast(status === 'done' ? '已标记完成' : '已取消完成')
    await Promise.all([fetchDaily(true), fetchUnscheduled(true)])
    if (pathOnly === '/planner' && ['list', 'week', 'month'].includes(plannerView)) {
      setRangeReloadKey((k) => k + 1)
    }
  }

  async function deleteTask(id: Task['id']) {
    // Optimistic update
    const filterLocalTask = (t: Task) => String(t.id) !== String(id)
    setTasks({
      ...tasks,
      today: tasks.today?.filter(filterLocalTask),
      overdue: tasks.overdue?.filter(filterLocalTask),
    })
    setUnscheduled(unscheduled.filter(filterLocalTask))
    if (rangeTasks) {
      setRangeTasks(rangeTasks.filter(filterLocalTask))
    }

    const r = await fetch(getApiUrl(`/tasks/${id}`), { method: 'DELETE', headers: headers() })
    if (!r.ok) {
      alert('删除任务失败')
      return
    }
    if (showToast) showToast('删除成功')
    await Promise.all([fetchDaily(true), fetchUnscheduled(true)])
    if (pathOnly === '/planner' && ['list', 'week', 'month'].includes(plannerView)) {
      setRangeReloadKey((k) => k + 1)
    }
  }

  async function addBlock(start: string, end: string, taskId?: string, dateOverride?: string): Promise<boolean> {
    const d = dateOverride || date
    const payload: any = { start_at: toIso(d, start), end_at: toIso(d, end) }
    if (taskId) payload.task_id = taskId

    // Optimistic update
    const tempId = -Date.now()
    const tempBlock: Block = {
      id: tempId,
      start_at: payload.start_at,
      end_at: payload.end_at,
      task_id: taskId || null,
    }
    setBlocks([...blocks, tempBlock])
    if (rangeBlocks) {
      setRangeBlocks([...rangeBlocks, tempBlock])
    }

    const r = await fetch(getApiUrl('/blocks'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      if (r.status === 409) {
        setCenterAlert({ title: '时间冲突', detail: '该时间与其他任务重叠，请调整后再试。' })
      } else {
        alert('创建时间块失败: ' + (j.error || r.status))
      }
      // Revert optimistic update on error
      setBlocks(blocks.filter(b => b.id !== tempId))
      if (rangeBlocks) {
        setRangeBlocks(rangeBlocks.filter(b => b.id !== tempId))
      }

      return false
    }
    if (showToast) showToast('创建时间块成功')
    await Promise.all([fetchDaily(true), fetchUnscheduled(true)])
    if (pathOnly === '/planner' && ['list', 'week', 'month'].includes(plannerView)) {
      setRangeReloadKey((k) => k + 1)
    }
    return true
  }

  async function updateBlock(id: Block['id'], payload: { start_at?: string; end_at?: string; task_id?: string }) {
    // Optimistic update
    const previousBlocks = [...blocks]
    const previousRangeBlocks = rangeBlocks ? [...rangeBlocks] : null

    const updateLocalBlock = (b: Block) => {
      if (String(b.id) === String(id)) {
        return { ...b, ...payload }
      }
      return b
    }
    setBlocks(blocks.map(updateLocalBlock))
    if (rangeBlocks) {
      setRangeBlocks(rangeBlocks.map(updateLocalBlock))
    }

    const r = await fetch(getApiUrl(`/blocks/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      if (r.status === 409) {
        setCenterAlert({ title: '时间冲突', detail: '该时间与其他任务重叠，请调整后再试。' })
      } else {
        alert('更新时间块失败: ' + (j.error || r.status))
      }
      // Revert optimistic update
      setBlocks(previousBlocks)
      if (previousRangeBlocks) {
        setRangeBlocks(previousRangeBlocks)
      }
      return false
    }
    if (showToast) showToast('更新时间块成功')
    await Promise.all([fetchDaily(true), fetchUnscheduled(true)])
    if (pathOnly === '/planner' && ['list', 'week', 'month'].includes(plannerView)) {
      setRangeReloadKey((k) => k + 1)
    }
    return true
  }

  async function deleteBlock(id: Block['id']) {
    // Optimistic update
    const filterLocalBlock = (b: Block) => String(b.id) !== String(id)
    setBlocks(blocks.filter(filterLocalBlock))
    if (rangeBlocks) {
      setRangeBlocks(rangeBlocks.filter(filterLocalBlock))
    }

    const r = await fetch(getApiUrl(`/blocks/${id}`), { method: 'DELETE', headers: headers() })
    if (!r.ok) {
      alert('删除时间块失败')
      return
    }
    if (showToast) showToast('删除时间块成功')
    await Promise.all([fetchDaily(true), fetchUnscheduled(true)])
    if (pathOnly === '/planner' && ['list', 'week', 'month'].includes(plannerView)) {
      setRangeReloadKey((k) => k + 1)
    }
  }

  return {
    isToday,
    now,
    currentBlock,
    currentTaskId,
    HOUR_PX,
    pxPerMin,
    filteredBlocks,
    hourCollapsed,
    expandAllHours,
    collapseAllHours,
    toggleHourCollapsed,
    expandHours,
    autoCollapseEmptyHours,
    tasksFlat,
    taskTitleMap,
    taskStatusMap,
    taskMetaMap,
    listTypeOptions,
    listTagOptions,
    fetchDaily,
    fetchUnscheduled,
    rangeBlocks,
    rangeBlocksLoading,
    rangeTasks,
    updateTaskMeta,
    createTaskAdvanced,
    updateTaskAdvanced,
    completeTask,
    deleteTask,
    addBlock,
    updateBlock,
    deleteBlock,
    unschedMenuOpenId,
    setUnschedMenuOpenId,
    listMenuOpenId,
    setListMenuOpenId,
    listEdit,
    setListEdit,
    showCreateTask,
    setShowCreateTask,
    scheduleFor,
    setScheduleFor,
    editTask,
    setEditTask,
    listFilterType,
    setListFilterType,
    listFilterPriority,
    setListFilterPriority,
    listFilterTag,
    setListFilterTag,
    listFilterOverdue,
    setListFilterOverdue,
    listFilterDone,
    setListFilterDone,
    listFilterConflict,
    setListFilterConflict,
  }
}
