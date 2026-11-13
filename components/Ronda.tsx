"use client"

import { ordenDeRonda } from "@/lib/mesa"
import type { SeatView } from "@/lib/types"

export function Ronda({
  seats,
  dealerSeat,
  onMark,
  disabled = false,
  layout = "strip",
}: {
  seats: SeatView[]
  dealerSeat: number
  onMark?: (seatIndex: number) => void
  disabled?: boolean
  layout?: "strip" | "list"
}) {
  const order = ordenDeRonda(seats.length, dealerSeat)

  return (
    <ol
      aria-label="Orden de la ronda"
      className={
        layout === "list" ? "grid grid-cols-2 gap-1.5" : "flex flex-wrap gap-1.5"
      }
    >
      {order.map((seatIndex, position) => {
        const seat = seats[seatIndex]
        if (!seat) return null
        const deals = seatIndex === dealerSeat
        const mano = position === 0
        const className = `flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2 text-left ${
          deals ? "bg-buenas text-ink" : "bg-black/20 text-cream"
        } ${layout === "strip" ? "shrink-0" : "w-full"}`
        const body = (
          <>
            <span className="font-display text-lg font-semibold tabular-nums">
              {position + 1}
            </span>
            <span className="min-w-0 truncate font-medium">{seat.name}</span>
            {deals ? (
              <span className="text-[0.7rem] tracking-wide uppercase">Reparte</span>
            ) : null}
            {mano ? (
              <span className="text-[0.7rem] tracking-wide uppercase">Mano</span>
            ) : null}
          </>
        )

        return (
          <li key={seat.id} className={layout === "strip" ? "shrink-0" : undefined}>
            {onMark ? (
              <button
                type="button"
                disabled={disabled || deals}
                onClick={() => onMark(seatIndex)}
                aria-label={
                  deals
                    ? `${seat.name} reparte`
                    : `Marcar a ${seat.name} como quien reparte`
                }
                className={`${className} cursor-pointer disabled:cursor-default`}
              >
                {body}
              </button>
            ) : (
              <div className={className}>{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
