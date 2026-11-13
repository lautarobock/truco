"use client"

import Link from "next/link"
import { useRef, useState, useTransition, type PointerEvent } from "react"
import { Fosforos } from "@/components/Fosforos"
import { ManoAManoPartida, PicaPica } from "@/components/PicaPica"
import { Ronda } from "@/components/Ronda"
import { buttonPrimary, buttonSecondary } from "@/components/ui"
import { closeMatch, movePica, passHand, scorePica, scorePoint, voidMatch } from "@/lib/actions"
import { enPicaPica, nextHandKind, ordenDeRonda, picaSlot, teamOfPlayer } from "@/lib/mesa"
import { joinNames } from "@/lib/names"
import { applyScoreDelta, phaseLabel, winnerOf } from "@/lib/scoring"
import type {
  HandKind,
  Modality,
  PicaDuelView,
  SeatView,
  SideView,
  TableState,
  TeamIndex,
} from "@/lib/types"

const DRAG_STEP = 36

export function Tanteador({
  matchId,
  teams,
  benchNames,
  seats,
  dealerSeat: initialDealer,
  round: initialRound,
  hand: initialHand,
  picaStep: initialStep,
  picaPica,
  modality,
}: {
  matchId: string
  teams: [SideView, SideView]
  benchNames: string[]
  seats: SeatView[]
  dealerSeat: number
  round: number
  hand: HandKind
  picaStep: number
  picaPica: PicaDuelView[]
  modality: Modality
}) {
  const initial: [number, number] = [teams[0].score, teams[1].score]
  const [scores, setScores] = useState(initial)
  const scoresRef = useRef(initial)
  const confirmed = useRef(initial)
  const duelsRef = useRef(picaPica)
  const confirmedDuels = useRef(picaPica)
  const pendingScores = useRef(0)
  const tableLock = useRef(false)
  const [dealerSeat, setDealerSeat] = useState(initialDealer)
  const [round, setRound] = useState(initialRound)
  const [hand, setHand] = useState(initialHand)
  const [picaStep, setPicaStep] = useState(initialStep)
  const [duels, setDuels] = useState(picaPica)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [scoreBusy, setScoreBusy] = useState(false)
  const [actionPending, startAction] = useTransition()
  const [, startScore] = useTransition()
  const [tablePending, startTable] = useTransition()

  const winner = winnerOf(scores)
  const inZone = enPicaPica(modality, scores) && winner === null
  const inPica = inZone && hand === "pica"
  const roundDuels = duels.filter((duel) => duel.round === round)
  const slot = inPica ? picaSlot(dealerSeat, picaStep, seats.length) : null
  const currentManoPoints = roundDuels
    .filter((duel) => duel.step === picaStep)
    .reduce((sum, duel) => sum + duel.points, 0)

  const swipe = useRef<{
    originY: number
    anchorY: number
    pointerId: number
  } | null>(null)
  const ignoreClick = useRef(false)

  function applyTable(state: TableState) {
    scoresRef.current = state.scores
    confirmed.current = state.scores
    duelsRef.current = state.picaPica
    confirmedDuels.current = state.picaPica
    setScores(state.scores)
    setDealerSeat(state.dealerSeat)
    setRound(state.round)
    setHand(state.hand)
    setPicaStep(state.picaStep)
    setDuels(state.picaPica)
  }

  function change(team: TeamIndex, delta: 1 | -1) {
    if (tableLock.current || inPica) return
    const next = applyScoreDelta(scoresRef.current, team, delta)
    if (!next) return

    scoresRef.current = next
    setScores(next)
    setError(null)
    pendingScores.current += 1
    setScoreBusy(true)

    startScore(async () => {
      const result = await scorePoint(matchId, team, delta)
      pendingScores.current -= 1
      if (result.scores) confirmed.current = result.scores
      if (pendingScores.current === 0) {
        const settled = result.scores ?? confirmed.current
        scoresRef.current = settled
        setScores(settled)
        setError(result.error)
        setScoreBusy(false)
      }
    })
  }

  function rememberSwipe(event: PointerEvent<HTMLDivElement>) {
    if (actionPending || inPica) return
    if (event.pointerType === "mouse" && event.button !== 0) return
    swipe.current = {
      originY: event.clientY,
      anchorY: event.clientY,
      pointerId: event.pointerId,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Some browsers reject capture if the pointer is already gone.
    }
  }

  function moveSwipe(event: PointerEvent<HTMLDivElement>, side: TeamIndex) {
    const drag = swipe.current
    if (!drag || drag.pointerId !== event.pointerId || actionPending || inPica) return

    if (Math.abs(event.clientY - drag.originY) > 10) ignoreClick.current = true

    const steps = Math.trunc((event.clientY - drag.anchorY) / DRAG_STEP)
    if (steps === 0) return

    drag.anchorY += steps * DRAG_STEP
    const delta: 1 | -1 = steps > 0 ? 1 : -1
    for (let index = 0; index < Math.abs(steps); index += 1) {
      change(side, delta)
    }
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    if (swipe.current?.pointerId === event.pointerId) swipe.current = null
  }

  function pass() {
    if (winner !== null || tableLock.current || pendingScores.current > 0) return
    if (inZone && hand === "pica" && picaStep < 2) return
    const next = ordenDeRonda(seats.length, dealerSeat)[0]
    if (next === undefined) return
    const snapshot = { dealerSeat, round, hand, picaStep }
    tableLock.current = true
    setDealerSeat(next)
    setRound((current) => current + 1)
    setHand(nextHandKind(inZone, hand))
    setPicaStep(0)
    setError(null)

    startTable(async () => {
      try {
        const result = await passHand(matchId)
        if (result.state) applyTable(result.state)
        else {
          setDealerSeat(snapshot.dealerSeat)
          setRound(snapshot.round)
          setHand(snapshot.hand)
          setPicaStep(snapshot.picaStep)
        }
        setError(result.error)
      } finally {
        tableLock.current = false
      }
    })
  }

  function scorePlayer(playerId: string, delta: 1 | -1) {
    if (!slot || tableLock.current || winner !== null) return
    const team = teamOfPlayer([teams[0].ids, teams[1].ids], playerId)
    if (team === null) return
    const next = applyScoreDelta(scoresRef.current, team, delta)
    if (!next) return

    const pairIds: [string, string] = [
      seats[slot.pair[0]]?.id ?? "",
      seats[slot.pair[1]]?.id ?? "",
    ]
    const currentDuels = duelsRef.current
    let nextDuels: PicaDuelView[]
    if (delta === 1) {
      nextDuels = [
        ...currentDuels,
        { round, step: picaStep, playerIds: pairIds, winnerId: playerId, points: 1 },
      ]
    } else {
      const copy = [...currentDuels]
      let index = -1
      for (let cursor = copy.length - 1; cursor >= 0; cursor -= 1) {
        const duel = copy[cursor]
        if (!duel || duel.round !== round || duel.step !== picaStep || duel.winnerId !== playerId) {
          continue
        }
        index = cursor
        break
      }
      const found = index >= 0 ? copy[index] : undefined
      if (!found) return
      if (found.points > 1) copy[index] = { ...found, points: found.points - 1 }
      else copy.splice(index, 1)
      nextDuels = copy
    }

    scoresRef.current = next
    duelsRef.current = nextDuels
    setScores(next)
    setDuels(nextDuels)
    setError(null)
    pendingScores.current += 1
    setScoreBusy(true)

    startScore(async () => {
      const result = await scorePica(matchId, playerId, delta)
      pendingScores.current -= 1
      if (result.state) {
        confirmed.current = result.state.scores
        confirmedDuels.current = result.state.picaPica
      }
      if (pendingScores.current === 0) {
        if (result.state) applyTable(result.state)
        else {
          scoresRef.current = confirmed.current
          duelsRef.current = confirmedDuels.current
          setScores(confirmed.current)
          setDuels(confirmedDuels.current)
        }
        setError(result.error)
        setScoreBusy(false)
      }
    })
  }

  function shiftMano(direction: 1 | -1) {
    if (tableLock.current || pendingScores.current > 0 || !inPica) return
    const snapshot = picaStep
    tableLock.current = true
    setPicaStep((current) => current + direction)
    setError(null)

    startTable(async () => {
      try {
        const result = await movePica(matchId, direction)
        if (result.state) applyTable(result.state)
        else setPicaStep(snapshot)
        setError(result.error)
      } finally {
        tableLock.current = false
      }
    })
  }

  function finish() {
    startAction(async () => {
      const result = await closeMatch(matchId)
      if (result?.error) setError(result.error)
    })
  }

  function cancel() {
    startAction(async () => {
      const result = await voidMatch(matchId)
      if (result?.error) setError(result.error)
    })
  }

  const busy = actionPending || tablePending || scoreBusy
  const nextName = seats[ordenDeRonda(seats.length, dealerSeat)[0] ?? -1]?.name

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col">
      <header className="grid shrink-0 grid-cols-3 items-center px-4 py-3">
        <Link href="/" className="text-sm text-cream/80">
          Inicio
        </Link>
        <p className="text-center font-display text-xl font-semibold">Truco</p>
        <button
          type="button"
          onClick={() => setConfirmCancel(true)}
          className="cursor-pointer text-right text-sm text-cream/80"
        >
          Anular
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2">
        {benchNames.length > 0 ? (
          <p className="shrink-0 px-4 text-center text-sm text-cream/70">
            Afuera: {joinNames(benchNames)}
          </p>
        ) : null}

        <div className="grid shrink-0 grid-cols-2 gap-2 px-3">
          {teams.map((team, index) => {
            const score = scores[index as TeamIndex]
            const inMalas = score <= 15
            return (
              <div key={team.ids.join("-")}>
                <ul className="rounded-t-2xl bg-banner px-2 py-2 text-center text-sm leading-tight font-semibold text-ink">
                  {team.names.map((name, nameIndex) => (
                    <li key={team.ids[nameIndex] ?? name}>{name}</li>
                  ))}
                </ul>
                <p
                  aria-live="polite"
                  className={`rounded-b-2xl py-1 text-center font-display text-xl font-semibold tabular-nums ${
                    inMalas ? "bg-malas text-cream" : "bg-buenas text-ink"
                  } ${score >= 30 ? "ring-2 ring-cream" : ""}`}
                >
                  {phaseLabel(score)}
                </p>
              </div>
            )
          })}
        </div>

        <div className="shrink-0 px-3">
          <p className="mb-1 text-center text-sm text-cream/70">
            {inPica
              ? "Pica pica. Al pasar la mano, el siguiente reparte la redonda."
              : inZone
                ? "Mano redonda. Al pasar la mano, el siguiente reparte el pica pica."
                : "El 1 es la mano, a la derecha de quien reparte."}
          </p>
          <Ronda seats={seats} dealerSeat={dealerSeat} />
        </div>

        {inPica ? (
          <PicaPica
            seats={seats}
            dealerSeat={dealerSeat}
            step={picaStep}
            roundDuels={roundDuels}
          />
        ) : null}

        <div className={`grid min-h-48 flex-1 grid-cols-2 gap-3 px-3 ${inPica ? "pointer-events-none" : ""}`}>
          {teams.map((team, index) => {
            const side = index as TeamIndex
            const label = joinNames(team.names)
            return (
              <div
                key={team.ids.join("-")}
                role={inPica ? undefined : "button"}
                tabIndex={inPica || winner !== null || actionPending ? -1 : 0}
                aria-disabled={inPica || winner !== null || actionPending}
                onPointerDown={inPica ? undefined : rememberSwipe}
                onPointerMove={inPica ? undefined : (event) => moveSwipe(event, side)}
                onPointerUp={inPica ? undefined : finishSwipe}
                onPointerCancel={() => {
                  swipe.current = null
                }}
                onClick={
                  inPica
                    ? undefined
                    : () => {
                        if (ignoreClick.current) {
                          ignoreClick.current = false
                          return
                        }
                        change(side, 1)
                      }
                }
                onKeyDown={
                  inPica
                    ? undefined
                    : (event) => {
                        if (event.key !== "Enter" && event.key !== " ") return
                        event.preventDefault()
                        change(side, 1)
                      }
                }
                aria-label={
                  inPica
                    ? `Tanteador de ${label}`
                    : `Sumar un punto a ${label}. Deslizá hacia arriba para restar.`
                }
                className={`h-full min-h-0 rounded-2xl ${inPica ? "" : "cursor-pointer touch-none active:bg-black/10"}`}
              >
                <Fosforos score={scores[side]} />
              </div>
            )
          })}
        </div>

        {modality === 3 ? <ManoAManoPartida seats={seats} duels={duels} /> : null}
      </div>

      {error ? (
        <p className="shrink-0 px-4 pb-2 text-center text-sm text-cream">{error}</p>
      ) : null}

      {confirmCancel ? (
        <div className="mx-3 mb-2 shrink-0 rounded-2xl bg-black/30 p-3 text-center">
          <p className="text-sm leading-relaxed">
            ¿Anular esta partida? No va a contar en la tabla.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={actionPending}
              className={buttonPrimary}
            >
              Sí, anular
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              disabled={actionPending}
              className={buttonSecondary}
            >
              Seguir
            </button>
          </div>
        </div>
      ) : null}

      {winner !== null ? (
        <div className="mx-3 mb-2 shrink-0 rounded-2xl bg-banner p-3 text-center text-ink">
          <p className="font-display text-xl font-semibold">
            Ganó {joinNames(teams[winner].names)}
          </p>
          <button
            type="button"
            onClick={finish}
            disabled={actionPending}
            className={`${buttonPrimary} mt-3 bg-malas text-cream`}
          >
            Cerrar partida
          </button>
        </div>
      ) : null}

      <div className="shrink-0 px-3 pt-1 pb-4">
        {inPica && slot ? (
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              {([0, 1] as const).map((side) => {
                const playerId = [seats[slot.pair[0]]?.id, seats[slot.pair[1]]?.id].find((id) =>
                  id ? teams[side].ids.includes(id) : false,
                )
                const name = seats.find((seat) => seat.id === playerId)?.name ?? "Jugador"
                const playerPoints = roundDuels
                  .filter((duel) => duel.step === picaStep && duel.winnerId === playerId)
                  .reduce((sum, duel) => sum + duel.points, 0)
                return (
                  <div key={side} className="grid gap-1">
                    <p className="truncate text-center text-sm font-semibold">{name}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (playerId) scorePlayer(playerId, -1)
                        }}
                        disabled={actionPending || tablePending || !playerId || playerPoints === 0}
                        aria-label={`Restar un punto a ${name}`}
                        className={`${buttonSecondary} text-3xl`}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (playerId) scorePlayer(playerId, 1)
                        }}
                        disabled={actionPending || tablePending || !playerId}
                        aria-label={`Sumar un punto a ${name}`}
                        className={`${buttonPrimary} text-3xl`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-center text-sm text-cream/70">
              Los puntos entran en el tanteador de arriba.
            </p>
            {picaStep < 2 ? (
              <button
                type="button"
                onClick={() => shiftMano(1)}
                disabled={busy}
                className={buttonPrimary}
              >
                Siguiente mano
              </button>
            ) : (
              <button type="button" onClick={pass} disabled={busy} className={buttonPrimary}>
                Pasar mano{nextName ? ` a ${nextName}` : ""}
              </button>
            )}
            {picaStep > 0 && currentManoPoints === 0 ? (
              <button
                type="button"
                onClick={() => shiftMano(-1)}
                disabled={busy}
                className="cursor-pointer py-1 text-sm text-cream/80 disabled:opacity-40"
              >
                Mano anterior
              </button>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {teams.map((team, index) => {
              const side = index as TeamIndex
              const label = joinNames(team.names)
              const blocked = winner !== null
              return (
                <div key={team.ids.join("-")} className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => change(side, -1)}
                    disabled={scores[side] === 0 || actionPending}
                    aria-label={`Restar un punto a ${label}`}
                    className={`${buttonSecondary} text-3xl`}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => change(side, 1)}
                    disabled={blocked || actionPending}
                    aria-label={`Sumar un punto a ${label}`}
                    className={`${buttonPrimary} text-3xl`}
                  >
                    +
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {winner === null && !inPica ? (
          <button type="button" onClick={pass} disabled={busy} className={`${buttonSecondary} mt-2`}>
            Pasar mano{nextName ? ` a ${nextName}` : ""}
          </button>
        ) : null}
      </div>
    </div>
  )
}
