export const MODALITIES = [1, 2, 3] as const

export type Modality = (typeof MODALITIES)[number]

export type MatchStatus = "playing" | "finished" | "cancelled"

export type TeamIndex = 0 | 1

export type Player = {
  id: string
  name: string
}

export type SideView = {
  names: string[]
  score: number
}

export type MatchView = {
  id: string
  status: MatchStatus
  modality: Modality
  teams: [SideView, SideView]
  benchNames: string[]
  winnerTeam: TeamIndex | null
  finishedAt: string | null
}

export type HistoryMatch = {
  id: string
  finishedAt: string
  teams: [SideView, SideView]
  winnerTeam: TeamIndex
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
