import { useState } from 'react'
import type { Task } from '../../types'

export type AddBlockProps = {
  tasks: Task[]
  onAdd: (start: string, end: string, taskId?: string) => void
}

export function AddBlock({ tasks, onAdd }: AddBlockProps) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [taskId, setTaskId] = useState('')

  return (
    <div className="flex items-center gap-2">
      <input
        type="time"
        className="w-36 px-2 py-2 rounded bg-slate-900 border border-slate-700"
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />
      <input
        type="time"
        className="w-36 px-2 py-2 rounded bg-slate-900 border border-slate-700"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
      />
      <select
        className="w-56 px-2 py-2 rounded bg-slate-900 border border-slate-700"
        value={taskId}
        onChange={(e) => setTaskId(e.target.value)}
      >
        <option value="">无关联任务</option>
        {tasks.map((t) => (
          <option key={String(t.id)} value={String(t.id)}>
            {t.title}
          </option>
        ))}
      </select>
      <button
        className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500"
        onClick={() => {
          if (!start || !end) return alert('请选择开始/结束时间')
          onAdd(start, end, taskId || undefined)
          setStart('')
          setEnd('')
          setTaskId('')
        }}
      >
        添加时间块
      </button>
    </div>
  )
}
