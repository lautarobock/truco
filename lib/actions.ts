"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import {
  cancelMatchRecord,
  createMatchRecord,
  createPlayer,
  finishMatchRecord,
  passHandRecord,
  scorePicaPoint,
  advancePicaStep,
  updateMatchScore,
  type CreateMatchInput,
} from "@/lib/data"
import { mongoConfigured } from "@/lib/db"
import {
  isTeamIndex,
  type PlayerFormState,
  type ScoreResult,
  type TableResult,
} from "@/lib/types"

function missingDb(): { error: string } {
  return {
    error: "Falta configurar MongoDB. Agregá MONGODB_URI y MONGODB_DB en .env.local.",
  }
}

function missingTable(): TableResult {
  return { state: null, error: missingDb().error }
}

export async function addPlayer(
  _previous: PlayerFormState,
  formData: FormData,
): Promise<PlayerFormState> {
  if (!mongoConfigured()) return missingDb()

  try {
    const result = await createPlayer(String(formData.get("name") ?? ""))
    if ("error" in result) return result
  } catch (error) {
    console.error(error)
    return { error: "No se pudo guardar el jugador." }
  }

  revalidatePath("/jugadores")
  revalidatePath("/partida/nueva")
  return { ok: true }
}

export async function startMatch(
  input: CreateMatchInput,
): Promise<{ error: string } | void> {
  if (!mongoConfigured()) return missingDb()

  let id = ""
  try {
    const result = await createMatchRecord(input)
    if ("error" in result) return result
    id = result.id
  } catch (error) {
    console.error(error)
    return { error: "No se pudo crear la partida." }
  }

  revalidatePath("/")
  redirect(`/partida/${id}`)
}

export async function scorePoint(
  matchId: string,
  team: number,
  delta: number,
): Promise<ScoreResult> {
  if (!mongoConfigured()) {
    return { scores: null, error: missingDb().error }
  }
  if (!isTeamIndex(team) || (delta !== 1 && delta !== -1)) {
    return { scores: null, error: "No se pudo anotar." }
  }

  try {
    const result = await updateMatchScore(matchId, team, delta)
    revalidatePath(`/partida/${matchId}`)
    revalidatePath("/")
    return result
  } catch (error) {
    console.error(error)
    return { scores: null, error: "No se pudo anotar el punto." }
  }
}

export async function closeMatch(matchId: string): Promise<{ error: string } | void> {
  if (!mongoConfigured()) return missingDb()

  try {
    const result = await finishMatchRecord(matchId)
    if ("error" in result) return result
  } catch (error) {
    console.error(error)
    return { error: "No se pudo cerrar la partida." }
  }

  revalidatePath("/")
  revalidatePath("/historial")
  revalidatePath("/historial/mano-a-mano")
  revalidatePath("/tabla")
  revalidatePath(`/partida/${matchId}`)
  redirect(`/partida/${matchId}`)
}

export async function passHand(matchId: string): Promise<TableResult> {
  if (!mongoConfigured()) return missingTable()

  try {
    const result = await passHandRecord(matchId)
    revalidatePath(`/partida/${matchId}`)
    return result
  } catch (error) {
    console.error(error)
    return { state: null, error: "No se pudo pasar la mano." }
  }
}

export async function scorePica(
  matchId: string,
  playerId: string,
  delta: 1 | -1,
): Promise<TableResult> {
  if (!mongoConfigured()) return missingTable()

  try {
    const result = await scorePicaPoint(matchId, playerId, delta)
    revalidatePath(`/partida/${matchId}`)
    revalidatePath("/")
    return result
  } catch (error) {
    console.error(error)
    return { state: null, error: "No se pudo anotar el punto." }
  }
}

export async function movePica(
  matchId: string,
  direction: 1 | -1,
): Promise<TableResult> {
  if (!mongoConfigured()) return missingTable()

  try {
    const result = await advancePicaStep(matchId, direction)
    revalidatePath(`/partida/${matchId}`)
    return result
  } catch (error) {
    console.error(error)
    return { state: null, error: "No se pudo cambiar de mano." }
  }
}

export async function voidMatch(matchId: string): Promise<{ error: string } | void> {
  if (!mongoConfigured()) return missingDb()

  try {
    const result = await cancelMatchRecord(matchId)
    if ("error" in result) return result
  } catch (error) {
    console.error(error)
    return { error: "No se pudo anular la partida." }
  }

  revalidatePath("/")
  revalidatePath(`/partida/${matchId}`)
  redirect(`/partida/${matchId}`)
}
