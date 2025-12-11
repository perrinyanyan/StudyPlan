import { useRef, useEffect } from 'react'
import * as THREE from 'three'

interface DigitParticleSceneProps {
    digit: number // 0-9 or -1 for none
    color: string
    size?: 'normal' | 'large'
}

const PARTICLE_COUNT = 1500

// 7-segment style digit patterns (each segment is on/off)
// Segments: top, top-right, bottom-right, bottom, bottom-left, top-left, middle
const DIGIT_SEGMENTS: Record<number, boolean[]> = {
    0: [true, true, true, true, true, true, false],
    1: [false, true, true, false, false, false, false],
    2: [true, true, false, true, true, false, true],
    3: [true, true, true, true, false, false, true],
    4: [false, true, true, false, false, true, true],
    5: [true, false, true, true, false, true, true],
    6: [true, false, true, true, true, true, true],
    7: [true, true, true, false, false, false, false],
    8: [true, true, true, true, true, true, true],
    9: [true, true, true, true, false, true, true],
}

// Generate positions for a digit using 7-segment display style
function getDigitPositions(digit: number, count: number): Float32Array {
    const positions = new Float32Array(count * 3)
    const segments = DIGIT_SEGMENTS[digit] || DIGIT_SEGMENTS[0]

    // Segment definitions: [startX, startY, endX, endY]
    const segmentDefs = [
        [-0.8, 1.6, 0.8, 1.6],   // top
        [0.8, 0.8, 0.8, 1.6],    // top-right
        [0.8, 0, 0.8, 0.8],      // bottom-right
        [-0.8, 0, 0.8, 0],       // bottom
        [-0.8, 0, -0.8, 0.8],    // bottom-left
        [-0.8, 0.8, -0.8, 1.6],  // top-left
        [-0.8, 0.8, 0.8, 0.8],   // middle
    ]

    // Count active segments
    const activeSegments = segments.filter(Boolean)
    const particlesPerSegment = Math.floor(count / Math.max(1, activeSegments.length))

    let particleIndex = 0

    for (let i = 0; i < segments.length; i++) {
        if (!segments[i]) continue
        const [x1, y1, x2, y2] = segmentDefs[i]

        for (let j = 0; j < particlesPerSegment && particleIndex < count; j++) {
            const t = j / particlesPerSegment
            const x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 0.15
            const y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 0.15 - 0.8 // Center vertically
            const z = (Math.random() - 0.5) * 0.3

            positions[particleIndex * 3] = x
            positions[particleIndex * 3 + 1] = y
            positions[particleIndex * 3 + 2] = z
            particleIndex++
        }
    }

    // Fill remaining particles with noise around the digit
    while (particleIndex < count) {
        positions[particleIndex * 3] = (Math.random() - 0.5) * 2
        positions[particleIndex * 3 + 1] = (Math.random() - 0.5) * 2
        positions[particleIndex * 3 + 2] = (Math.random() - 0.5) * 0.5
        particleIndex++
    }

    return positions
}

export function DigitParticleScene({ digit, color, size = 'normal' }: DigitParticleSceneProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const sceneDataRef = useRef<{
        scene: THREE.Scene
        camera: THREE.PerspectiveCamera
        renderer: THREE.WebGLRenderer
        particles: THREE.Points
        targetPositions: Float32Array
        currentPositions: Float32Array
    } | null>(null)

    // Initialize Three.js scene
    useEffect(() => {
        if (!containerRef.current) return

        const container = containerRef.current
        const width = container.clientWidth
        const height = container.clientHeight

        // Scene
        const scene = new THREE.Scene()

        // Camera
        const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
        camera.position.z = size === 'large' ? 4 : 5

        // Renderer
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setClearColor(0x000000, 0)
        container.appendChild(renderer.domElement)

        // Particles
        const geometry = new THREE.BufferGeometry()
        const initialPositions = getDigitPositions(digit >= 0 ? digit : 0, PARTICLE_COUNT)
        geometry.setAttribute('position', new THREE.BufferAttribute(initialPositions.slice(), 3))

        // Vertex colors
        const colors = new Float32Array(PARTICLE_COUNT * 3)
        const baseColor = new THREE.Color(color)
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const variation = 0.7 + Math.random() * 0.6
            colors[i * 3] = baseColor.r * variation
            colors[i * 3 + 1] = baseColor.g * variation
            colors[i * 3 + 2] = baseColor.b * variation
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

        const material = new THREE.PointsMaterial({
            size: size === 'large' ? 0.06 : 0.04,
            transparent: true,
            opacity: 0.9,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
        })

        const particles = new THREE.Points(geometry, material)
        scene.add(particles)

        sceneDataRef.current = {
            scene,
            camera,
            renderer,
            particles,
            targetPositions: initialPositions,
            currentPositions: initialPositions.slice(),
        }

        // Animation loop
        let animationId: number
        let time = 0
        const animate = () => {
            animationId = requestAnimationFrame(animate)
            time += 0.016

            if (!sceneDataRef.current) return
            const data = sceneDataRef.current

            // Interpolate positions
            const posAttr = particles.geometry.attributes.position as THREE.BufferAttribute
            const posArray = posAttr.array as Float32Array

            for (let i = 0; i < PARTICLE_COUNT * 3; i++) {
                data.currentPositions[i] += (data.targetPositions[i] - data.currentPositions[i]) * 0.1
                posArray[i] = data.currentPositions[i] + Math.sin(time * 2 + i * 0.01) * 0.01
            }
            posAttr.needsUpdate = true

            // Gentle floating
            particles.rotation.y = Math.sin(time * 0.3) * 0.05

            renderer.render(scene, camera)
        }
        animate()

        // Resize handler
        const handleResize = () => {
            if (!containerRef.current || !sceneDataRef.current) return
            const w = containerRef.current.clientWidth
            const h = containerRef.current.clientHeight
            sceneDataRef.current.camera.aspect = w / h
            sceneDataRef.current.camera.updateProjectionMatrix()
            sceneDataRef.current.renderer.setSize(w, h)
        }
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            cancelAnimationFrame(animationId)
            renderer.dispose()
            geometry.dispose()
            material.dispose()
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement)
            }
            sceneDataRef.current = null
        }
    }, [size])

    // Update digit
    useEffect(() => {
        if (!sceneDataRef.current || digit < 0 || digit > 9) return
        sceneDataRef.current.targetPositions = getDigitPositions(digit, PARTICLE_COUNT)
    }, [digit])

    // Update color
    useEffect(() => {
        if (!sceneDataRef.current) return
        const colorAttr = sceneDataRef.current.particles.geometry.attributes.color as THREE.BufferAttribute
        const colorArray = colorAttr.array as Float32Array
        const baseColor = new THREE.Color(color)

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const variation = 0.7 + Math.random() * 0.6
            colorArray[i * 3] = baseColor.r * variation
            colorArray[i * 3 + 1] = baseColor.g * variation
            colorArray[i * 3 + 2] = baseColor.b * variation
        }
        colorAttr.needsUpdate = true
    }, [color])

    return (
        <div
            ref={containerRef}
            className="w-full h-full"
            style={{ background: 'transparent' }}
        />
    )
}

// Component to display full time as particle digits (MM:SS)
interface TimeParticleDisplayProps {
    timeInSeconds: number
    color: string
    fingerOverride?: number // If set, display this number instead of time
}

export function TimeParticleDisplay({ timeInSeconds, color, fingerOverride }: TimeParticleDisplayProps) {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = timeInSeconds % 60

    // If finger override is active (0-10), show that number
    if (fingerOverride !== undefined && fingerOverride >= 0 && fingerOverride <= 10) {
        return (
            <div className="flex items-center justify-center gap-2 w-full h-full">
                <div className="w-32 h-48">
                    <DigitParticleScene
                        digit={fingerOverride > 9 ? 1 : fingerOverride}
                        color={color}
                        size="large"
                    />
                </div>
                {fingerOverride === 10 && (
                    <div className="w-32 h-48">
                        <DigitParticleScene digit={0} color={color} size="large" />
                    </div>
                )}
            </div>
        )
    }

    // Display time as MM:SS
    const d1 = Math.floor(minutes / 10)
    const d2 = minutes % 10
    const d3 = Math.floor(seconds / 10)
    const d4 = seconds % 10

    return (
        <div className="flex items-center justify-center gap-1 w-full h-full">
            <div className="w-20 h-32">
                <DigitParticleScene digit={d1} color={color} />
            </div>
            <div className="w-20 h-32">
                <DigitParticleScene digit={d2} color={color} />
            </div>
            <div className="flex flex-col gap-3 mx-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            </div>
            <div className="w-20 h-32">
                <DigitParticleScene digit={d3} color={color} />
            </div>
            <div className="w-20 h-32">
                <DigitParticleScene digit={d4} color={color} />
            </div>
        </div>
    )
}
