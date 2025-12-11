import { useRef, useEffect, useState } from 'react'

// CDN-based MediaPipe for better compatibility
declare global {
    interface Window {
        Hands: any
        Camera: any
    }
}

interface HandGestureContextValue {
    handOpenness: number
    fingerCount: number
    isLoading: boolean
    error: string | null
    videoRef: React.RefObject<HTMLVideoElement>
}

// Calculate hand openness based on landmark distances
function calculateHandOpenness(landmarks: any[]): number {
    if (!landmarks || landmarks.length < 21) return 0.5

    // Calculate average distance from fingertips to palm center
    const palmCenter = landmarks[0] // Wrist
    const fingertips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]]

    let totalDistance = 0
    for (const tip of fingertips) {
        const dx = tip.x - palmCenter.x
        const dy = tip.y - palmCenter.y
        const dz = (tip.z || 0) - (palmCenter.z || 0)
        totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz)
    }

    // Normalize to 0-1 range (approximate values based on typical hand)
    const avgDistance = totalDistance / 5
    const minDist = 0.1
    const maxDist = 0.4
    const normalized = (avgDistance - minDist) / (maxDist - minDist)
    return Math.max(0, Math.min(1, normalized))
}

// Count extended fingers based on landmark positions
function countFingers(landmarks: any[]): number {
    if (!landmarks || landmarks.length < 21) return 0

    let count = 0

    // Thumb: compare tip x to IP joint x (considering hand orientation)
    const thumbTip = landmarks[4]
    const thumbIP = landmarks[3]
    const wrist = landmarks[0]
    const isRightHand = landmarks[5].x < wrist.x
    if (isRightHand) {
        if (thumbTip.x < thumbIP.x) count++
    } else {
        if (thumbTip.x > thumbIP.x) count++
    }

    // Other fingers: compare tip y to PIP joint y (lower y = higher position)
    const fingerPairs = [
        [8, 6],   // Index: tip vs PIP
        [12, 10], // Middle: tip vs PIP
        [16, 14], // Ring: tip vs PIP
        [20, 18], // Pinky: tip vs PIP
    ]

    for (const [tipIdx, pipIdx] of fingerPairs) {
        if (landmarks[tipIdx].y < landmarks[pipIdx].y) {
            count++
        }
    }

    return count
}

export function useHandGesture(enabled: boolean): HandGestureContextValue {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [handOpenness, setHandOpenness] = useState(0.5)
    const [fingerCount, setFingerCount] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const handsRef = useRef<any>(null)
    const cameraRef = useRef<any>(null)

    useEffect(() => {
        if (!enabled) {
            // Cleanup when disabled
            if (cameraRef.current) {
                cameraRef.current.stop()
                cameraRef.current = null
            }
            return
        }

        let isMounted = true

        const loadMediaPipe = async () => {
            setIsLoading(true)
            setError(null)

            try {
                // Load MediaPipe scripts from CDN
                if (!window.Hands) {
                    await Promise.all([
                        loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'),
                        loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'),
                    ])
                }

                if (!isMounted) return

                // Create video element if not exists
                if (!videoRef.current) {
                    const video = document.createElement('video')
                    video.style.display = 'none'
                    document.body.appendChild(video)
                        ; (videoRef as any).current = video
                }

                // Initialize MediaPipe Hands
                const hands = new window.Hands({
                    locateFile: (file: string) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
                })

                hands.setOptions({
                    maxNumHands: 2,
                    modelComplexity: 0, // 0 = lite, fastest
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                })

                hands.onResults((results: any) => {
                    if (!isMounted) return
                    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                        // Average openness across all detected hands
                        let totalOpenness = 0
                        let totalFingers = 0
                        for (const hand of results.multiHandLandmarks) {
                            totalOpenness += calculateHandOpenness(hand)
                            totalFingers += countFingers(hand)
                        }
                        const avgOpenness = totalOpenness / results.multiHandLandmarks.length
                        setHandOpenness(avgOpenness)
                        setFingerCount(totalFingers)
                    } else {
                        setFingerCount(0)
                    }
                })

                handsRef.current = hands

                // Start camera
                const camera = new window.Camera(videoRef.current, {
                    onFrame: async () => {
                        if (handsRef.current && videoRef.current) {
                            await handsRef.current.send({ image: videoRef.current })
                        }
                    },
                    width: 640,
                    height: 480,
                })

                cameraRef.current = camera
                await camera.start()

                if (isMounted) {
                    setIsLoading(false)
                }
            } catch (err: any) {
                console.error('MediaPipe error:', err)
                if (isMounted) {
                    setIsLoading(false)
                    setError(err.message || '无法初始化手势检测')
                    // Fallback to simulation
                    startSimulation()
                }
            }
        }

        const startSimulation = () => {
            // Fallback: simulate hand tracking with smooth random walk
            let value = 0.5
            const simulate = () => {
                if (!isMounted) return
                value += (Math.random() - 0.5) * 0.05
                value = Math.max(0, Math.min(1, value))
                setHandOpenness(value)
                setTimeout(simulate, 100)
            }
            simulate()
        }

        loadMediaPipe()

        return () => {
            isMounted = false
            if (cameraRef.current) {
                cameraRef.current.stop()
                cameraRef.current = null
            }
            if (handsRef.current) {
                handsRef.current.close()
                handsRef.current = null
            }
        }
    }, [enabled])

    return { handOpenness, fingerCount, isLoading, error, videoRef }
}

// Helper to load external scripts
function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve()
            return
        }
        const script = document.createElement('script')
        script.src = src
        script.crossOrigin = 'anonymous'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(script)
    })
}

interface HandGestureOverlayProps {
    videoElement: HTMLVideoElement | null
    handOpenness: number
}

export function HandGestureOverlay({ videoElement, handOpenness }: HandGestureOverlayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        if (!videoElement || !canvasRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let animationId: number

        const draw = () => {
            if (!videoElement.videoWidth) {
                animationId = requestAnimationFrame(draw)
                return
            }

            canvas.width = 160
            canvas.height = 120

            // Draw video (mirrored)
            ctx.save()
            ctx.scale(-1, 1)
            ctx.drawImage(videoElement, -canvas.width, 0, canvas.width, canvas.height)
            ctx.restore()

            // Draw openness indicator
            ctx.fillStyle = `hsl(${280 + handOpenness * 60}, 80%, 60%)`
            ctx.fillRect(4, canvas.height - 8, (canvas.width - 8) * handOpenness, 4)
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'
            ctx.strokeRect(4, canvas.height - 8, canvas.width - 8, 4)

            animationId = requestAnimationFrame(draw)
        }

        draw()

        return () => {
            cancelAnimationFrame(animationId)
        }
    }, [videoElement, handOpenness])

    return (
        <div className="relative rounded-lg overflow-hidden border border-white/20 shadow-lg">
            <canvas ref={canvasRef} className="w-40 h-30 object-cover" />
            <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-[10px] text-white/70 text-center">
                张开手掌 → 粒子扩散
            </div>
        </div>
    )
}
