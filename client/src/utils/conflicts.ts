import type { Block } from '../types'

export function getConflictIds(blocks: Block[]): Set<string> {
    const ids = new Set<string>()
    if (!blocks || blocks.length < 2) return ids

    // Sort blocks by start time
    const sorted = [...blocks].sort((a, b) =>
        new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    )

    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i]
        const currentEnd = new Date(current.end_at).getTime()

        // Check subsequent blocks for overlap
        for (let j = i + 1; j < sorted.length; j++) {
            const next = sorted[j]
            const nextStart = new Date(next.start_at).getTime()

            // Since sorted by start time, if next block starts after current ends, 
            // no subsequent blocks can overlap current (assuming proper time intervals).
            if (nextStart >= currentEnd) {
                break
            }

            // Overlap found
            ids.add(String(current.id))
            ids.add(String(next.id))
        }
    }

    return ids
}
