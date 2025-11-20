export interface PlannerPageProps {
  plannerView: 'day' | 'week' | 'month' | 'list'
  date: string
  listRangeStart: string
  listRangeEnd: string
  listRangePickerOpen: boolean
  onPrevDay: () => void
  onToday: () => void
  onNextDay: () => void
  onToggleRangePicker: () => void
  onChangeRangeStart: (value: string) => void
  onChangeRangeEnd: (value: string) => void
  onResetWeekRange: () => void
  onCloseRangePicker: () => void
}

export function PlannerPage(props: PlannerPageProps) {
  const {
    plannerView,
    date,
    listRangeStart,
    listRangeEnd,
    listRangePickerOpen,
    onPrevDay,
    onToday,
    onNextDay,
    onToggleRangePicker,
    onChangeRangeStart,
    onChangeRangeEnd,
    onResetWeekRange,
    onCloseRangePicker,
  } = props

  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  let weekLabel = ''
  try {
    const d = new Date(date)
    if (!Number.isNaN(d.getTime())) {
      weekLabel = weekdays[d.getDay()]
    }
  } catch {
    weekLabel = ''
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
      <div className="flex items-center gap-4 text-white">
        <div className="relative flex items-center gap-2">
          <span className="material-symbols-outlined text-white/80">calendar_today</span>
          {plannerView === 'list' ? (
            <button
              type="button"
              className="text-white tracking-light text-xl font-bold px-2 py-1 rounded-md bg-black/20 hover:bg-white/10 border border-white/10"
              onClick={onToggleRangePicker}
            >
              {listRangeStart} ~ {listRangeEnd}
            </button>
          ) : plannerView === 'week' ? (
            <p className="text-white tracking-light text-xl font-bold px-2">
              {(() => {
                try {
                  const d = new Date(date)
                  const day = d.getDay()
                  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
                  const startOfWeek = new Date(d.setDate(diff))
                  const endOfWeek = new Date(startOfWeek)
                  endOfWeek.setDate(startOfWeek.getDate() + 6)

                  const startStr = startOfWeek.toISOString().split('T')[0]
                  const endStr = endOfWeek.toISOString().split('T')[0]
                  return `${startStr} ~ ${endStr}`
                } catch {
                  return date
                }
              })()}
            </p>
          ) : plannerView === 'month' ? (
            <p className="text-white tracking-light text-xl font-bold px-2">
              {(() => {
                try {
                  const d = new Date(date)
                  return `${d.getFullYear()}年${d.getMonth() + 1}月`
                } catch {
                  return date
                }
              })()}
            </p>
          ) : (
            <p className="text-white tracking-light text-xl font-bold px-2">
              {date}
              {weekLabel ? ` ${weekLabel}` : ''}
            </p>
          )}
          {plannerView !== 'list' && (
            <div className="flex items-center rounded-lg border border-white/10 overflow-hidden">
              <button
                className="p-2 text-white/80 hover:bg-white/10"
                onClick={onPrevDay}
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button
                className="flex cursor-pointer items-center justify-center h-10 bg-black/20 text-white text-sm font-medium px-4 hover:bg-white/10 border-l border-r border-white/10"
                onClick={onToday}
              >
                {plannerView === 'week' ? '本周' : plannerView === 'month' ? '本月' : '今日'}
              </button>
              <button
                className="p-2 text-white/80 hover:bg-white/10"
                onClick={onNextDay}
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}
          {plannerView === 'list' && listRangePickerOpen && (
            <div className="absolute top-full left-6 mt-2 z-30 w-72 rounded-lg border border-white/10 bg-slate-900 shadow-xl p-3">
              <div className="flex flex-col gap-2 text-xs text-slate-200">
                <label className="flex items-center gap-2">
                  <span className="w-10 text-right">开始</span>
                  <input
                    type="date"
                    className="flex-1 h-8 rounded border border-slate-600 bg-slate-900/80 px-2 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                    value={listRangeStart}
                    onChange={(e) => onChangeRangeStart(e.target.value)}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="w-10 text-right">结束</span>
                  <input
                    type="date"
                    className="flex-1 h-8 rounded border border-slate-600 bg-slate-900/80 px-2 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-[#137fec]/60"
                    value={listRangeEnd}
                    onChange={(e) => onChangeRangeEnd(e.target.value)}
                  />
                </label>
                <div className="mt-1 flex justify-end gap-2">
                  <button
                    type="button"
                    className="px-2 py-1 rounded-md text-[11px] text-slate-200 bg-slate-800 hover:bg-slate-700"
                    onClick={onResetWeekRange}
                  >
                    重置为一周
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 rounded-md text-[11px] text-white bg-[#137fec] hover:bg-[#0f6cc8]"
                    onClick={onCloseRangePicker}
                  >
                    完成
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex h-10 w-full max-w-sm items-center justify-center rounded-lg bg-black/20 p-1">
        {(['day', 'week', 'month', 'list'] as const).map((v) => (
          <button
            key={v}
            onClick={() => {
              window.location.hash = `#/planner?view=${v}`
            }}
            className={`flex-1 h-8 rounded-md text-sm ${plannerView === v ? 'bg-[#137fec] text-white shadow-sm' : 'text-gray-400 hover:bg-white/10'
              }`}
          >
            {v === 'day' ? '日视图' : v === 'week' ? '周视图' : v === 'month' ? '月视图' : '列表视图'}
          </button>
        ))}
      </div>
    </div>
  )
}
