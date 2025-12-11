import { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'

type ParticleShape = 'heart' | 'flower' | 'saturn' | 'buddha' | 'firework'

interface ParticleSceneProps {
    shape: ParticleShape
    color: string
    handOpenness: number
}

const PARTICLE_COUNT = 3000

// Generate positions for different shapes
function getShapePositions(shape: ParticleShape, count: number): Float32Array {
    const positions = new Float32Array(count * 3)

    switch (shape) {
        case 'heart':
            for (let i = 0; i < count; i++) {
                const t = (i / count) * Math.PI * 2
                const x = 16 * Math.pow(Math.sin(t), 3)
                const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
                const z = (Math.random() - 0.5) * 3
                positions[i * 3] = x * 0.12 + (Math.random() - 0.5) * 0.3
                positions[i * 3 + 1] = y * 0.12 + (Math.random() - 0.5) * 0.3
                positions[i * 3 + 2] = z * 0.5
            }
            break

        case 'flower':
            for (let i = 0; i < count; i++) {
                const t = (i / count) * Math.PI * 2 * 3
                const r = Math.cos(5 * t) * 1.5 + 2.5
                const x = r * Math.cos(t)
                const y = r * Math.sin(t)
                const z = (Math.random() - 0.5) * 1.5
                positions[i * 3] = x * 0.6 + (Math.random() - 0.5) * 0.4
                positions[i * 3 + 1] = y * 0.6 + (Math.random() - 0.5) * 0.4
                positions[i * 3 + 2] = z
            }
            break

        case 'saturn':
            for (let i = 0; i < count; i++) {
                if (i < count * 0.6) {
                    // Sphere (planet)
                    const phi = Math.acos(2 * Math.random() - 1)
                    const theta = Math.random() * Math.PI * 2
                    const r = 1.2 + Math.random() * 0.2
                    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
                    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
                    positions[i * 3 + 2] = r * Math.cos(phi)
                } else {
                    // Ring
                    const theta = Math.random() * Math.PI * 2
                    const r = 2.2 + Math.random() * 0.8
                    const tilt = 0.3
                    positions[i * 3] = r * Math.cos(theta)
                    positions[i * 3 + 1] = (Math.random() - 0.5) * 0.08 + Math.sin(theta) * tilt
                    positions[i * 3 + 2] = r * Math.sin(theta) * 0.5
                }
            }
            break

        case 'buddha':
            // Seated meditation figure silhouette
            for (let i = 0; i < count; i++) {
                const section = Math.random()
                if (section < 0.25) {
                    // Head (sphere)
                    const phi = Math.acos(2 * Math.random() - 1)
                    const theta = Math.random() * Math.PI * 2
                    const r = 0.45
                    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
                    positions[i * 3 + 1] = 1.8 + r * Math.sin(phi) * Math.sin(theta)
                    positions[i * 3 + 2] = r * Math.cos(phi) * 0.8
                } else if (section < 0.55) {
                    // Body (ellipsoid)
                    const phi = Math.acos(2 * Math.random() - 1)
                    const theta = Math.random() * Math.PI * 2
                    const rx = 0.7, ry = 0.9, rz = 0.5
                    positions[i * 3] = rx * Math.sin(phi) * Math.cos(theta)
                    positions[i * 3 + 1] = 0.7 + ry * Math.sin(phi) * Math.sin(theta) * 0.5
                    positions[i * 3 + 2] = rz * Math.cos(phi)
                } else if (section < 0.75) {
                    // Crossed legs
                    const t = Math.random() * Math.PI
                    const x = (Math.random() - 0.5) * 1.8
                    positions[i * 3] = x
                    positions[i * 3 + 1] = -0.3 + Math.abs(x) * 0.15 + Math.random() * 0.2
                    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4
                } else {
                    // Aura/halo effect
                    const angle = Math.random() * Math.PI * 2
                    const r = 2.5 + Math.random() * 0.5
                    positions[i * 3] = r * Math.cos(angle) * 0.8
                    positions[i * 3 + 1] = 0.8 + r * Math.sin(angle) * 0.4
                    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.3
                }
            }
            break

        case 'firework':
            for (let i = 0; i < count; i++) {
                // Starburst pattern with trails
                const phi = Math.acos(2 * Math.random() - 1)
                const theta = Math.random() * Math.PI * 2
                const r = Math.pow(Math.random(), 0.5) * 3
                positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
                positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
                positions[i * 3 + 2] = r * Math.cos(phi)
            }
            break

        default:
            for (let i = 0; i < count; i++) {
                positions[i * 3] = (Math.random() - 0.5) * 5
                positions[i * 3 + 1] = (Math.random() - 0.5) * 5
                positions[i * 3 + 2] = (Math.random() - 0.5) * 5
            }
    }

    return positions
}

export function ParticleScene({ shape, color, handOpenness }: ParticleSceneProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const sceneDataRef = useRef<{
        scene: THREE.Scene
        camera: THREE.PerspectiveCamera
        renderer: THREE.WebGLRenderer
        particles: THREE.Points
        basePositions: Float32Array
        targetOpenness: number
        currentOpenness: number
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
        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000)
        camera.position.z = 6

        // Renderer
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setClearColor(0x000000, 0)
        container.appendChild(renderer.domElement)

        // Particles
        const geometry = new THREE.BufferGeometry()
        const positions = getShapePositions(shape, PARTICLE_COUNT)
        geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))

        // Vertex colors for shimmer effect
        const colors = new Float32Array(PARTICLE_COUNT * 3)
        const baseColor = new THREE.Color(color)
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const variation = 0.8 + Math.random() * 0.4
            colors[i * 3] = baseColor.r * variation
            colors[i * 3 + 1] = baseColor.g * variation
            colors[i * 3 + 2] = baseColor.b * variation
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

        const material = new THREE.PointsMaterial({
            size: 0.04,
            transparent: true,
            opacity: 0.85,
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
            basePositions: positions,
            targetOpenness: 0.5,
            currentOpenness: 0.5,
        }

        // Animation loop with smooth interpolation
        let animationId: number
        let time = 0
        const animate = () => {
            animationId = requestAnimationFrame(animate)
            time += 0.016

            if (!sceneDataRef.current) return
            const data = sceneDataRef.current

            // Smooth openness transition
            data.currentOpenness += (data.targetOpenness - data.currentOpenness) * 0.08
            const dispersion = 0.8 + data.currentOpenness * 1.5

            // Update particle positions with breathing effect
            const posAttr = particles.geometry.attributes.position as THREE.BufferAttribute
            const posArray = posAttr.array as Float32Array

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const i3 = i * 3
                const bx = data.basePositions[i3]
                const by = data.basePositions[i3 + 1]
                const bz = data.basePositions[i3 + 2]

                // Add subtle floating motion
                const float = Math.sin(time * 0.5 + i * 0.1) * 0.02

                posArray[i3] = bx * dispersion
                posArray[i3 + 1] = by * dispersion + float
                posArray[i3 + 2] = bz * dispersion
            }
            posAttr.needsUpdate = true

            // Gentle rotation
            particles.rotation.y += 0.002
            particles.rotation.x = Math.sin(time * 0.2) * 0.05

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
    }, [])

    // Update shape
    useEffect(() => {
        if (!sceneDataRef.current) return
        const data = sceneDataRef.current
        const newPositions = getShapePositions(shape, PARTICLE_COUNT)
        data.basePositions = newPositions

        // Animate transition
        const posAttr = data.particles.geometry.attributes.position as THREE.BufferAttribute
        const posArray = posAttr.array as Float32Array
        for (let i = 0; i < newPositions.length; i++) {
            posArray[i] = newPositions[i]
        }
        posAttr.needsUpdate = true
    }, [shape])

    // Update color
    useEffect(() => {
        if (!sceneDataRef.current) return
        const colorAttr = sceneDataRef.current.particles.geometry.attributes.color as THREE.BufferAttribute
        const colorArray = colorAttr.array as Float32Array
        const baseColor = new THREE.Color(color)

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const variation = 0.8 + Math.random() * 0.4
            colorArray[i * 3] = baseColor.r * variation
            colorArray[i * 3 + 1] = baseColor.g * variation
            colorArray[i * 3 + 2] = baseColor.b * variation
        }
        colorAttr.needsUpdate = true
    }, [color])

    // Update dispersion based on hand openness
    useEffect(() => {
        if (!sceneDataRef.current) return
        sceneDataRef.current.targetOpenness = handOpenness
    }, [handOpenness])

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 z-0"
            style={{ background: 'transparent' }}
        />
    )
}
