import type { Modality } from "@/lib/types"

export type Draw = {
  teams: [string[], string[]]
  bench: string[]
}

export function tirarReyes(
  playerIds: readonly string[],
  modality: Modality,
): Draw {
  const shuffled = [...playerIds]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = shuffled[index]
    shuffled[index] = shuffled[swap]
    shuffled[swap] = current
  }

  return {
    teams: [
      shuffled.slice(0, modality),
      shuffled.slice(modality, modality * 2),
    ],
    bench: shuffled.slice(modality * 2),
  }
}
