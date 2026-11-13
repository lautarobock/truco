import { MongoServerError, ObjectId, type Db, type Filter } from "mongodb"
import { getDb, type MatchDoc, type PicaDuelDoc, type PlayerDoc } from "@/lib/db"
import {
  canPassHand,
  enPicaPica,
  nextDealerSeat,
  nextHandKind,
  picaSlot,
  seatsMatchTeams,
  teamOfPlayer,
} from "@/lib/mesa"
import { nameKey, normalizeName } from "@/lib/names"
import { TARGET } from "@/lib/scoring"
import {
  isModality,
  isTeamIndex,
  type HandKind,
  type HeadToHeadRow,
  type HistoryMatch,
  type LiveMatch,
  type MatchView,
  type Modality,
  type PicaDuelView,
  type Player,
  type ScoreResult,
  type SeatView,
  type SideView,
  type Standing,
  type TableResult,
  type TableState,
  type TeamIndex,
} from "@/lib/types"

const MAX_NAME = 40
const MAX_PLAYERS = 30

export type CreateMatchInput = {
  modality: Modality
  teams: [string[], string[]]
  bench: string[]
  seats: string[]
  dealerSeat: number
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
    ids: playerIds.map((id) => id.toHexString()),
    names: playerIds.map((id) => names.get(id.toHexString()) ?? "Jugador"),
    score,
  }
}

function seatIdsOf(doc: MatchDoc): ObjectId[] {
  if (doc.seats && doc.seats.length === doc.modality * 2) return doc.seats

  const seats: ObjectId[] = []
  for (let index = 0; index < doc.modality; index += 1) {
    const left = doc.teams[0].playerIds[index]
    const right = doc.teams[1].playerIds[index]
    if (left) seats.push(left)
    if (right) seats.push(right)
  }
  return seats
}

function handOf(doc: MatchDoc): HandKind {
  return doc.hand === "pica" ? "pica" : "redonda"
}

function dealerOf(doc: MatchDoc, seatCount: number): number {
  if (
    typeof doc.dealerSeat === "number" &&
    doc.dealerSeat >= 0 &&
    doc.dealerSeat < seatCount
  ) {
    return doc.dealerSeat
  }
  return Math.max(0, seatCount - 1)
}

function picaViews(doc: MatchDoc): PicaDuelView[] {
  return (doc.picaPica ?? []).map((duel) => ({
    round: duel.round,
    step: duel.step ?? 0,
    playerIds: [duel.playerIds[0].toHexString(), duel.playerIds[1].toHexString()],
    winnerId: duel.winnerId.toHexString(),
    points: duel.points,
  }))
}

function tableState(doc: MatchDoc): TableState {
  const seatCount = seatIdsOf(doc).length
  return {
    scores: [doc.teams[0].score, doc.teams[1].score],
    dealerSeat: dealerOf(doc, seatCount),
    round: doc.round ?? 0,
    hand: handOf(doc),
    picaStep: doc.picaStep ?? 0,
    picaPica: picaViews(doc),
  }
}

function seatViews(names: Map<string, string>, doc: MatchDoc): SeatView[] {
  return seatIdsOf(doc).map((id) => ({
    id: id.toHexString(),
    name: names.get(id.toHexString()) ?? "Jugador",
  }))
}

function teamIds(doc: MatchDoc): [string[], string[]] {
  return [
    doc.teams[0].playerIds.map((id) => id.toHexString()),
    doc.teams[1].playerIds.map((id) => id.toHexString()),
  ]
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
  if (!seatsMatchTeams([left, right], input.seats, input.dealerSeat)) {
    return { error: "La mesa no coincide con los equipos." }
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
    seats: input.seats.map((id) => new ObjectId(id)),
    dealerSeat: input.dealerSeat,
    round: 0,
    hand: "redonda",
    picaStep: 0,
    picaPica: [],
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
    seats: seatViews(names, doc),
    dealerSeat: dealerOf(doc, seatIdsOf(doc).length),
    round: doc.round ?? 0,
    hand: handOf(doc),
    picaStep: doc.picaStep ?? 0,
    picaPica: picaViews(doc),
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
  const current = await matches(db).findOne({ _id })
  if (!current) return { scores: null, error: "No se encontró la partida." }

  const currentScores: [number, number] = [
    current.teams[0].score,
    current.teams[1].score,
  ]
  if (current.status !== "playing") {
    return { scores: currentScores, error: "La partida ya no está en juego." }
  }
  if (enPicaPica(current.modality, currentScores) && handOf(current) === "pica") {
    return {
      scores: currentScores,
      error: "En el pica pica el punto se anota en el jugador.",
    }
  }

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

  const latest = await matches(db).findOne({ _id })
  if (!latest) return { scores: null, error: "No se encontró la partida." }

  return {
    scores: [latest.teams[0].score, latest.teams[1].score],
    error: latest.status === "playing" ? null : "La partida ya no está en juego.",
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
        picaPoints: (doc.picaPica ?? []).reduce((sum, duel) => sum + duel.points, 0),
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

function freshTable(message: string): TableResult {
  return { state: null, error: message }
}

async function playingMatch(
  matchId: string,
): Promise<{ db: Db; doc: MatchDoc } | { error: string }> {
  if (!ObjectId.isValid(matchId)) return { error: "No se encontró la partida." }
  const db = await getDb()
  const doc = await matches(db).findOne({ _id: new ObjectId(matchId) })
  if (!doc) return { error: "No se encontró la partida." }
  if (doc.status !== "playing") return { error: "La partida ya no está en juego." }
  return { db, doc }
}

export async function passHandRecord(matchId: string): Promise<TableResult> {
  const loaded = await playingMatch(matchId)
  if ("error" in loaded) return freshTable(loaded.error)

  const { db, doc } = loaded
  const seats = seatIdsOf(doc)
  if (seats.length === 0) return freshTable("La mesa no tiene jugadores.")

  const round = doc.round ?? 0
  const step = doc.picaStep ?? 0
  const hand = handOf(doc)
  const scores: [number, number] = [doc.teams[0].score, doc.teams[1].score]
  const inZone = enPicaPica(doc.modality, scores)
  if (!canPassHand(inZone, hand, step)) {
    return freshTable("Todavía faltan manos del pica pica.")
  }

  const dealer = dealerOf(doc, seats.length)
  const updated = await matches(db).findOneAndUpdate(
    {
      _id: doc._id,
      status: "playing",
      "teams.0.score": scores[0],
      "teams.1.score": scores[1],
      ...(typeof doc.round === "number" ? { round: doc.round } : { round: { $exists: false } }),
    },
    {
      $set: {
        seats,
        dealerSeat: nextDealerSeat(dealer, seats.length),
        round: round + 1,
        hand: nextHandKind(inZone, hand),
        picaStep: 0,
      },
    },
    { returnDocument: "after" },
  )

  if (!updated) return freshTable("La mesa cambió. Probá de nuevo.")
  return { state: tableState(updated), error: null }
}

export async function scorePicaPoint(
  matchId: string,
  playerId: string,
  delta: 1 | -1,
): Promise<TableResult> {
  if (!ObjectId.isValid(playerId) || (delta !== 1 && delta !== -1)) {
    return freshTable("No se pudo anotar el punto.")
  }

  const loaded = await playingMatch(matchId)
  if ("error" in loaded) return freshTable(loaded.error)
  const { db, doc } = loaded

  if (doc.modality !== 3) return freshTable("El pica pica es solo en 3 vs 3.")

  const scores: [number, number] = [doc.teams[0].score, doc.teams[1].score]
  if (!enPicaPica(doc.modality, scores)) return freshTable("Ahora no se juega pica pica.")
  if (handOf(doc) !== "pica") return freshTable("Ahora se juega la mano redonda.")

  const seats = seatIdsOf(doc)
  const seatKeys = seats.map((id) => id.toHexString())
  const dealer = dealerOf(doc, seats.length)
  const round = doc.round ?? 0
  const step = doc.picaStep ?? 0
  const slot = picaSlot(dealer, step, seats.length)
  if (!slot) return freshTable("Pasá el reparto para la próxima ronda.")

  const pairIds: [string, string] = [seatKeys[slot.pair[0]] ?? "", seatKeys[slot.pair[1]] ?? ""]
  if (playerId !== pairIds[0] && playerId !== pairIds[1]) {
    return freshTable("Ese jugador no está en esta mano.")
  }

  const team = teamOfPlayer(teamIds(doc), playerId)
  if (team === null) return freshTable("No se pudo anotar el punto.")

  const duels = doc.picaPica ?? []
  const sameMano = (duel: PicaDuelDoc) => {
    if (duel.round !== round || (duel.step ?? 0) !== step) return false
    const first = duel.playerIds[0].toHexString()
    const second = duel.playerIds[1].toHexString()
    return (
      (first === pairIds[0] && second === pairIds[1]) ||
      (first === pairIds[1] && second === pairIds[0])
    )
  }

  if (delta === 1) {
    if (scores[team] >= TARGET) return freshTable("Ese equipo ya llegó a 30.")
    const duel: PicaDuelDoc = {
      round,
      step,
      playerIds: [new ObjectId(pairIds[0]), new ObjectId(pairIds[1])],
      winnerId: new ObjectId(playerId),
      points: 1,
    }
    const updated = await matches(db).findOneAndUpdate(
      {
        _id: doc._id,
        status: "playing",
        [`teams.${team}.score`]: { $lt: TARGET },
      },
      {
        $inc: { [`teams.${team}.score`]: 1 },
        $push: { picaPica: duel },
        $set: { seats, dealerSeat: dealer, round, picaStep: step },
      },
      { returnDocument: "after" },
    )
    if (!updated) return freshTable("No se pudo anotar el punto.")
    return { state: tableState(updated), error: null }
  }

  let index = -1
  for (let cursor = duels.length - 1; cursor >= 0; cursor -= 1) {
    const duel = duels[cursor]
    if (!duel || duel.points < 1 || !sameMano(duel) || duel.winnerId.toHexString() !== playerId) {
      continue
    }
    index = cursor
    break
  }
  if (index < 0) return freshTable("Ese jugador no tiene puntos en esta mano.")

  const current = duels[index]
  if (!current) return freshTable("No se pudo restar el punto.")

  const updated = await matches(db).findOneAndUpdate(
    {
      _id: doc._id,
      status: "playing",
      [`teams.${team}.score`]: { $gte: 1 },
      [`picaPica.${index}.winnerId`]: current.winnerId,
      [`picaPica.${index}.points`]: { $gte: 1 },
    },
    {
      $inc: {
        [`teams.${team}.score`]: -1,
        [`picaPica.${index}.points`]: -1,
      },
    },
    { returnDocument: "after" },
  )

  if (!updated) return freshTable("La mesa cambió. Probá de nuevo.")
  return { state: tableState(updated), error: null }
}

export async function advancePicaStep(
  matchId: string,
  direction: 1 | -1,
): Promise<TableResult> {
  if (direction !== 1 && direction !== -1) return freshTable("No se pudo cambiar de mano.")

  const loaded = await playingMatch(matchId)
  if ("error" in loaded) return freshTable(loaded.error)
  const { db, doc } = loaded

  const scores: [number, number] = [doc.teams[0].score, doc.teams[1].score]
  if (!enPicaPica(doc.modality, scores)) return freshTable("Ahora no se juega pica pica.")
  if (handOf(doc) !== "pica") return freshTable("Ahora se juega la mano redonda.")

  const step = doc.picaStep ?? 0
  const next = step + direction
  if (next < 0 || next > 2) return freshTable("No hay otra mano en esta ronda.")

  if (direction === -1) {
    const round = doc.round ?? 0
    const pending = (doc.picaPica ?? []).some(
      (duel) => duel.round === round && (duel.step ?? 0) === step && duel.points > 0,
    )
    if (pending) return freshTable("Esta mano ya tiene puntos.")
  }

  const updated = await matches(db).findOneAndUpdate(
    {
      _id: doc._id,
      status: "playing",
      ...(typeof doc.picaStep === "number"
        ? { picaStep: doc.picaStep }
        : { picaStep: { $exists: false } }),
    },
    { $set: { picaStep: next } },
    { returnDocument: "after" },
  )

  if (!updated) return freshTable("La mesa cambió. Probá de nuevo.")
  return { state: tableState(updated), error: null }
}

export async function listHeadToHead(): Promise<HeadToHeadRow[]> {
  const db = await getDb()
  const finished = await matches(db).find({ status: "finished" }).toArray()

  type Bucket = {
    a: string
    b: string
    matchWins: [number, number]
    picaWins: [number, number]
  }
  const buckets = new Map<string, Bucket>()

  function take(leftId: string, rightId: string): { bucket: Bucket; slot: 0 | 1 } | null {
    if (!leftId || !rightId || leftId === rightId) return null
    const [a, b] = leftId < rightId ? [leftId, rightId] : [rightId, leftId]
    const key = `${a}:${b}`
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { a, b, matchWins: [0, 0], picaWins: [0, 0] }
      buckets.set(key, bucket)
    }
    return { bucket, slot: leftId === a ? 0 : 1 }
  }

  const ids: ObjectId[] = []
  for (const match of finished) {
    if (match.winnerTeam !== 0 && match.winnerTeam !== 1) continue
    const winner = match.teams[match.winnerTeam].playerIds
    const loser = match.teams[match.winnerTeam === 0 ? 1 : 0].playerIds
    ids.push(...winner, ...loser)

    for (const winnerId of winner) {
      for (const loserId of loser) {
        const pair = take(winnerId.toHexString(), loserId.toHexString())
        if (!pair) continue
        pair.bucket.matchWins[pair.slot] += 1
      }
    }

    for (const duel of match.picaPica ?? []) {
      const [first, second] = duel.playerIds
      const winnerId = duel.winnerId.toHexString()
      const other = first.toHexString() === winnerId ? second.toHexString() : first.toHexString()
      if (winnerId !== first.toHexString() && winnerId !== second.toHexString()) continue
      const pair = take(winnerId, other)
      if (!pair) continue
      pair.bucket.picaWins[pair.slot] += duel.points
      ids.push(first, second)
    }
  }

  const names = await namesById(db, ids)
  const rows: HeadToHeadRow[] = [...buckets.values()].map((bucket) => {
    const left = { id: bucket.a, name: names.get(bucket.a) ?? "Jugador" }
    const right = { id: bucket.b, name: names.get(bucket.b) ?? "Jugador" }
    const swap = left.name.localeCompare(right.name, "es") > 0
    return {
      players: swap ? [right, left] : [left, right],
      matchWins: swap
        ? [bucket.matchWins[1], bucket.matchWins[0]]
        : bucket.matchWins,
      picaWins: swap ? [bucket.picaWins[1], bucket.picaWins[0]] : bucket.picaWins,
    }
  })

  return rows.sort((a, b) => {
    const matchesA = a.matchWins[0] + a.matchWins[1]
    const matchesB = b.matchWins[0] + b.matchWins[1]
    if (matchesB !== matchesA) return matchesB - matchesA
    const picaA = a.picaWins[0] + a.picaWins[1]
    const picaB = b.picaWins[0] + b.picaWins[1]
    if (picaB !== picaA) return picaB - picaA
    return a.players[0].name.localeCompare(b.players[0].name, "es")
  })
}
