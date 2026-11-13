export const MODALITIES = [1, 2, 3] as const

export type Modality = (typeof MODALITIES)[number]

export type MatchStatus = "playing" | "finished" | "cancelled"

export type TeamIndex = 0 | 1

export type HandKind = "redonda" | "pica"

export type Player = {
  id: string
  name: string
}

export type SideView = {
  ids: string[]
  names: string[]
  score: number
}

export type SeatView = {
  id: string
  name: string
}

export type PicaDuelView = {
  round: number
  step: number
  playerIds: [string, string]
  winnerId: string
  points: number
}

export type TableState = {
  scores: [number, number]
  dealerSeat: number
  round: number
  hand: HandKind
  picaStep: number
  picaPica: PicaDuelView[]
}

export type TableResult = {
  state: TableState | null
  error: string | null
}

export type HeadToHeadRow = {
  players: [SeatView, SeatView]
  matchWins: [number, number]
  picaWins: [number, number]
}

export type MatchView = {
  id: string
  status: MatchStatus
  modality: Modality
  teams: [SideView, SideView]
  seats: SeatView[]
  dealerSeat: number
  round: number
  hand: HandKind
  picaStep: number
  picaPica: PicaDuelView[]
  benchNames: string[]
  winnerTeam: TeamIndex | null
  finishedAt: string | null
}

export type HistoryMatch = {
  id: string
  finishedAt: string
  teams: [SideView, SideView]
  winnerTeam: TeamIndex
  picaPoints: number
}

export type LiveMatch = {
  id: string
  teams: [SideView, SideView]
}

export type Standing = {
  playerId: string
  name: string
  played: number
  wins: number
  losses: number
}

export type ScoreResult = {
  scores: [number, number] | null
  error: string | null
}

export type PlayerFormState = { ok: true } | { error: string } | null

export function isModality(value: unknown): value is Modality {
  return value === 1 || value === 2 || value === 3
}

export function isTeamIndex(value: unknown): value is TeamIndex {
  return value === 0 || value === 1
}
