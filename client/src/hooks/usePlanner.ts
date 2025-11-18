import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { Task, Block, DailyTasks, FetchState } from '../types'
import { todayStr, toIso } from '../utils/datetime'

export interface UsePlannerParams {
  date: string
  tasks: DailyTasks
  blocks: Block[]
  unscheduled: Task[]
  nowTick: number
  showFutureOnly: boolean
  isSmall: boolean
  jwt: string | null
  pathOnly: string
  plannerView: 'day' | 'week' | 'month' | 'list'
  headers: () => Record<string, string>
  listRangeStart: string
  listRangeEnd: string
  listRangePickerOpen: boolean
  rangeReloadKey: number
  setTasks: Dispatch<SetStateAction<DailyTasks>>
  setBlocks: Dispatch<SetStateAction<Block[]>>
  setFetchState: Dispatch<SetStateAction<FetchState>>
  setUnscheduled: Dispatch<SetStateAction<Task[]>>
  setRangeReloadKey: Dispatch<SetStateAction<number>>
  setCenterAlert: (value: { title: string; detail?: string } | null) => void
}

export interface UsePlannerResult {
  isToday: boolean
  now: Date
  currentBlock?: Block
  currentTaskId?: string | number | null
  HOUR_PX: number
  pxPerMin: number
  filteredBlocks: Block[]
  hourCollapsed: Record<number, boolean>
  expandAllHours: () => void
  collapseAllHours: () => void
  tasksFlat: Task[]
  taskTitleMap: Record<string, string>
  taskStatusMap: Record<string, string>
  taskMetaMap: Record<string, { priority?: number | null; type?: string | null; tags?: string[]; color?: string | null }>
  listTypeOptions: string[]
  listTagOptions: string[]
  fetchDaily: () => Promise<void>
  fetchUnscheduled: () => Promise<void>
  rangeBlocks: Block[] | null
  rangeBlocksLoading: boolean
  rangeTasks: Task[] | null
  updateTaskMeta: (
    id: Task['id'],
    payload: { priority?: number | null; type?: string | null; color?: string | null; tags?: string[] },
  ) => Promise<void>
  createTaskAdvanced: (payload: {
    title: string
    type?: string
    color?: string
    type_id?: string
    due_at?: string
    estimate_min?: number
    priority?: number
    recurrence_rule?: string
    tags?: string[]
  }) => Promise<boolean>
  updateTaskAdvanced: (
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
  ) => Promise<boolean>
  completeTask: (id: Task['id']) => Promise<void>
  deleteTask: (id: Task['id']) => Promise<void>
  addBlock: (start: string, end: string, taskId?: string, dateOverride?: string) => Promise<boolean>
  deleteBlock: (id: Block['id']) => Promise<void>
}

export function usePlanner(params: UsePlannerParams): UsePlannerResult {
  const {
    date,
    tasks,
    blocks,
    unscheduled,
    nowTick,
    showFutureOnly,
    isSmall,
    jwt,
    headers,
    listRangeStart,
    listRangeEnd,
    listRangePickerOpen,
    rangeReloadKey,
    setTasks,
    setBlocks,
    setFetchState,
    setUnscheduled,
    pathOnly,
    plannerView,
    setRangeReloadKey,
    setCenterAlert,
  } = params

  const isToday = date === todayStr()
  const now = useMemo(() => new Date(nowTick), [nowTick])

  const currentBlock = useMemo(
    () =>
      isToday
        ? blocks.find((b) => new Date(b.start_at) <= now && now < new Date(b.end_at))
        : undefined,
    [isToday, blocks, now],
  )
  const currentTaskId = currentBlock?.task_id

  const HOUR_PX = isSmall ? 48 : 56
  const pxPerMin = HOUR_PX / 60

  const filteredBlocks = useMemo(
    () =>
      isToday && showFutureOnly
        ? blocks.filter((b) => new Date(b.end_at) >= now)
        : blocks,
    [isToday, showFutureOnly, blocks, now],
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

  const tasksFlat = useMemo(
    () => [...(tasks.today || []), ...(tasks.overdue || []), ...(rangeTasks || [])],
    [tasks, rangeTasks],
  )

  const taskTitleMap = useMemo(() => {
    const m: Record<string, string> = {}
    ;(tasks.today || []).forEach((t) => {
      m[String(t.id)] = t.title
    })
    ;(tasks.overdue || []).forEach((t) => {
      m[String(t.id)] = t.title
    })
    ;(unscheduled || []).forEach((t) => {
      m[String(t.id)] = t.title
    })
    ;(rangeTasks || []).forEach((t) => {
      m[String(t.id)] = t.title
    })
    return m
  }, [tasks, unscheduled, rangeTasks])

  const taskStatusMap = useMemo(() => {
    const m: Record<string, string> = {}
    ;(tasks.today || []).forEach((t) => {
      m[String(t.id)] = t.status
    })
    ;(tasks.overdue || []).forEach((t) => {
      m[String(t.id)] = t.status
    })
    ;(rangeTasks || []).forEach((t) => {
      m[String(t.id)] = t.status
    })
    return m
  }, [tasks, rangeTasks])

  const taskMetaMap = useMemo(() => {
    const m: Record<string, { priority?: number | null; type?: string | null; tags?: string[]; color?: string | null }> = {}
    ;(tasks.today || []).forEach((t) => {
      m[String(t.id)] = { priority: t.priority ?? null, type: t.type ?? null, tags: t.tags || [], color: t.color ?? null }
    })
    ;(tasks.overdue || []).forEach((t) => {
      m[String(t.id)] = { priority: t.priority ?? null, type: t.type ?? null, tags: t.tags || [], color: t.color ?? null }
    })
    ;(unscheduled || []).forEach((t) => {
      m[String(t.id)] = { priority: t.priority ?? null, type: t.type ?? null, tags: t.tags || [], color: t.color ?? null }
    })
    ;(rangeTasks || []).forEach((t) => {
      m[String(t.id)] = { priority: t.priority ?? null, type: t.type ?? null, tags: t.tags || [], color: t.color ?? null }
    })
    return m
  }, [tasks, unscheduled, rangeTasks])

  const listTypeOptions = useMemo(() => {
    const set = new Set<string>()
    ;(tasks.today || []).forEach((t) => {
      if (t.type) set.add(t.type)
    })
    ;(tasks.overdue || []).forEach((t) => {
      if (t.type) set.add(t.type)
    })
    ;(unscheduled || []).forEach((t) => {
      if (t.type) set.add(t.type)
    })
    return Array.from(set)
  }, [tasks, unscheduled])

  const listTagOptions = useMemo(() => {
    const set = new Set<string>()
    ;(tasks.today || []).forEach((t) => {
      ;(t.tags || []).forEach((g) => set.add(g))
    })
    ;(tasks.overdue || []).forEach((t) => {
      ;(t.tags || []).forEach((g) => set.add(g))
    })
    ;(unscheduled || []).forEach((t) => {
      ;(t.tags || []).forEach((g) => set.add(g))
    })
    return Array.from(set)
  }, [tasks, unscheduled])

  async function fetchDaily() {
    if (!jwt) return
    setFetchState('loading')
    try {
      const [t, b] = await Promise.all([
        fetch(`/tasks/daily?date=${date}&with=tags`, { headers: headers() }).then((r) => r.json()),
        fetch(`/blocks/daily?date=${date}`, { headers: headers() }).then((r) => r.json()),
      ])
      setTasks(t as DailyTasks)
      const blocksJson = b as { items?: Block[] } | null
      setBlocks((blocksJson?.items as Block[]) || [])
      setFetchState('idle')
    } catch {
      setFetchState('error')
    }
  }

  async function fetchUnscheduled() {
    if (!jwt) return
    try {
      const r = await fetch('/tasks?status=open&with=tags', { headers: headers() })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return
      const items = (j.items || []) as Task[]
      setUnscheduled(items.filter((t) => (t.scheduling_status || 'unscheduled') !== 'scheduled'))
    } catch {
    }
  }

  // Load time blocks for list view date range without affecting day/week/month views
  useEffect(() => {
    if (!jwt) return
    if (pathOnly !== '/planner') return
    if (plannerView !== 'list') return
    if (!listRangeStart || !listRangeEnd) return
    if (listRangeStart > listRangeEnd) return
    if (listRangePickerOpen) return
    let cancelled = false
    ;(async () => {
      try {
        setRangeBlocksLoading(true)
        const r = await fetch(`/blocks/range?start=${listRangeStart}&end=${listRangeEnd}`, { headers: headers() })
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
          const tRes = await fetch(`/tasks/by-ids?ids=${encodeURIComponent(ids.join(','))}&with=tags`, { headers: headers() })
          const tJson = await tRes.json().catch(() => ({}))
          if (!tRes.ok) {
            console.error('Failed to load range tasks', tJson)
          } else {
            if (cancelled) return
            setRangeTasks((tJson.items || []) as Task[])
          }
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
  }, [jwt, pathOnly, plannerView, listRangeStart, listRangeEnd, listRangePickerOpen, rangeReloadKey])

  async function updateTaskMeta(
    id: Task['id'],
    payload: { priority?: number | null; type?: string | null; color?: string | null; tags?: string[] },
  ) {
    const body: any = {}
    if ('priority' in payload) body.priority = payload.priority
    if ('type' in payload) body.type = payload.type
    if ('color' in payload) body.color = payload.color
    if ('tags' in payload) body.tags = payload.tags
    const r = await fetch(`/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      alert('更新任务信息失败')
      return
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
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
    const r = await fetch('/tasks', {
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
    await Promise.all([fetchDaily(), fetchUnscheduled()])
    if (pathOnly === '/planner' && plannerView === 'list') {
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
    const r = await fetch(`/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload),
    })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      alert('更新任务失败 ' + (j.error || r.status))
      return false
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
    if (pathOnly === '/planner' && plannerView === 'list') {
      setRangeReloadKey((k) => k + 1)
    }
    return true
  }

  async function completeTask(id: Task['id']) {
    const r = await fetch(`/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ status: 'done' }),
    })
    if (!r.ok) {
      alert('更新任务失败')
      return
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
    if (pathOnly === '/planner' && plannerView === 'list') {
      setRangeReloadKey((k) => k + 1)
    }
  }

  async function deleteTask(id: Task['id']) {
    const r = await fetch(`/tasks/${id}`, { method: 'DELETE', headers: headers() })
    if (!r.ok) {
      alert('删除任务失败')
      return
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
    if (pathOnly === '/planner' && plannerView === 'list') {
      setRangeReloadKey((k) => k + 1)
    }
  }

  async function addBlock(start: string, end: string, taskId?: string, dateOverride?: string): Promise<boolean> {
    const d = dateOverride || date
    const payload: any = { start_at: toIso(d, start), end_at: toIso(d, end) }
    if (taskId) payload.task_id = taskId
    const r = await fetch('/blocks', {
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
      return false
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
    if (pathOnly === '/planner' && plannerView === 'list') {
      setRangeReloadKey((k) => k + 1)
    }
    return true
  }

  async function deleteBlock(id: Block['id']) {
    const r = await fetch(`/blocks/${id}`, { method: 'DELETE', headers: headers() })
    if (!r.ok) {
      alert('删除时间块失败')
      return
    }
    await Promise.all([fetchDaily(), fetchUnscheduled()])
    if (pathOnly === '/planner' && plannerView === 'list') {
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
    deleteBlock,
  }
}
