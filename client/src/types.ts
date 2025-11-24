// 公共领域类型（任务、时间块等），供 App 和各子组件复用

export type Task = {
  id: string | number
  title: string
  status: string
  due_at?: string | null
  estimate_min?: number | null
  priority?: number | null
  type?: string | null
  color?: string | null
  recurrence_rule?: string | null
  scheduling_status?: string | null
  tags?: string[]
}

export type Block = {
  id: string | number
  start_at: string
  end_at: string
  task_id?: string | number | null
}

export type DailyTasks = {
  today?: Task[]
  overdue?: Task[]
}

export type FetchState = 'idle' | 'loading' | 'error'

export type Share = {
  id: string | number
  token: string
  scope: 'full' | 'blocks_only'
  expires_at: string
}

export type UserSettings = {
  daily_summary_time: string | null
  timezone: string | null
  focus_duration_minutes: number | null
}

export type SharedBlock = {
  start_at: string
  end_at: string
  task_id?: string | number | null
}

export type SharedData = {
  share: { scope: 'full' | 'blocks_only'; expires_at: string }
  tasks?: Task[]
  blocks: SharedBlock[]
}

export type UserRole = 'system_admin' | 'school_admin' | 'class_admin' | 'student'

export type OptionalPlan = {
  id: string
  name: string
  description?: string
  category?: string
  scope_type: 'global' | 'school' | 'class' | 'personal'
  scope_id?: string | null
  status: 'draft' | 'published'
  created_at: string
}
