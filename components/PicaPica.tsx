"use client"

import { parejasPicaPica } from "@/lib/mesa"
import type { PicaDuelView, SeatView } from "@/lib/types"

function pointsOf(duels: readonly PicaDuelView[], leftId: string, rightId: string): [number, number] {
  let left = 0
  let right = 0
  for (const duel of duels) {
    const [first, second] = duel.playerIds
    const samePair =
      (first === leftId && second === rightId) || (first === rightId && second === leftId)
    if (!samePair) continue
    if (duel.winnerId === leftId) left += duel.points
    else if (duel.winnerId === rightId) right += duel.points
  }
  return [left, right]
}

export function PicaPica({
  seats,
  dealerSeat,
  step,
  roundDuels,
}: {
  seats: SeatView[]
  dealerSeat: number
  step: number
  roundDuels: PicaDuelView[]
}) {
  const pairs = parejasPicaPica(dealerSeat, seats.length)

  return (
    <section className="px-3" aria-label="Pica pica">
      <p className="text-center text-sm tracking-[0.16em] text-cream/70 uppercase">
        Pica pica
      </p>
      <ol className="mt-2 grid gap-1.5">
        {pairs.map((pair, index) => {
          const left = seats[pair[0]]
          const right = seats[pair[1]]
          if (!left || !right) return null
          const [leftPoints, rightPoints] = pointsOf(
            roundDuels.filter((duel) => duel.step === index),
            left.id,
            right.id,
          )
          const current = index === step
          return (
            <li
              key={`${pair[0]}-${pair[1]}`}
              className={`grid grid-cols-[auto_1fr_auto_1fr] items-baseline gap-2 rounded-xl px-3 py-2 ${
                current ? "bg-banner font-semibold text-ink" : "bg-black/15 text-cream/80"
              }`}
            >
              <span className="font-display">{index + 1}</span>
              <span className="truncate">{left.name}</span>
              <span className="font-display text-lg tabular-nums">
                {leftPoints}–{rightPoints}
              </span>
              <span className="truncate text-right">{right.name}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export function ManoAManoPartida({
  seats,
  duels,
}: {
  seats: SeatView[]
  duels: PicaDuelView[]
}) {
  if (seats.length < 6 || duels.length === 0) return null
  const half = seats.length / 2
  const rows = []
  for (let index = 0; index < half; index += 1) {
    const left = seats[index]
    const right = seats[index + half]
    if (!left || !right) continue
    const [leftPoints, rightPoints] = pointsOf(duels, left.id, right.id)
    rows.push({ left, right, leftPoints, rightPoints })
  }

  return (
    <section className="px-3" aria-label="Mano a mano de esta partida">
      <p className="text-center text-sm tracking-[0.16em] text-cream/70 uppercase">
        Mano a mano
      </p>
      <ul className="mt-1 grid gap-1">
        {rows.map((row) => (
          <li
            key={row.left.id}
            className="grid grid-cols-[1fr_auto_1fr] items-baseline gap-2 text-sm"
          >
            <span className="truncate">{row.left.name}</span>
            <span className="font-display text-lg font-semibold tabular-nums">
              {row.leftPoints}–{row.rightPoints}
            </span>
            <span className="truncate text-right">{row.right.name}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
