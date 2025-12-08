import { useState, useEffect } from 'react'
import { getApiUrl } from '../../config'
import { OptionalPlan } from '../../types'
import { PlanImportModal } from './PlanImportModal'
import { PlanDetailsModal } from './PlanDetailsModal'

export function PlanLibraryPage() {
    const [plans, setPlans] = useState<OptionalPlan[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showImportModal, setShowImportModal] = useState(false)
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
    const [filterScope, setFilterScope] = useState<string>('all')
    const [filterCategory, setFilterCategory] = useState<string>('all')
    const [showSelectedOnly, setShowSelectedOnly] = useState(false)

    const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set())

    const fetchPlans = async () => {
        setLoading(true)
        try {
            const token = localStorage.getItem('jwt')
            const res = await fetch(getApiUrl('/plans'), {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) throw new Error('Failed to fetch plans')
            const data = await res.json()
            setPlans(data.plans)

            // Set selected plan IDs directly from response
            if (data.selectedPlanIds && Array.isArray(data.selectedPlanIds)) {
                setSelectedPlanIds(new Set(data.selectedPlanIds))
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPlans()
    }, [])

    const filteredPlans = plans.filter(p => {
        if (filterScope !== 'all' && p.scope_type !== filterScope) return false
        if (filterCategory !== 'all' && p.category !== filterCategory) return false
        if (showSelectedOnly && !selectedPlanIds.has(p.id)) return false
        return true
    })

    const categories = Array.from(new Set(plans.map(p => p.category).filter(Boolean))) as string[]


    const handleDownloadTemplate = () => {
        const csvContent =
            `plan_name,category,course_code,course_name,content,date,start_time,end_time,location,type,priority,tags
## 双#号为注释行。注意英文逗号为分隔符，如果在内容中出现，请在两边使用英文双引号(excel会自动处理)。英文双引号不允许在内容中出现。Planname不同时，会生成多个计划,计划分类,课程代码、英文 唯一课程标识，可自定义,课程名称 - 和课程代码一一对应,具体内容描述,日期,开设时间,截至时间,教室位置,课程大类：语文、数学、英语、物理、化学、生物、历史、地理、计算机、艺术、运动、爱好等,高或2、中或1、低或0,标签，例如ACCP、TOEFL、羽毛球、篮球、钢琴、外教、中教等，多标签用英文分号分隔
##托福冲刺计划,TOEFL,ToeflReading01,托福阅读课,具体内容描述,2025/10/28,8:00,9:30,线上,英语,高,TOEFL;李老师
##托福冲刺计划,TOEFL,ToeflListening01,托福听力课,具体内容描述,2025/10/28,10:00,11:30,线上,英语,高,TOEFL;张老师
##2025 ACCP 秋季B,ACCP,Math02C,微积分2中教辅导,具体内容描述,2025/10/28,14:00,15:00,线上,数学,高,ACCP;中教
##2025 ACCP 秋季B,ACCP,Math02F,微积分2外教课,具体内容描述,2025/10/28,15:00,17:30,线上,数学,高,ACCP;外教
##托福冲刺计划,TOEFL,ToeflReading01,托福阅读课,具体内容描述,2025/10/29,8:00,9:30,线上,英语,高,TOEFL;李老师
##托福冲刺计划,TOEFL,ToeflListening01,托福听力课,具体内容描述,2025/10/29,10:00,11:30,线上,英语,高,TOEFL;张老师
`
        // Add BOM for Excel compatibility
        const BOM = '\uFEFF'
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', 'plan_import_template.csv')
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleExport = async (planId: string, planName: string) => {
        try {
            const token = localStorage.getItem('jwt')
            const res = await fetch(getApiUrl(`/plans/${planId}/export`), {
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (!res.ok) throw new Error('Failed to export plan')

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            // Sanitize filename
            const safeName = planName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5-_]/g, '_')
            a.download = `plan_${safeName}.csv`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err: any) {
            console.error('Export error:', err)
            alert('导出计划失败: ' + err.message)
        }
    }


    return (
        <div className="p-6 max-w-6xl mx-auto text-white">
            {/* Navigation Bar - Matching PlannerScreen Style */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="relative flex items-center gap-2">
                        <span className="text-2xl">📚</span>
                        <h1 className="text-white tracking-light text-xl font-bold px-2">可选计划库</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Filters */}
                    <select
                        value={filterScope}
                        onChange={e => setFilterScope(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                    >
                        <option value="all" className="bg-slate-800">所有范围</option>
                        <option value="global" className="bg-slate-800">全局</option>
                        <option value="school" className="bg-slate-800">学校</option>
                        <option value="class" className="bg-slate-800">班级</option>
                        <option value="personal" className="bg-slate-800">个人</option>
                    </select>

                    <select
                        value={filterCategory}
                        onChange={e => setFilterCategory(e.target.value)}
                        className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 outline-none hover:bg-white/10 focus:border-blue-500"
                    >
                        <option value="all" className="bg-slate-800">所有计划分类</option>
                        {categories.map(c => <option key={c} value={c} className="bg-slate-800">{c}</option>)}
                    </select>

                    <button
                        onClick={handleDownloadTemplate}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium flex items-center gap-2 border border-white/10"
                        title="下载导入模板"
                    >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                    </button>

                    <button
                        onClick={() => setShowImportModal(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium flex items-center gap-2 border border-blue-500/30"
                    >
                        <span>📥</span> 导入 CSV
                    </button>

                    <button
                        onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border transition-colors ${showSelectedOnly
                            ? 'bg-amber-500 hover:bg-amber-600 border-amber-400/30 text-white'
                            : 'bg-black/20 hover:bg-white/10 border-white/10 text-white/90'
                            }`}
                    >
                        <span>⭐</span> {showSelectedOnly ? '显示全部' : '仅选定计划'}
                    </button>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-12 text-slate-500">加载中...</div>
            ) : error ? (
                <div className="text-center py-12 text-red-400">Error: {error}</div>
            ) : filteredPlans.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-800/50 rounded-lg border border-dashed border-white/10">
                    暂无计划，请点击右上角导入
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlans.map(plan => {
                        const isSelected = selectedPlanIds.has(plan.id)
                        return (
                            <div key={plan.id} className="bg-slate-800 border border-white/10 rounded-lg p-5 hover:border-blue-500/50 transition-colors group relative">
                                {isSelected && (
                                    <div className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] px-2 py-1 rounded-full font-medium flex items-center gap-1">
                                        <span>⭐</span> 选定计划
                                    </div>
                                )}
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-medium tracking-wider
                                    ${plan.scope_type === 'global' ? 'bg-purple-500/20 text-purple-300' :
                                            plan.scope_type === 'school' ? 'bg-blue-500/20 text-blue-300' :
                                                plan.scope_type === 'class' ? 'bg-green-500/20 text-green-300' :
                                                    'bg-slate-600/20 text-slate-400'
                                        }`}>
                                        {plan.scope_type}
                                    </span>
                                    <span className="text-xs text-slate-500">{new Date(plan.created_at).toLocaleDateString()}</span>
                                </div>

                                <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">
                                    {plan.name}
                                </h3>

                                <div className="text-xs text-slate-400 mb-4 line-clamp-2 h-8">
                                    {plan.description || 'No description'}
                                </div>

                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                                    <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">
                                        {plan.category || 'Uncategorized'}
                                    </span>
                                    <button
                                        onClick={() => setSelectedPlanId(plan.id)}
                                        className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded transition-colors"
                                    >
                                        查看详情
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleExport(plan.id, plan.name);
                                        }}
                                        className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded transition-colors ml-2"
                                        title="导出为CSV"
                                    >
                                        <span className="material-symbols-outlined text-[14px] align-text-bottom">download</span>
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {showImportModal && (
                <PlanImportModal
                    onClose={() => setShowImportModal(false)}
                    onSuccess={fetchPlans}
                />
            )}

            {selectedPlanId && (
                <PlanDetailsModal
                    planId={selectedPlanId}
                    onClose={() => setSelectedPlanId(null)}
                    onPlanDeleted={fetchPlans}
                />
            )}
        </div>
    )
}
