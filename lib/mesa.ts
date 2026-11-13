import type { HandKind, Modality, TeamIndex } from "@/lib/types"

/** El pica pica arranca cuando un equipo supera este tanteo. */
export const PICA_AFTER = 5

/** El pica pica sigue hasta que un equipo llega a este tanteo. */
export const PICA_UNTIL = 25

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const current = copy[index]
    copy[index] = copy[swap] as T
    copy[swap] = current as T
  }
  return copy
}

/** Alterna los equipos alrededor de la mesa. El siguiente asiento es a la derecha. */
export function sentar(
  teams: readonly [readonly string[], readonly string[]],
): string[] {
  const seats: string[] = []
  const count = Math.min(teams[0].length, teams[1].length)
  for (let index = 0; index < count; index += 1) {
    const left = teams[0][index]
    const right = teams[1][index]
    if (left) seats.push(left)
    if (right) seats.push(right)
  }
  return seats
}

export function mezclarAsientos(
  teams: readonly [readonly string[], readonly string[]],
): string[] {
  return sentar([shuffle(teams[0]), shuffle(teams[1])])
}

export function seatsMatchTeams(
  teams: readonly [readonly string[], readonly string[]],
  seats: readonly string[],
  dealerSeat: number,
): boolean {
  if (seats.length !== teams[0].length + teams[1].length) return false
  if (seats.length === 0) return false
  if (!Number.isInteger(dealerSeat) || dealerSeat < 0 || dealerSeat >= seats.length) {
    return false
  }
  if (new Set(seats).size !== seats.length) return false

  const teamOf = new Map<string, TeamIndex>()
  for (const id of teams[0]) teamOf.set(id, 0)
  for (const id of teams[1]) teamOf.set(id, 1)
  if (teamOf.size !== seats.length) return false

  return seats.every((id, index) => teamOf.get(id) === (index % 2 === 0 ? 0 : 1))
}

/** Del 1 al último, empezando por quien está a la derecha del que reparte. */
export function ordenDeRonda(seatCount: number, dealerSeat: number): number[] {
  const order: number[] = []
  for (let step = 1; step <= seatCount; step += 1) {
    order.push((dealerSeat + step) % seatCount)
  }
  return order
}

/** 1 vs 4, 2 vs 5 y 3 vs 6, en el orden de la ronda. */
export function parejasPicaPica(
  dealerSeat: number,
  seatCount = 6,
): [number, number][] {
  const order = ordenDeRonda(seatCount, dealerSeat)
  const half = seatCount / 2
  const pairs: [number, number][] = []
  for (let index = 0; index < half; index += 1) {
    const mano = order[index]
    const across = order[index + half]
    if (mano === undefined || across === undefined) continue
    pairs.push([mano, across])
  }
  return pairs
}

export function enPicaPica(
  modality: Modality,
  scores: readonly [number, number],
): boolean {
  if (modality !== 3) return false
  const [left, right] = scores
  if (left >= PICA_UNTIL || right >= PICA_UNTIL) return false
  return left > PICA_AFTER || right > PICA_AFTER
}

export function picaSlot(
  dealerSeat: number,
  playedThisRound: number,
  seatCount = 6,
): { pair: [number, number]; index: number } | null {
  if (playedThisRound < 0 || playedThisRound >= seatCount / 2) return null
  const pair = parejasPicaPica(dealerSeat, seatCount)[playedThisRound]
  if (!pair) return null
  return { pair, index: playedThisRound }
}

/** La mano general pasa al que está a la derecha de quien reparte. */
export function nextDealerSeat(dealerSeat: number, seatCount: number): number {
  if (seatCount <= 0) return 0
  return (dealerSeat + 1) % seatCount
}

/**
 * En la zona, pasar la mano alterna: redonda, pica pica, redonda.
 * Cada una la reparte el siguiente. En el pica pica, la mano pasa
 * recién después de las tres.
 */
export function canPassHand(inZone: boolean, hand: HandKind, step: number): boolean {
  if (!inZone || hand === "redonda") return true
  return step >= 2
}

export function nextHandKind(inZone: boolean, hand: HandKind): HandKind {
  if (inZone && hand === "redonda") return "pica"
  return "redonda"
}

export function teamOfPlayer(
  teams: readonly [readonly string[], readonly string[]],
  playerId: string,
): TeamIndex | null {
  if (teams[0].includes(playerId)) return 0
  if (teams[1].includes(playerId)) return 1
  return null
}
