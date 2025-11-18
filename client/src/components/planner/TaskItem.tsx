import { useState } from 'react'
import type { Task } from '../../types'

export type TaskItemProps = {
  t: Task
  overdue?: boolean
  highlight?: boolean
  onDone: () => void
  onDelete: () => void
  onMetaChange: (p: { priority?: number | null; type?: string | null; tags?: string[] }) => void
}

export function TaskItem({ t, overdue, highlight, onDone, onDelete, onMetaChange }: TaskItemProps) {
  const [editing, setEditing] = useState(false)
  const [prio, setPrio] = useState<number | null>(t.priority ?? null)
  const [type, setType] = useState<string>(t.type || '')
  const [tagsInput, setTagsInput] = useState<string>((t.tags || []).join(' '))

  function saveMeta() {
    const tags = tagsInput
      .split(/[\s,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    onMetaChange({
      priority: prio,
      type: type.trim() ? type.trim() : null,
      tags,
    })
    setEditing(false)
  }

  const prioLabel = prio === 2 ? '高' : prio === 1 ? '中' : prio === 0 ? '低' : null
  const prioClass =
    prio === 2
      ? 'bg-red-500/20 text-red-300'
      : prio === 1
      ? 'bg-yellow-500/20 text-yellow-300'
      : prio === 0
      ? 'bg-green-500/20 text-green-300'
      : 'bg-slate-500/20 text-slate-300'
  const isDone = t.status === 'done'

  return (
    <div
      className={`p-3 rounded border ${
        highlight ? 'border-amber-400 ring-2 ring-amber-400' : 'border-slate-700'
      } bg-slate-900 flex items-start justify-between gap-3 ${isDone ? 'opacity-60' : ''}`}
    >
      <div className="flex-1">
        <div className={`text-sm text-white font-medium ${isDone ? 'line-through' : ''}`}>{t.title}</div>
        <div className="text-xs text-slate-300 mt-1 flex flex-wrap gap-2 items-center">
          <span>状态: {t.status}</span>
          {t.due_at ? <span>截止: {new Date(t.due_at).toLocaleString()}</span> : null}
          {overdue ? <span className="text-rose-300">逾期</span> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-white/80">
          {t.type && (
            <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || '#9CA3AF' }}></span>
              <span>{t.type}</span>
            </span>
          )}
          {prioLabel && (
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium ${prioClass}`}
            >
              <span>优先级: {prioLabel}</span>
            </span>
          )}
          {(t.tags || []).map((g) => (
            <span key={g} className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300">
              #{g}
            </span>
          ))}
        </div>
        {editing && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-200">
            <select
              className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-xs"
              value={prio == null ? '' : String(prio)}
              onChange={(e) => {
                const v = e.target.value
                setPrio(v === '' ? null : Number(v))
              }}
            >
              <option value="">优先级(无)</option>
              <option value="2">高</option>
              <option value="1">中</option>
              <option value="0">低</option>
            </select>
            <input
              className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-xs flex-1 min-w-[6rem]"
              placeholder="任务类型"
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
            <input
              className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-xs flex-1 min-w-[8rem]"
              placeholder="标签，用空格或逗号分隔"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 items-end">
        {!editing ? (
          <>
            <button
              className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs"
              onClick={() => setEditing(true)}
            >
              编辑
            </button>
            <div className="flex gap-1 mt-1">
              <button
                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs"
                onClick={onDone}
              >
                完成
              </button>
              <button
                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs"
                onClick={onDelete}
              >
                删除
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-1 mt-1">
              <button
                className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs"
                onClick={() => setEditing(false)}
              >
                取消
              </button>
              <button
                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs"
                onClick={saveMeta}
              >
                保存
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
