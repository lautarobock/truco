import { MongoServerError, ObjectId, type Db, type Filter } from "mongodb"
import { getDb, type MatchDoc, type PlayerDoc } from "@/lib/db"
import { nameKey, normalizeName } from "@/lib/names"
import { TARGET } from "@/lib/scoring"
import {
  isModality,
  isTeamIndex,
  type HistoryMatch,
  type LiveMatch,
  type MatchView,
  type Modality,
  type Player,
  type ScoreResult,
  type SideView,
  type Standing,
  type TeamIndex,
} from "@/lib/types"

const MAX_NAME = 40
const MAX_PLAYERS = 30

export type CreateMatchInput = {
  modality: Modality
  teams: [string[], string[]]
  bench: string[]
}

function players(db: Db) {
  return db.collection<PlayerDoc>("players")
}

function matches(db: Db) {
  return db.collection<MatchDoc>("matches")
}

function toPlayer(doc: PlayerDoc): Player {
  return { id: doc._id.toHexString(), name: doc.name }
}

async function namesById(db: Db, ids: ObjectId[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()

  const docs = await players(db)
    .find({ _id: { $in: ids } })
    .toArray()

  return new Map(docs.map((doc) => [doc._id.toHexString(), doc.name]))
}

function sideView(
  names: Map<string, string>,
  playerIds: ObjectId[],
  score: number,
): SideView {
  return {
    names: playerIds.map((id) => names.get(id.toHexString()) ?? "Jugador"),
    score,
  }
}

function collectIds(doc: MatchDoc): ObjectId[] {
  return [
    ...doc.teams[0].playerIds,
    ...doc.teams[1].playerIds,
    ...doc.bench,
  ]
}

export async function listPlayers(): Promise<Player[]> {
  const db = await getDb()
  const docs = await players(db).find().sort({ name: 1 }).toArray()
  return docs.map(toPlayer)
}

export async function createPlayer(
  rawName: string,
): Promise<{ ok: true } | { error: string }> {
  const name = normalizeName(rawName)
  if (!name) return { error: "Escribí un nombre." }
  if (name.length > MAX_NAME) return { error: "El nombre es demasiado largo." }

  const db = await getDb()
  const key = nameKey(name)
  const existing = await players(db).findOne({ nameKey: key })
  if (existing) return { error: "Ya hay un jugador con ese nombre." }

  try {
    await players(db).insertOne({
      _id: new ObjectId(),
      name,
      nameKey: key,
      createdAt: new Date(),
    })
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return { error: "Ya hay un jugador con ese nombre." }
    }
    throw error
  }

  return { ok: true }
}

function parseIdList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  if (!value.every((item) => typeof item === "string" && ObjectId.isValid(item))) {
    return null
  }
  return value
}

export async function createMatchRecord(
  input: CreateMatchInput,
): Promise<{ ok: true; id: string } | { error: string }> {
  if (!isModality(input.modality)) {
    return { error: "Elegí una modalidad." }
  }

  const left = parseIdList(input.teams?.[0])
  const right = parseIdList(input.teams?.[1])
  const bench = parseIdList(input.bench)
  if (!left || !right || !bench) {
    return { error: "Los equipos no son válidos." }
  }

  if (left.length !== input.modality || right.length !== input.modality) {
    return { error: "Los equipos no coinciden con la modalidad." }
  }

  const all = [...left, ...right, ...bench]
  if (all.length > MAX_PLAYERS) {
    return { error: "Hay demasiados jugadores." }
  }
  if (new Set(all).size !== all.length) {
    return { error: "Un jugador no puede estar en los dos equipos." }
  }

  const db = await getDb()
  const objectIds = all.map((id) => new ObjectId(id))
  const found = await players(db).countDocuments({ _id: { $in: objectIds } })
  if (found !== all.length) {
    return { error: "Hay jugadores que no existen." }
  }

  const inserted = await matches(db).insertOne({
    _id: new ObjectId(),
    status: "playing",
    modality: input.modality,
    teams: [
      { playerIds: left.map((id) => new ObjectId(id)), score: 0 },
      { playerIds: right.map((id) => new ObjectId(id)), score: 0 },
    ],
    bench: bench.map((id) => new ObjectId(id)),
    winnerTeam: null,
    createdAt: new Date(),
    finishedAt: null,
  })

  return { ok: true, id: inserted.insertedId.toHexString() }
}

export async function getMatch(id: string): Promise<MatchView | null> {
  if (!ObjectId.isValid(id)) return null

  const db = await getDb()
  const doc = await matches(db).findOne({ _id: new ObjectId(id) })
  if (!doc) return null

  const names = await namesById(db, collectIds(doc))
  return {
    id: doc._id.toHexString(),
    status: doc.status,
    modality: doc.modality,
    teams: [
      sideView(names, doc.teams[0].playerIds, doc.teams[0].score),
      sideView(names, doc.teams[1].playerIds, doc.teams[1].score),
    ],
    benchNames: doc.bench.map((id) => names.get(id.toHexString()) ?? "Jugador"),
    winnerTeam: doc.winnerTeam,
    finishedAt: doc.finishedAt?.toISOString() ?? null,
  }
}

export async function updateMatchScore(
  matchId: string,
  team: TeamIndex,
  delta: 1 | -1,
): Promise<ScoreResult> {
  if (!ObjectId.isValid(matchId) || !isTeamIndex(team) || (delta !== 1 && delta !== -1)) {
    return { scores: null, error: "No se pudo anotar." }
  }

  const db = await getDb()
  const _id = new ObjectId(matchId)
  const other: TeamIndex = team === 0 ? 1 : 0
  const filter: Filter<MatchDoc> = {
    _id,
    status: "playing",
    [`teams.${team}.score`]: delta === 1 ? { $lt: TARGET } : { $gt: 0 },
  }

  if (delta === 1) {
    filter[`teams.${other}.score`] = { $lt: TARGET }
  }

  const updated = await matches(db).findOneAndUpdate(
    filter,
    { $inc: { [`teams.${team}.score`]: delta } },
    { returnDocument: "after" },
  )

  if (updated) {
    return {
      scores: [updated.teams[0].score, updated.teams[1].score],
      error: null,
    }
  }

  const current = await matches(db).findOne({ _id })
  if (!current) return { scores: null, error: "No se encontró la partida." }

  return {
    scores: [current.teams[0].score, current.teams[1].score],
    error: current.status === "playing" ? null : "La partida ya no está en juego.",
  }
}

export async function finishMatchRecord(
  matchId: string,
): Promise<{ ok: true } | { error: string }> {
  if (!ObjectId.isValid(matchId)) {
    return { error: "No se encontró la partida." }
  }

  const db = await getDb()
  const _id = new ObjectId(matchId)
  const match = await matches(db).findOne({ _id })
  if (!match || match.status !== "playing") {
    return { error: "La partida ya no está en juego." }
  }

  const winners = ([0, 1] as const).filter(
    (index) => match.teams[index].score >= TARGET,
  )
  if (winners.length !== 1) {
    return { error: "La partida se cierra cuando un equipo llega a 30." }
  }

  const winner = winners[0]
  const result = await matches(db).updateOne(
    { _id, status: "playing" },
    {
      $set: {
        status: "finished",
        winnerTeam: winner,
        finishedAt: new Date(),
      },
    },
  )

  if (result.matchedCount === 0) {
    return { error: "La partida ya no está en juego." }
  }

  return { ok: true }
}

export async function cancelMatchRecord(
  matchId: string,
): Promise<{ ok: true } | { error: string }> {
  if (!ObjectId.isValid(matchId)) {
    return { error: "No se encontró la partida." }
  }

  const db = await getDb()
  const result = await matches(db).updateOne(
    { _id: new ObjectId(matchId), status: "playing" },
    {
      $set: {
        status: "cancelled",
        winnerTeam: null,
        finishedAt: new Date(),
      },
    },
  )

  if (result.matchedCount === 0) {
    return { error: "La partida ya no está en juego." }
  }

  return { ok: true }
}

export async function listLiveMatches(): Promise<LiveMatch[]> {
  const db = await getDb()
  const docs = await matches(db)
    .find({ status: "playing" })
    .sort({ createdAt: -1 })
    .toArray()

  const names = await namesById(
    db,
    docs.flatMap((doc) => collectIds(doc)),
  )

  return docs.map((doc) => ({
    id: doc._id.toHexString(),
    teams: [
      sideView(names, doc.teams[0].playerIds, doc.teams[0].score),
      sideView(names, doc.teams[1].playerIds, doc.teams[1].score),
    ],
  }))
}

export async function listHistory(): Promise<HistoryMatch[]> {
  const db = await getDb()
  const docs = await matches(db)
    .find({ status: "finished" })
    .sort({ finishedAt: -1 })
    .limit(100)
    .toArray()

  const names = await namesById(
    db,
    docs.flatMap((doc) => collectIds(doc)),
  )

  return docs.flatMap((doc) => {
    if (doc.winnerTeam !== 0 && doc.winnerTeam !== 1) return []
    return [
      {
        id: doc._id.toHexString(),
        finishedAt: (doc.finishedAt ?? doc.createdAt).toISOString(),
        teams: [
          sideView(names, doc.teams[0].playerIds, doc.teams[0].score),
          sideView(names, doc.teams[1].playerIds, doc.teams[1].score),
        ] as [SideView, SideView],
        winnerTeam: doc.winnerTeam,
      },
    ]
  })
}

export async function listStandings(): Promise<Standing[]> {
  const db = await getDb()
  const [roster, finished] = await Promise.all([
    players(db).find().toArray(),
    matches(db).find({ status: "finished" }).toArray(),
  ])

  const stats = new Map<string, Standing>()
  for (const player of roster) {
    stats.set(player._id.toHexString(), {
      playerId: player._id.toHexString(),
      name: player.name,
      played: 0,
      wins: 0,
      losses: 0,
    })
  }

  for (const match of finished) {
    if (match.winnerTeam !== 0 && match.winnerTeam !== 1) continue
    const loser: TeamIndex = match.winnerTeam === 0 ? 1 : 0

    for (const id of match.teams[match.winnerTeam].playerIds) {
      const row = stats.get(id.toHexString())
      if (!row) continue
      row.played += 1
      row.wins += 1
    }

    for (const id of match.teams[loser].playerIds) {
      const row = stats.get(id.toHexString())
      if (!row) continue
      row.played += 1
      row.losses += 1
    }
  }

  return [...stats.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    const rateA = a.played === 0 ? 0 : a.wins / a.played
    const rateB = b.played === 0 ? 0 : b.wins / b.played
    if (rateB !== rateA) return rateB - rateA
    return a.name.localeCompare(b.name, "es")
  })
}
