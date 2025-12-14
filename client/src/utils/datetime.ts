// 日期 / 时间相关通用工具函数，供 App 与组件复用

export function todayStr(d: Date = new Date()): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

export function toIso(dateStr: string, timeStr?: string): string {
    const t = (timeStr || '00:00') + ':00'
    const local = new Date(`${dateStr}T${t}`)
    return local.toISOString()
}

export function fmtHHmm(d: Date): string {
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
}

export function fmtYmdHM(d: Date): string {
    return `${todayStr(d)} ${fmtHHmm(d)}`
}

export const DEFAULT_TZ_LIST = [
    'UTC',
    'Asia/Shanghai',
    'Asia/Hong_Kong',
    'Asia/Singapore',
    'Asia/Taipei',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Asia/Bangkok',
    'Asia/Kolkata',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Madrid',
    'Europe/Moscow',
    'America/Los_Angeles',
    'America/Denver',
    'America/Chicago',
    'America/New_York',
    'America/Toronto',
    'America/Sao_Paulo',
    'Australia/Sydney',
    'Pacific/Auckland',
]

export function defaultTimeZone(): string {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        return tz || 'Asia/Shanghai'
    } catch {
        return 'Asia/Shanghai'
    }
}

export function formatYmdWeek(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const w = weekdays[d.getDay()]
    return `${y}年${m}月${day}日 ${w}`
}

export function parseDurationMin(s: string): number | null {
    const str = s.trim()
    if (!str) return null
    const mm = str.match(/^([0-9]{1,2}):(\d{2})$/)
    if (mm) {
        const h = parseInt(mm[1])
        const m = parseInt(mm[2])
        return h * 60 + m
    }
    let total = 0
    const h = str.match(/(\d+)\s*h/) || str.match(/(\d+)小时/)
    if (h) total += parseInt(h[1]) * 60
    const m = str.match(/(\d+)\s*m/) || str.match(/(\d+)分/)
    if (m) total += parseInt(m[1])
    if (!h && !m) {
        const onlyMin = str.match(/^\d+$/)
        if (onlyMin) return parseInt(str)
        return null
    }
    return total
}

export function fmtRange(start: Date, end: Date): string {
    const s = fmtHHmm(start)
    // Check if end is exactly midnight of the next day
    // Or if it is 00:00
    let e = fmtHHmm(end)
    if (e === '00:00') {
        // If it is midnight, we might want to check if it's after start
        // But typically for a range, if end is 00:00, it usually means 24:00
        e = '24:00'
    }
    return `${s} - ${e}`
}
