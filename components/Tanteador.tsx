"use client"

import Link from "next/link"
import { useRef, useState, useTransition, type PointerEvent } from "react"
import { Fosforos } from "@/components/Fosforos"
import { buttonPrimary, buttonSecondary } from "@/components/ui"
import { closeMatch, scorePoint, voidMatch } from "@/lib/actions"
import { joinNames } from "@/lib/names"
import { applyScoreDelta, phaseLabel, winnerOf } from "@/lib/scoring"
import type { SideView, TeamIndex } from "@/lib/types"

const DRAG_STEP = 36

export function Tanteador({
  matchId,
  teams,
  benchNames,
}: {
  matchId: string
  teams: [SideView, SideView]
  benchNames: string[]
}) {
  const initial: [number, number] = [teams[0].score, teams[1].score]
  const [scores, setScores] = useState(initial)
  const scoresRef = useRef(initial)
  const confirmed = useRef(initial)
  const pendingScores = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [actionPending, startAction] = useTransition()
  const [, startScore] = useTransition()

  const winner = winnerOf(scores)
  const swipe = useRef<{
    originY: number
    anchorY: number
    pointerId: number
  } | null>(null)
  const ignoreClick = useRef(false)

  function change(team: TeamIndex, delta: 1 | -1) {
    const next = applyScoreDelta(scoresRef.current, team, delta)
    if (!next) return

    scoresRef.current = next
    setScores(next)
    setError(null)
    pendingScores.current += 1

    startScore(async () => {
      const result = await scorePoint(matchId, team, delta)
      pendingScores.current -= 1
      if (result.scores) confirmed.current = result.scores
      if (pendingScores.current === 0) {
        const next = result.scores ?? confirmed.current
        scoresRef.current = next
        setScores(next)
        setError(result.error)
      }
    })
  }

  function rememberSwipe(event: PointerEvent<HTMLDivElement>) {
    if (actionPending) return
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
    if (!drag || drag.pointerId !== event.pointerId || actionPending) return

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

      {benchNames.length > 0 ? (
        <p className="shrink-0 px-4 pb-2 text-center text-sm text-cream/70">
          Afuera: {joinNames(benchNames)}
        </p>
      ) : null}

      <div className="grid shrink-0 grid-cols-2 gap-2 px-3">
        {teams.map((team, index) => {
          const score = scores[index as TeamIndex]
          const inMalas = score <= 15
          return (
            <div key={team.names.join("-")}>
              <ul className="rounded-t-2xl bg-banner px-2 py-2 text-center text-sm leading-tight font-semibold text-ink">
                {team.names.map((name) => (
                  <li key={name}>{name}</li>
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

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 px-3 py-2">
        {teams.map((team, index) => {
          const side = index as TeamIndex
          const label = joinNames(team.names)
          return (
            <div
              key={label}
              role="button"
              tabIndex={winner !== null || actionPending ? -1 : 0}
              aria-disabled={winner !== null || actionPending}
              onPointerDown={rememberSwipe}
              onPointerMove={(event) => moveSwipe(event, side)}
              onPointerUp={finishSwipe}
              onPointerCancel={() => {
                swipe.current = null
              }}
              onClick={() => {
                if (ignoreClick.current) {
                  ignoreClick.current = false
                  return
                }
                change(side, 1)
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return
                event.preventDefault()
                change(side, 1)
              }}
              aria-label={`Sumar un punto a ${label}. Deslizá hacia arriba para restar.`}
              className="h-full min-h-0 cursor-pointer touch-none rounded-2xl active:bg-black/10"
            >
              <Fosforos score={scores[side]} />
            </div>
          )
        })}
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

      <div className="grid shrink-0 grid-cols-2 gap-2 px-3 pt-1 pb-4">
        {teams.map((team, index) => {
          const side = index as TeamIndex
          const label = joinNames(team.names)
          const blocked = winner !== null
          return (
            <div key={label} className="grid grid-cols-2 gap-2">
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
    </div>
  )
}
