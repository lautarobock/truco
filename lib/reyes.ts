import { sentar, shuffle } from "@/lib/mesa"
import type { Modality } from "@/lib/types"

export type Draw = {
  teams: [string[], string[]]
  bench: string[]
  seats: string[]
}

export function tirarReyes(
  playerIds: readonly string[],
  modality: Modality,
): Draw {
  const shuffled = shuffle(playerIds)
  const teams: [string[], string[]] = [
    shuffled.slice(0, modality),
    shuffled.slice(modality, modality * 2),
  ]

  return {
    teams,
    bench: shuffled.slice(modality * 2),
    seats: sentar(teams),
  }
}
