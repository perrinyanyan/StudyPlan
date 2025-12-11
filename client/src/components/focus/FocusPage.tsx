import { useState, useEffect, useRef } from 'react'
import { Task, Block } from '../../types'
import { playFocusSound } from '../../utils/focusSounds'
import { fmtHHmm } from '../../utils/datetime'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { ParticleScene } from './ParticleScene'
import { TimeParticleDisplay } from './DigitParticleScene'
import { useHandGesture, HandGestureOverlay } from './HandGestureProvider'

interface FocusPageProps {
    tasks: Task[]
    blocks?: Block[]
    initialTaskId?: string
    defaultDuration?: number  // in minutes
    startSoundType?: string
    endSoundType?: string
    onExit: () => void
}

type ThemeKey = 'clean' | 'minimal' | 'neon' | 'forest' | 'interactive3d'

type ParticleShape = 'heart' | 'flower' | 'saturn' | 'buddha' | 'firework' | 'countdown'

const SHAPE_OPTIONS: { key: ParticleShape; label: string; icon: string }[] = [
    { key: 'heart', label: '爱心', icon: 'favorite' },
    { key: 'flower', label: '花朵', icon: 'local_florist' },
    { key: 'saturn', label: '土星', icon: 'public' },
    { key: 'buddha', label: '佛像', icon: 'self_improvement' },
    { key: 'firework', label: '烟花', icon: 'celebration' },
    { key: 'countdown' as any, label: '数字倒计时', icon: 'timer' },
]

interface ThemeConfig {
    name: string
    bg: string
    text: string
    accent: string
    accentHover: string
    secondary: string
    blob1: string
    blob2: string
    cardBg: string
    cardBorder: string
    progressColor: string
}

const THEMES: Record<ThemeKey, ThemeConfig> = {
    clean: {
        name: 'Clean',
        bg: 'bg-[#0f172a]',
        text: 'text-white',
        accent: 'bg-blue-500',
        accentHover: 'hover:bg-blue-400',
        secondary: 'bg-white/10 text-white',
        blob1: 'bg-blue-500/30',
        blob2: 'bg-purple-500/30',
        cardBg: 'bg-white/5',
        cardBorder: 'border-white/10',
        progressColor: 'text-blue-500'
    },
    minimal: {
        name: 'Minimal',
        bg: 'bg-black',
        text: 'text-gray-200',
        accent: 'bg-white text-black',
        accentHover: 'hover:bg-gray-200',
        secondary: 'bg-gray-800 text-gray-200',
        blob1: 'hidden',
        blob2: 'hidden',
        cardBg: 'bg-gray-900',
        cardBorder: 'border-gray-800',
        progressColor: 'text-white'
    },
    neon: {
        name: 'Neon',
        bg: 'bg-slate-900',
        text: 'text-cyan-50',
        accent: 'bg-cyan-500 text-black',
        accentHover: 'hover:bg-cyan-400',
        secondary: 'bg-fuchsia-900/50 text-fuchsia-200 border border-fuchsia-500/30',
        blob1: 'bg-cyan-500/20 blur-[120px]',
        blob2: 'bg-fuchsia-500/20 blur-[120px]',
        cardBg: 'bg-slate-800/80 backdrop-blur-md',
        cardBorder: 'border-cyan-500/30',
        progressColor: 'text-cyan-400'
    },
    forest: {
        name: 'Forest',
        bg: 'bg-[#052e16]',
        text: 'text-emerald-50',
        accent: 'bg-emerald-500',
        accentHover: 'hover:bg-emerald-400',
        secondary: 'bg-emerald-900/50 text-emerald-200',
        blob1: 'bg-emerald-400/20',
        blob2: 'bg-yellow-400/10',
        cardBg: 'bg-emerald-900/30',
        cardBorder: 'border-emerald-500/20',
        progressColor: 'text-emerald-400'
    },
    interactive3d: {
        name: '3D互动',
        bg: 'bg-black',
        text: 'text-white',
        accent: 'bg-fuchsia-500',
        accentHover: 'hover:bg-fuchsia-400',
        secondary: 'bg-fuchsia-900/50 text-fuchsia-200',
        blob1: 'hidden',
        blob2: 'hidden',
        cardBg: 'bg-black/60 backdrop-blur-xl',
        cardBorder: 'border-fuchsia-500/30',
        progressColor: 'text-fuchsia-400'
    }
}

export function FocusPage({ tasks, blocks = [], initialTaskId, defaultDuration = 25, startSoundType = 'gentle', endSoundType = 'gentle', onExit }: FocusPageProps) {
    const [selectedTaskId, setSelectedTaskId] = useState<string | number>(initialTaskId || '')
    const [timeLeft, setTimeLeft] = useState(defaultDuration * 60)
    const [currentTheme, setCurrentTheme] = useState<ThemeKey>('clean')
    const theme = THEMES[currentTheme]
    const [isActive, setIsActive] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [initialTime, setInitialTime] = useState(defaultDuration * 60)
    const [isCustomDuration, setIsCustomDuration] = useState(false)
    const [customMinutes, setCustomMinutes] = useState('')
    const [isFullscreen, setIsFullscreen] = useState(false)

    // 3D Interactive Theme State
    const [particleShape, setParticleShape] = useState<ParticleShape>('heart')
    const [particleColor, setParticleColor] = useState('#ff66cc')
    const [digitCountdownMode, setDigitCountdownMode] = useState(false)
    const is3DTheme = currentTheme === 'interactive3d'
    const { handOpenness, fingerCount, isLoading: handLoading, error: handError, videoRef } = useHandGesture(is3DTheme)

    const timerRef = useRef<number | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedTask = tasks.find(t => t.id === selectedTaskId)

    // Find schedule info for selected task
    const activeBlock = selectedTask ? blocks.find(b => b.task_id === selectedTask.id) : null
    const scheduleTime = activeBlock
        ? `${fmtHHmm(new Date(activeBlock.start_at))} - ${fmtHHmm(new Date(activeBlock.end_at))}`
        : selectedTask?.due_at
            ? `截止: ${fmtHHmm(new Date(selectedTask.due_at))}`
            : null

    // Sync timer with schedule when task/block changes
    useEffect(() => {
        if (activeBlock) {
            const start = new Date(activeBlock.start_at).getTime()
            const end = new Date(activeBlock.end_at).getTime()
            const now = Date.now()

            const totalDurationSeconds = Math.floor((end - start) / 1000)

            // Calculate remaining time
            let remaining = totalDurationSeconds
            if (now > start && now < end) {
                remaining = Math.floor((end - now) / 1000)
            } else if (now >= end) {
                remaining = 0 // Or full duration reset? User asked for "start from half", implied logic is strictly time-based. 
                // If finished, maybe show 0 or full. Let's default to full if done, so they can re-focus? 
                // "Sync with schedule" implies if I'm late, I have less time. If I'm done, I'm done.
                // But usually users might want to extend. Let's start with full if it's completely past, 
                // but strictly follow remaining if inside window.
                remaining = totalDurationSeconds // Reset to full if past, otherwise it auto-ends immediately which is annoying.
            }

            if (totalDurationSeconds > 0) {
                setInitialTime(totalDurationSeconds)
                setTimeLeft(remaining)
                // If we are "live" (inside window), we might want to auto-start or just show the truncated time?
                // User said "Click start, start from half". So we update state, wait for user to click start.
            }
        } else {
            // No block, use default
            setInitialTime(defaultDuration * 60)
            setTimeLeft(defaultDuration * 60)
        }
    }, [selectedTaskId, activeBlock, defaultDuration])

    // Fullscreen functions
    const enterFullscreen = async () => {
        try {
            if (containerRef.current) {
                await containerRef.current.requestFullscreen()
            }
        } catch (err) {
            console.error('Fullscreen error:', err)
        }
    }

    const exitFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen()
            }
        } catch (err) {
            console.error('Exit fullscreen error:', err)
        }
    }

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    useEffect(() => {
        if (isActive && !isPaused && timeLeft > 0) {
            timerRef.current = window.setInterval(() => {
                setTimeLeft((prev) => prev - 1)
            }, 1000)
        } else if (timeLeft === 0) {
            setIsActive(false)
            setIsPaused(false)
            if (timerRef.current) clearInterval(timerRef.current)
            exitFullscreen()
            playFocusSound('end', endSoundType)
            if (Notification.permission === 'granted') {
                new Notification('专注结束', { body: '恭喜你完成了专注时段！' })
            }
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [isActive, isPaused, timeLeft])

    useEffect(() => {
        if (Notification.permission === 'default') {
            Notification.requestPermission()
        }
    }, [])

    // Auto-start when coming from planner with a task
    useEffect(() => {
        if (initialTaskId && !isActive) {
            // Small delay to ensure everything is mounted
            const timer = setTimeout(() => {
                playFocusSound('start', startSoundType)
                setIsActive(true)
                setIsPaused(false)
                enterFullscreen()
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [initialTaskId]) // Only run once on mount

    const toggleTimer = () => {
        if (!isActive) {
            playFocusSound('start', startSoundType)
            setIsActive(true)
            setIsPaused(false)
            enterFullscreen()
        } else {
            setIsPaused(!isPaused)
        }
    }

    const stopTimer = () => {
        setIsActive(false)
        setIsPaused(false)
        // Reset to initial computed time (block duration or default)
        // Re-calculate "now" based remaining? Or just reset to initial set value?
        // If "stop", usually implies reset. The initialTime is the total duration.
        // If we want to strictly reset to "live" time, we'd need to recalc.
        // For now, reset to total duration seems safer UX than resetting to "halfway".
        // Actually, if I stop, I probably want to restart the session or full session.
        // Let's reset to initialTime (total duration).
        setTimeLeft(initialTime)
        exitFullscreen()
    }

    const setDuration = (minutes: number) => {
        const seconds = minutes * 60
        setInitialTime(seconds)
        setTimeLeft(seconds)
        setIsActive(false)
        setIsPaused(false)
        setIsCustomDuration(false)
    }

    const handleCustomDurationSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const mins = parseInt(customMinutes)
        if (!isNaN(mins) && mins > 0) {
            setDuration(mins)
        }
    }

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const progress = ((initialTime - timeLeft) / initialTime) * 100
    const isImmersive = isFullscreen && isActive

    // Priority Helpers
    const getPriorityLabel = (p?: number | null) => {
        if (p === 2) return { label: '高优先级', color: 'text-rose-400 bg-rose-400/10 border-rose-400/20' }
        if (p === 1) return { label: '中优先级', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' }
        return { label: '低优先级', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' }
    }

    return (
        <div ref={containerRef} className={`min-h-screen ${theme.bg} ${theme.text} flex flex-col items-center justify-center p-4 relative overflow-hidden transition-colors duration-500`}>
            {/* 3D Particle Background */}
            {is3DTheme && !digitCountdownMode && (
                <ParticleScene shape={particleShape} color={particleColor} handOpenness={handOpenness} />
            )}

            {/* Background decoration (non-3D themes) */}
            {!is3DTheme && (
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                    <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[100px] transition-all duration-1000 ${theme.blob1}`} />
                    <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[100px] transition-all duration-1000 ${theme.blob2}`} />
                </div>
            )}

            {/* 3D Controls Panel */}
            {is3DTheme && !isImmersive && (
                <div className="absolute top-4 left-4 z-20 flex flex-col gap-3 p-4 rounded-2xl bg-black/60 backdrop-blur-xl border border-fuchsia-500/30 shadow-2xl">
                    {/* Shape Selector */}
                    <div className="flex flex-wrap gap-2">
                        {SHAPE_OPTIONS.map((s) => (
                            <button
                                key={s.key}
                                onClick={() => {
                                    if (s.key === 'countdown') {
                                        setDigitCountdownMode(true)
                                    } else {
                                        setDigitCountdownMode(false)
                                        setParticleShape(s.key as ParticleShape)
                                    }
                                }}
                                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${(s.key === 'countdown' ? digitCountdownMode : particleShape === s.key && !digitCountdownMode) ? 'bg-fuchsia-500 text-white scale-105' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                                title={s.label}
                            >
                                <span className="material-symbols-outlined text-lg">{s.icon}</span>
                                <span className="text-[10px]">{s.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Color Picker */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-white/60">颜色</span>
                        <input
                            type="color"
                            value={particleColor}
                            onChange={(e) => setParticleColor(e.target.value)}
                            className="w-8 h-8 rounded-lg cursor-pointer border-2 border-white/20"
                        />
                        <div className="flex gap-1">
                            {['#ff66cc', '#00ffff', '#ffff00', '#00ff88', '#ff6600'].map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setParticleColor(c)}
                                    className={`w-6 h-6 rounded-full transition-transform ${particleColor === c ? 'scale-110 ring-2 ring-white' : 'hover:scale-105'}`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Camera Preview */}
                    {handLoading && (
                        <div className="text-xs text-white/50 flex items-center gap-2">
                            <span className="material-symbols-outlined animate-spin text-base">sync</span>
                            加载摄像头...
                        </div>
                    )}
                    {handError && (
                        <div className="text-xs text-rose-400 flex items-center gap-2">
                            <span className="material-symbols-outlined text-base">warning</span>
                            {handError}
                        </div>
                    )}
                    {!handLoading && !handError && videoRef.current && (
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-white/40">
                                {digitCountdownMode ? `手指数量: ${fingerCount}` : '张合手掌控制粒子扩散'}
                            </span>
                            <HandGestureOverlay videoElement={videoRef.current} handOpenness={handOpenness} />
                        </div>
                    )}
                </div>
            )}

            {isImmersive ? (
                /* Immersive Fullscreen Mode - Timer + Task Details */
                <div className="z-10 w-full h-full max-w-7xl mx-auto flex items-center justify-center p-8 gap-16">
                    {/* Left: Timer */}
                    <div className="flex flex-col items-center gap-12">
                        {/* Timer Display */}
                        <div className="relative w-[500px] h-[500px] flex items-center justify-center">
                            {is3DTheme && digitCountdownMode ? (
                                <div className="w-full h-full flex items-center justify-center">
                                    <TimeParticleDisplay
                                        timeInSeconds={timeLeft}
                                        color={particleColor}
                                        fingerOverride={fingerCount > 0 ? fingerCount : undefined}
                                    />
                                </div>
                            ) : (
                                <>
                                    <svg className="absolute inset-0 -rotate-90" width="500" height="500" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10" />
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4"
                                            strokeDasharray="283" strokeDashoffset={283 - (283 * progress) / 100}
                                            className={`${theme.progressColor} transition-all duration-1000`} strokeLinecap="round" />
                                    </svg>
                                    <div className="text-9xl font-mono font-bold tracking-tighter tabular-nums relative z-10">
                                        {formatTime(timeLeft)}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-6">
                            <button onClick={toggleTimer}
                                className={`h-24 w-24 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 ${isPaused ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-amber-500 hover:bg-amber-400'
                                    }`}>
                                <span className="material-symbols-outlined text-5xl">{isPaused ? 'play_arrow' : 'pause'}</span>
                            </button>
                            <button onClick={stopTimer}
                                className="h-20 w-20 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:scale-110">
                                <span className="material-symbols-outlined text-3xl">stop</span>
                            </button>
                        </div>
                    </div>

                    {/* Right: Task Details (Only if task selected) */}
                    {selectedTask && (
                        <div className={`w-[400px] flex flex-col gap-6 p-8 rounded-3xl ${theme.cardBg} ${theme.cardBorder} border backdrop-blur-xl shadow-2xl transaction-colors duration-500`}>
                            <div>
                                <h2 className={`text-3xl font-bold ${theme.text} leading-tight`}>{selectedTask.title}</h2>
                                {scheduleTime && (
                                    <div className="flex items-center gap-2 mt-3 text-lg text-blue-300">
                                        <span className="material-symbols-outlined text-xl">schedule</span>
                                        <span>{scheduleTime}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {(() => {
                                    const p = getPriorityLabel(selectedTask.priority)
                                    return (
                                        <span className={`px-3 py-1 rounded text-sm border ${p.color}`}>
                                            {p.label}
                                        </span>
                                    )
                                })()}
                                {selectedTask.type && (
                                    <span className="px-3 py-1 rounded text-sm bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                        {selectedTask.type}
                                    </span>
                                )}
                                {selectedTask.tags?.map(tag => (
                                    <span key={tag} className="px-3 py-1 rounded text-sm bg-slate-700/50 text-slate-300 border border-white/10">
                                        #{tag}
                                    </span>
                                ))}
                            </div>

                            {selectedTask.content && (
                                <div className="mt-2 pt-6 border-t border-white/10">
                                    <div className="text-base text-white/80 whitespace-pre-wrap leading-snug max-h-[400px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] prose prose-invert prose-sm max-w-none [&>p]:my-0 [&>ul]:my-0 [&>ol]:my-0 [&>ul]:pl-4 [&>ol]:pl-4 [&_li]:my-0 [&_mark]:bg-yellow-500/40 [&_mark]:text-yellow-100">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                            {selectedTask.content.replace(/==([^=]+)==/g, '<mark>$1</mark>')}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="absolute top-8 right-8 text-white/30 text-base font-medium">按 ESC 退出全屏</div>
                </div>
            ) : (
                /* Normal Mode - Full UI */
                <div className="z-10 w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">

                    {/* Left Column: Timer & Controls */}
                    <div className="flex flex-col items-center gap-8 order-2 md:order-1">
                        {/* Timer Display */}
                        <div className="relative w-80 h-80 flex items-center justify-center">
                            {is3DTheme && digitCountdownMode ? (
                                <div className="w-full h-full flex items-center justify-center scale-75">
                                    <TimeParticleDisplay
                                        timeInSeconds={timeLeft}
                                        color={particleColor}
                                        fingerOverride={fingerCount > 0 ? fingerCount : undefined}
                                    />
                                </div>
                            ) : (
                                <>
                                    {/* Progress Ring */}
                                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4"
                                            strokeDasharray="283" strokeDashoffset={283 - (283 * progress) / 100}
                                            className={`${theme.progressColor} transition-all duration-1000 ease-linear`} strokeLinecap="round" />
                                    </svg>
                                    <div className="text-7xl font-mono font-bold tracking-tighter tabular-nums">
                                        {formatTime(timeLeft)}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-6">
                            {!isActive ? (
                                <button
                                    onClick={toggleTimer}
                                    className={`h-20 w-20 rounded-full ${theme.accent} ${theme.accentHover} flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95`}
                                >
                                    <span className="material-symbols-outlined text-4xl">play_arrow</span>
                                </button>
                            ) : (
                                <>
                                    <button onClick={toggleTimer}
                                        className={`h-20 w-20 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 ${isPaused
                                            ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'
                                            : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20'
                                            }`}>
                                        <span className="material-symbols-outlined text-4xl">
                                            {isPaused ? 'play_arrow' : 'pause'}
                                        </span>
                                    </button>
                                    <button onClick={stopTimer}
                                        className="h-16 w-16 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95">
                                        <span className="material-symbols-outlined text-2xl">stop</span>
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Duration Presets */}
                        {!isActive && (
                            <div className="flex gap-3 items-center">
                                {[25, 45, 60].map(min => (
                                    <button
                                        key={min}
                                        onClick={() => setDuration(min)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${initialTime === min * 60 && !isCustomDuration
                                            ? `${theme.secondary} opacity-100`
                                            : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        {min}m
                                    </button>
                                ))}
                                {/* Custom Input... Simplified for cleaner UI, expand if needed */}
                                <button
                                    onClick={() => {
                                        const m = prompt('输入分钟数:', '25')
                                        if (m) {
                                            const min = parseInt(m)
                                            if (min > 0) setDuration(min)
                                        }
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                    自定义
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Task Details */}
                    <div className="flex flex-col gap-6 order-1 md:order-2 w-full max-w-sm mx-auto">
                        <div className="flex justify-between items-center">
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                Focus Mode
                            </h1>
                            <div className="flex items-center gap-2">
                                {/* Theme Selector */}
                                <div className="flex bg-slate-800/50 rounded-full p-1 mr-2 border border-white/5">
                                    {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
                                        <button
                                            key={k}
                                            onClick={() => setCurrentTheme(k)}
                                            className={`w-6 h-6 rounded-full transition-all ${currentTheme === k ? 'scale-110 ring-2 ring-offset-2 ring-offset-slate-900 ring-white' : 'opacity-50 hover:opacity-100 hover:scale-105'}`}
                                            style={{ backgroundColor: k === 'clean' ? '#3b82f6' : k === 'minimal' ? '#ffffff' : k === 'neon' ? '#06b6d4' : '#10b981' }}
                                            title={THEMES[k].name}
                                        />
                                    ))}
                                </div>
                                <button onClick={onExit} className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>

                        {!initialTaskId && (
                            <div className="w-full">
                                <select
                                    value={selectedTaskId}
                                    onChange={(e) => setSelectedTaskId(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 transition-colors appearance-none"
                                >
                                    <option value="" className="bg-slate-900 text-white">选择一个任务...</option>
                                    {tasks.map(task => (
                                        <option key={task.id} value={task.id} className="bg-slate-900 text-white">
                                            {task.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {selectedTask ? (
                            <div className={`flex flex-col gap-4 p-6 rounded-2xl ${theme.cardBg} ${theme.cardBorder} border backdrop-blur-sm shadow-xl transition-colors duration-500`}>
                                <div>
                                    <h2 className={`text-xl font-semibold ${theme.text} leading-tight`}>{selectedTask.title}</h2>
                                    {scheduleTime && (
                                        <div className="flex items-center gap-2 mt-2 text-sm text-blue-300">
                                            <span className="material-symbols-outlined text-base">schedule</span>
                                            <span>{scheduleTime}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Meta Tags */}
                                <div className="flex flex-wrap gap-2">
                                    {/* Priority */}
                                    {(() => {
                                        const p = getPriorityLabel(selectedTask.priority)
                                        return (
                                            <span className={`px-2 py-0.5 rounded text-xs border ${p.color}`}>
                                                {p.label}
                                            </span>
                                        )
                                    })()}

                                    {/* Type */}
                                    {selectedTask.type && (
                                        <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                            {selectedTask.type}
                                        </span>
                                    )}

                                    {/* Tags */}
                                    {selectedTask.tags?.map(tag => (
                                        <span key={tag} className="px-2 py-0.5 rounded text-xs bg-slate-700/50 text-slate-300 border border-white/10">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>

                                {selectedTask.content && (
                                    <div className="mt-2 pt-4 border-t border-white/10">
                                        <div className="text-sm text-white/70 whitespace-pre-wrap leading-snug max-h-40 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] prose prose-invert prose-xs max-w-none [&>p]:my-0 [&>ul]:my-0 [&>ol]:my-0 [&>ul]:pl-4 [&>ol]:pl-4 [&_li]:my-0 [&_mark]:bg-yellow-500/40 [&_mark]:text-yellow-100">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                                {selectedTask.content.replace(/==([^=]+)==/g, '<mark>$1</mark>')}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 border-dashed text-center text-white/40">
                                <span className="material-symbols-outlined text-4xl mb-2">task_alt</span>
                                <p>请选择一个任务开始专注</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
