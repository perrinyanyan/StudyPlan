import { PlannerPage } from './PlannerPage'
import { PlannerListMode } from './PlannerListMode'
import { PlannerDayView } from './PlannerDayView'
import { CreateTaskModal } from './CreateTaskModal'
import { ScheduleTaskModal } from './ScheduleTaskModal'
import type { Task } from '../../types'

export interface PlannerScreenProps {
  plannerView: 'day' | 'week' | 'month' | 'list'
  date: string
  listRangeStart: string
  listRangeEnd: string
  listRangePickerOpen: boolean
  state: any
  actions: any
}

export function PlannerScreen({
  plannerView,
  date,
  listRangeStart,
  listRangeEnd,
  listRangePickerOpen,
  state,
  actions,
}: PlannerScreenProps) {
  const {
    // 列表视图过滤/选项
    listFilterType,
    listFilterPriority,
    listFilterTag,
    listFilterOverdue,
    listFilterDone,
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
    // 日视图相关
    currentTaskId,
    overdueCollapsed,
    showFutureOnly,
    tasksFlat,
    isToday,
    currentBlock,
    filteredBlocks,
    hourCollapsed,
    HOUR_PX,
    pxPerMin,
    fetchState,
    // 弹窗相关
    showCreateTask,
    editTask,
    scheduleFor,
  } = state || {}

  const {
    // 顶部日期/范围控制
    setDate,
    setListRangeStart,
    setListRangeEnd,
    setListRangePickerOpen,
    todayStr,
    // 列表视图 actions
    setListFilterType,
    setListFilterPriority,
    setListFilterTag,
    setListFilterOverdue,
    setListFilterDone,
    setListMenuOpenId,
    setListEdit,
    setCenterAlert,
    updateTaskMeta,
    completeTask,
    deleteTask,
    fmtHHmm,
    formatYmdWeek,
    fetchUnscheduled,
    setUnschedMenuOpenId,
    setEditTask,
    setScheduleFor,
    setShowCreateTask,
    // 日视图 actions
    addBlock,
    deleteBlock,
    expandAllHours,
    collapseAllHours,
    setOverdueCollapsed,
    setShowFutureOnly,
    // 数据加载 / 创建 / 更新
    fetchDaily,
    createTaskAdvanced,
    updateTaskAdvanced,
    headers,
  } = actions || {}

  return (
    <div>
      <header className="flex items-center justify-between whitespace-nowrap border-b border-white/10 bg-slate-900 px-6 py-3 mb-4 rounded-md">
        <div className="flex items-center gap-4 text-white">
          <span className="material-symbols-outlined text-[#137fec]">auto_stories</span>
          <h1 className="text-white text-lg font-bold leading-tight tracking-[-0.015em]">
            学习规划
          </h1>
        </div>
        <div className="flex-1 justify-end" />
      </header>

      <PlannerPage
        plannerView={plannerView}
        date={date}
        listRangeStart={listRangeStart}
        listRangeEnd={listRangeEnd}
        listRangePickerOpen={listRangePickerOpen}
        onPrevDay={() => {
          if (!setDate || !todayStr) return
          setDate(todayStr(new Date(new Date(date).getTime() - 86400000)))
        }}
        onToday={() => {
          if (!setDate || !todayStr) return
          setDate(todayStr())
        }}
        onNextDay={() => {
          if (!setDate || !todayStr) return
          setDate(todayStr(new Date(new Date(date).getTime() + 86400000)))
        }}
        onToggleRangePicker={() => {
          if (!setListRangePickerOpen) return
          setListRangePickerOpen((open: boolean) => !open)
        }}
        onChangeRangeStart={(value) => {
          if (!setListRangeStart) return
          setListRangeStart(value)
        }}
        onChangeRangeEnd={(value) => {
          if (!setListRangeEnd) return
          setListRangeEnd(value)
        }}
        onResetWeekRange={() => {
          if (!setListRangeStart || !setListRangeEnd || !todayStr) return
          const start = todayStr()
          const end = todayStr(new Date(Date.now() + 6 * 86400000))
          setListRangeStart(start)
          setListRangeEnd(end)
        }}
        onCloseRangePicker={() => {
          if (!setListRangePickerOpen) return
          setListRangePickerOpen(false)
        }}
      />

      {plannerView === 'list' ? (
        <PlannerListMode
          state={{
            listFilterType,
            listFilterPriority,
            listFilterTag,
            listFilterOverdue,
            listFilterDone,
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
          }}
          actions={{
            setListFilterType,
            setListFilterPriority,
            setListFilterTag,
            setListFilterOverdue,
            setListFilterDone,
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
          }}
        />
      ) : (
        <PlannerDayView
          state={{
            tasks,
            unscheduled,
            currentTaskId,
            overdueCollapsed,
            showFutureOnly,
            tasksFlat,
            isToday,
            currentBlock,
            now,
            filteredBlocks,
            hourCollapsed,
            HOUR_PX,
            pxPerMin,
            fetchState,
            blocks,
            taskTitleMap,
            fmtHHmm,
            unschedMenuOpenId,
            listEdit,
          }}
          actions={{
            completeTask,
            deleteTask,
            updateTaskMeta,
            fetchUnscheduled,
            setUnschedMenuOpenId,
            setEditTask,
            setScheduleFor,
            setListEdit,
            setOverdueCollapsed,
            setShowCreateTask,
            setShowFutureOnly,
            addBlock,
            deleteBlock,
            expandAllHours,
            collapseAllHours,
          }}
        />
      )}

      {showCreateTask && (
        <CreateTaskModal
          defaultDate={date}
          onClose={() => setShowCreateTask && setShowCreateTask(false)}
          onSave={createTaskAdvanced || (() => Promise.resolve(false))}
          authHeaders={headers ? headers() : {}}
          availableTags={listTagOptions || []}
        />
      )}

      {editTask && (
        <CreateTaskModal
          defaultDate={date}
          onClose={() => setEditTask && setEditTask(null)}
          onSave={(p) =>
            updateTaskAdvanced ? updateTaskAdvanced((editTask as Task).id, p) : Promise.resolve(false)
          }
          authHeaders={headers ? headers() : {}}
          availableTags={listTagOptions || []}
          initialTask={editTask as Task}
        />
      )}

      {scheduleFor && (
        <ScheduleTaskModal
          task={scheduleFor as Task}
          defaultDate={date}
          onClose={() => setScheduleFor && setScheduleFor(null)}
          onSave={async (dateStr, start, end) => {
            if (!addBlock || !fetchDaily || !fetchUnscheduled) return false
            const ok = await addBlock(start, end, String((scheduleFor as Task).id), dateStr)
            if (!ok) return false
            await Promise.all([fetchDaily(), fetchUnscheduled()])
            setScheduleFor && setScheduleFor(null)
            return true
          }}
        />
      )}
    </div>
  )
}
