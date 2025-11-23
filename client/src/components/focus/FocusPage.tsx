import { useState, useEffect, useRef } from 'react'
import { Task } from '../../types'

interface FocusPageProps {
    tasks: Task[]
    initialTaskId?: string
    onExit: () => void
}

export function FocusPage({ tasks, initialTaskId, onExit }: FocusPageProps) {
    const [selectedTaskId, setSelectedTaskId] = useState<string | number>(initialTaskId || '')
    const [timeLeft, setTimeLeft] = useState(25 * 60)
    const [isActive, setIsActive] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [initialTime, setInitialTime] = useState(25 * 60)
    const [isCustomDuration, setIsCustomDuration] = useState(false)
    const [customMinutes, setCustomMinutes] = useState('')
    const [isFullscreen, setIsFullscreen] = useState(false)

    const timerRef = useRef<number | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const selectedTask = tasks.find(t => t.id === selectedTaskId)

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

    const toggleTimer = () => {
        if (!isActive) {
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

    return (
        <div ref={containerRef} className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/30 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/30 rounded-full blur-[100px]" />
            </div>

            {isImmersive ? (
                /* Immersive Fullscreen Mode - Only Timer */
                <div className="z-10 w-full h-full flex flex-col items-center justify-center gap-12">
                    {selectedTask && (
                        <div className="text-2xl text-white/50 font-medium">
                            {selectedTask.title}
                        </div>
                    )}

                    <div className="relative w-[500px] h-[500px] flex items-center justify-center">
                        <svg className="absolute inset-0" width="500" height="500" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10" />
                            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4"
                                strokeDasharray="283" strokeDashoffset={283 - (283 * progress) / 100}
                                className="text-blue-500 transition-all duration-1000" strokeLinecap="round" />
                        </svg>
                        <div className="text-9xl font-mono font-bold tracking-tighter tabular-nums relative z-10">
                            {formatTime(timeLeft)}
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <button onClick={toggleTimer}
                            className={`h-20 w-20 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 ${isPaused ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-amber-500 hover:bg-amber-400'
                                }`}>
                            <span className="material-symbols-outlined text-4xl">{isPaused ? 'play_arrow' : 'pause'}</span>
                        </button>
                        <button onClick={stopTimer}
                            className="h-16 w-16 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:scale-110">
                            <span className="material-symbols-outlined text-2xl">stop</span>
                        </button>
                    </div>

                    <div className="absolute top-6 right-6 text-white/20 text-sm">按 ESC 退出全屏</div>
                </div>
            ) : (
                /* Normal Mode - Full UI */
                <div className="z-10 w-full max-w-md flex flex-col items-center gap-8">
                    {/* Header / Exit */}
                    <div className="w-full flex justify-between items-center">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                            Focus Mode
                        </h1>
                        <button
                            onClick={onExit}
                            className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Task Selector */}
                    <div className="w-full">
                        <label className="block text-sm text-white/60 mb-2">当前专注任务</label>
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

                    {/* Timer Display */}
                    <div className="relative w-72 h-72 flex items-center justify-center">
                        {/* Progress Ring */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle
                                cx="50"
                                cy="50"
                                r="45"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                                className="text-white/5"
                            />
                            <circle
                                cx="50"
                                cy="50"
                                r="45"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                                strokeDasharray="283"
                                strokeDashoffset={283 - (283 * progress) / 100}
                                className="text-blue-500 transition-all duration-1000 ease-linear"
                                strokeLinecap="round"
                            />
                        </svg>

                        <div className="text-7xl font-mono font-bold tracking-tighter tabular-nums">
                            {formatTime(timeLeft)}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-6">
                        {!isActive ? (
                            <button
                                onClick={toggleTimer}
                                className="h-16 w-16 rounded-full bg-blue-500 hover:bg-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
                            >
                                <span className="material-symbols-outlined text-3xl">play_arrow</span>
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={toggleTimer}
                                    className={`h-16 w-16 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 ${isPaused
                                        ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'
                                        : 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-3xl">
                                        {isPaused ? 'play_arrow' : 'pause'}
                                    </span>
                                </button>
                                <button
                                    onClick={stopTimer}
                                    className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                                >
                                    <span className="material-symbols-outlined text-xl">stop</span>
                                </button>
                                {!isFullscreen && (
                                    <button
                                        onClick={enterFullscreen}
                                        className="h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                                        title="进入全屏"
                                    >
                                        <span className="material-symbols-outlined text-xl">fullscreen</span>
                                    </button>
                                )}
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
                                        ? 'bg-white/20 text-white'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {min} 分钟
                                </button>
                            ))}

                            {isCustomDuration ? (
                                <form onSubmit={handleCustomDurationSubmit} className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="180"
                                        value={customMinutes}
                                        onChange={(e) => setCustomMinutes(e.target.value)}
                                        placeholder="分钟"
                                        className="w-16 px-2 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:border-blue-500"
                                        autoFocus
                                    />
                                    <button
                                        type="submit"
                                        className="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm"
                                    >
                                        确定
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsCustomDuration(false)}
                                        className="p-2 rounded-lg hover:bg-white/10 text-white/60"
                                    >
                                        <span className="material-symbols-outlined text-sm">close</span>
                                    </button>
                                </form>
                            ) : (
                                <button
                                    onClick={() => {
                                        setIsCustomDuration(true)
                                        setCustomMinutes('')
                                    }}
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                                >
                                    自定义
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
