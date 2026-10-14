import type { TeamIndex } from "@/lib/types"

export const TARGET = 30
export const HALF = 15

export function phaseLabel(score: number): string {
  if (score <= HALF) {
    return `${score} ${score === 1 ? "MALA" : "MALAS"}`
  }

  const buenas = score - HALF
  return `${buenas} ${buenas === 1 ? "BUENA" : "BUENAS"}`
}

export function phaseText(score: number): string {
  return phaseLabel(score).toLowerCase()
}

export function splitHalves(score: number): { malas: number; buenas: number } {
  const safe = Math.min(TARGET, Math.max(0, score))
  return {
    malas: Math.min(HALF, safe),
    buenas: Math.max(0, safe - HALF),
  }
}

export function stickGroups(pointsInHalf: number): [number, number, number] {
  const points = Math.min(HALF, Math.max(0, pointsInHalf))
  return [0, 1, 2].map((index) =>
    Math.min(5, Math.max(0, points - index * 5)),
  ) as [number, number, number]
}

export function applyScoreDelta(
  scores: [number, number],
  team: TeamIndex,
  delta: 1 | -1,
): [number, number] | null {
  if (delta === 1 && (scores[0] >= TARGET || scores[1] >= TARGET)) {
    return null
  }

  const next = scores[team] + delta
  if (next < 0 || next > TARGET) return null

  const copy: [number, number] = [scores[0], scores[1]]
  copy[team] = next
  return copy
}

export function winnerOf(scores: [number, number]): TeamIndex | null {
  if (scores[0] >= TARGET) return 0
  if (scores[1] >= TARGET) return 1
  return null
}
