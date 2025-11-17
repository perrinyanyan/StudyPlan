import { useState } from 'react'

export type AddTaskProps = {
  onAdd: (title: string, dueTime?: string) => void
}

export function AddTask({ onAdd }: AddTaskProps) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')

  return (
    <div className="flex items-center gap-2">
      <input
        className="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-700"
        placeholder="任务标题"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        type="time"
        className="w-36 px-2 py-2 rounded bg-slate-900 border border-slate-700"
        value={due}
        onChange={(e) => setDue(e.target.value)}
      />
      <button
        className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500"
        onClick={() => {
          if (!title.trim()) return alert('请输入任务标题')
          onAdd(title, due || undefined)
          setTitle('')
          setDue('')
        }}
      >
        添加
      </button>
    </div>
  )
}
