import { useState } from 'react'
import type { Task } from '../../types'
import { parseDurationMin } from '../../utils/datetime'

export function ScheduleTaskModal({
  task,
  defaultDate,
  onClose,
  onSave,
}: {
  task: Task
  defaultDate: string
  onClose: () => void
  onSave: (dateStr: string, start: string, end: string) => Promise<boolean>
}) {
  const [timeMode, setTimeMode] = useState<'duration' | 'end'>('duration')
  const [start, setStart] = useState<string>('20:00')
  const [duration, setDuration] = useState<string>('')
  const [end, setEnd] = useState<string>('')
  const [dateStr, setDateStr] = useState<string>(defaultDate)

  function addHHMM(a: string, minutes: number): string {
    const [hh, mm] = a.split(':').map((x) => parseInt(x))
    let t = hh * 60 + mm + minutes
    if (!isFinite(t)) t = 0
    if (t < 0) t = 0
    if (t > 24 * 60 - 1) t = 24 * 60 - 1
    const H = String(Math.floor(t / 60)).padStart(2, '0')
    const M = String(t % 60).padStart(2, '0')
    return `${H}:${M}`
  }

  async function submit() {
    if (!dateStr) {
      alert('请选择日期')
      return
    }
    let ok = false
    if (timeMode === 'duration') {
      if (!start) {
        alert('请选择开始时间')
        return
      }
      const est = parseDurationMin(duration || '')
      if (est == null || est <= 0) {
        alert('请填写正确的预计时长，如 1h 30m 或 90')
        return
      }
      const endTime = addHHMM(start, est)
      ok = await onSave(dateStr, start, endTime)
    } else {
      if (!start || !end) {
        alert('请选择开始与结束时间')
        return
      }
      if (end <= start) {
        alert('结束时间必须晚于开始时间')
        return
      }
      ok = await onSave(dateStr, start, end)
    }
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-xl border border-white/10 bg-slate-900 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-white text-lg font-semibold">安排任务</h2>
          <button className="text-white/60 hover:text-white" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="px-4 py-4 flex flex-col gap-4 overflow-y-auto max-h-[70vh]">
          <div className="space-y-1.5">
            <p className="text-white text-sm font-medium leading-tight">{task.title}</p>
            <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[11px] text-white/80">
              {task.type && (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-100 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task.color || '#9CA3AF' }}></span>
                  <span>{task.type}</span>
                </span>
              )}
              {typeof task.priority === 'number' && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium ${task.priority === 2
                      ? 'bg-red-500/20 text-red-300'
                      : task.priority === 1
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-green-500/20 text-green-300'
                    }`}
                >
                  {task.priority === 2 ? 'H' : task.priority === 1 ? 'M' : 'L'}
                </span>
              )}
              {(task.tags || []).map((g) => (
                <span key={g} className="px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-300">
                  #{g}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col">
              <p className="text-xs text-slate-300 pb-1.5">日期</p>
              <input
                type="date"
                className="h-9 rounded-lg border border-slate-600 bg-slate-900/80 text-xs text-white px-2 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
              />
            </label>
            <div className="flex flex-col">
              <p className="text-xs text-slate-300 pb-1.5">时间模式</p>
              <div className="flex w-fit rounded-lg border border-white/10 bg-white/5 p-1">
                <label>
                  <input
                    className="sr-only peer"
                    name="time-mode2"
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
                    name="time-mode2"
                    type="radio"
                    value="end"
                    checked={timeMode === 'end'}
                    onChange={() => setTimeMode('end')}
                  />
                  <div className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 peer-checked:bg-[#137fec] peer-checked:text-white cursor-pointer">
                    开始 & 结束
                  </div>
                </label>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="flex flex-col min-w-40 flex-1">
              <p className="text-xs text-slate-300 pb-1.5">开始时间</p>
              <input
                className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white placeholder-slate-500 px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
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
                  className="form-input h-11 rounded-lg border border-slate-600 bg-slate-900/80 text-sm text-white placeholder-slate-500 px-3 focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-4 py-3 border-t border-white/10 bg-slate-900">
          <button
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#137fec] hover:bg-[#0f6cc8]"
            onClick={submit}
          >
            安排
          </button>
        </div>
      </div>
    </div>
  )
}
