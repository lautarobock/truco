"use client"

import { useState, useTransition } from "react"
import { Ronda } from "@/components/Ronda"
import { buttonPrimary, buttonSecondary } from "@/components/ui"
import { startMatch } from "@/lib/actions"
import { mezclarAsientos, parejasPicaPica, sentar } from "@/lib/mesa"
import { tirarReyes, type Draw } from "@/lib/reyes"
import { MODALITIES, type Modality, type Player } from "@/lib/types"

export function NuevaPartida({ players }: { players: Player[] }) {
  const [modality, setModality] = useState<Modality>(3)
  const [selected, setSelected] = useState<string[]>([])
  const [draw, setDraw] = useState<Draw | null>(null)
  const [dealerSeat, setDealerSeat] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const needed = modality * 2
  const ready = selected.length >= needed
  const names = new Map(players.map((player) => [player.id, player.name]))

  function chooseModality(next: Modality) {
    setModality(next)
    setDraw(null)
    setPicked(null)
  }

  function toggle(id: string) {
    setDraw(null)
    setPicked(null)
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }

  function seatDraw(teams: [string[], string[]], bench: string[]) {
    const seats = sentar(teams)
    setDraw({ teams, bench, seats })
    setDealerSeat(Math.max(0, seats.length - 1))
    setPicked(null)
  }

  function throwKings() {
    if (!ready) return
    setError(null)
    const next = tirarReyes(selected, modality)
    setDraw(next)
    setDealerSeat(Math.max(0, next.seats.length - 1))
    setPicked(null)
  }

  function arrangeByHand() {
    if (!ready) return
    setError(null)
    const playing = selected.slice(0, needed)
    seatDraw(
      [playing.slice(0, modality), playing.slice(modality)],
      selected.slice(needed),
    )
  }

  function reshuffleSeats() {
    if (!draw) return
    const seats = mezclarAsientos(draw.teams)
    const dealerId = draw.seats[dealerSeat]
    setDraw({ ...draw, seats })
    const nextDealer = dealerId ? seats.indexOf(dealerId) : -1
    setDealerSeat(nextDealer >= 0 ? nextDealer : Math.max(0, seats.length - 1))
    setPicked(null)
  }

  function choosePlayer(id: string) {
    if (!draw) return
    if (!picked || picked === id) {
      setPicked(picked === id ? null : id)
      return
    }
    const replace = (playerId: string) =>
      playerId === picked ? id : playerId === id ? picked : playerId
    const seats = draw.seats.map(replace)
    const dealerId = draw.seats[dealerSeat]
    setDraw({
      teams: [draw.teams[0].map(replace), draw.teams[1].map(replace)],
      bench: draw.bench.map(replace),
      seats,
    })
    if (dealerId) {
      const nextDealer = seats.indexOf(dealerId)
      if (nextDealer >= 0) setDealerSeat(nextDealer)
    }
    setPicked(null)
  }

  function start() {
    if (!draw) return
    startTransition(async () => {
      const result = await startMatch({
        modality,
        teams: draw.teams,
        bench: draw.bench,
        seats: draw.seats,
        dealerSeat,
      })
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Modalidad" className="grid grid-cols-3 gap-2">
        {MODALITIES.map((option) => {
          const active = option === modality
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => chooseModality(option)}
              className={active ? buttonPrimary : buttonSecondary}
            >
              {option} vs {option}
            </button>
          )
        })}
      </div>

      <p className="text-sm leading-relaxed text-cream/80">
        {selected.length < needed
          ? `Elegí al menos ${needed} jugadores.`
          : selected.length === needed
            ? "Entran todos."
            : `${selected.length - needed} van a quedar afuera y no suman victoria ni derrota.`}
      </p>

      <ul className="grid gap-2">
        {players.map((player) => {
          const on = selected.includes(player.id)
          return (
            <li key={player.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(player.id)}
                className={
                  on
                    ? `${buttonPrimary} justify-start`
                    : `${buttonSecondary} justify-start`
                }
              >
                {player.name}
              </button>
            </li>
          )
        })}
      </ul>

      {draw ? (
        <div className="grid gap-3">
          <p className="text-sm leading-relaxed text-cream/80">
            {picked
              ? `Elegiste a ${names.get(picked) ?? "ese jugador"}. Tocá con quién lo cambiás.`
              : "Tocá dos jugadores para cambiarlos. Los del mismo equipo cambian de lugar. Los de equipos distintos se cambian de equipo."}
          </p>
          {draw.teams.map((team, index) => (
            <section key={index} className="grid gap-2">
              <h2 className="text-sm tracking-wide text-cream/70 uppercase">
                Equipo {index + 1}
              </h2>
              {team.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={picked === id}
                  onClick={() => choosePlayer(id)}
                  className={
                    picked === id
                      ? `${buttonPrimary} justify-start`
                      : `${buttonSecondary} justify-start`
                  }
                >
                  {names.get(id) ?? "Jugador"}
                </button>
              ))}
            </section>
          ))}
          <section className="grid gap-2">
            <h2 className="text-sm tracking-wide text-cream/70 uppercase">
              Cómo se sientan
            </h2>
            <p className="text-sm leading-relaxed text-cream/80">
              En círculo, en este orden. El 1 está a la derecha de quien reparte.
              Tocá un nombre para marcar el reparto.
            </p>
            <Ronda
              seats={draw.seats.map((id) => ({
                id,
                name: names.get(id) ?? "Jugador",
              }))}
              dealerSeat={dealerSeat}
              onMark={setDealerSeat}
              layout="list"
            />
            {modality === 3 ? (
              <div className="rounded-2xl bg-black/15 px-3 py-3">
                <p className="text-sm tracking-wide text-cream/70 uppercase">
                  Pica pica
                </p>
                <p className="mt-1 text-sm leading-relaxed text-cream/80">
                  Entre 6 y 24 se alternan una mano redonda y una de pica pica, y en cada una reparte el siguiente. En el pica pica cada punto se anota en el jugador y suma en el partido.
                </p>
                <ol className="mt-2 grid gap-1">
                  {parejasPicaPica(dealerSeat).map((pair, index) => (
                    <li key={`${pair[0]}-${pair[1]}`}>
                      {index + 1}. {names.get(draw.seats[pair[0]] ?? "") ?? "Jugador"} vs{" "}
                      {names.get(draw.seats[pair[1]] ?? "") ?? "Jugador"}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </section>
          {draw.bench.length > 0 ? (
            <section className="grid gap-2">
              <h2 className="text-sm tracking-wide text-cream/70 uppercase">
                Afuera
              </h2>
              <p className="text-sm leading-relaxed text-cream/80">
                Tocá a uno de afuera y después al jugador que sale.
              </p>
              {draw.bench.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={picked === id}
                  onClick={() => choosePlayer(id)}
                  className={
                    picked === id
                      ? `${buttonPrimary} justify-start`
                      : `${buttonSecondary} justify-start`
                  }
                >
                  {names.get(id) ?? "Jugador"}
                </button>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-cream">{error}</p> : null}

      <div className="grid gap-2">
        {draw ? (
          <>
            <button
              type="button"
              onClick={start}
              disabled={pending}
              className={buttonPrimary}
            >
              {pending ? "Armando…" : "Empezar"}
            </button>
            <button
              type="button"
              onClick={throwKings}
              disabled={pending}
              className={buttonSecondary}
            >
              Volver a tirar
            </button>
            <button
              type="button"
              onClick={reshuffleSeats}
              disabled={pending}
              className={buttonSecondary}
            >
              Volver a sentar
            </button>
            <button
              type="button"
              onClick={() => {
                setDraw(null)
                setPicked(null)
              }}
              disabled={pending}
              className={buttonSecondary}
            >
              Elegir de nuevo
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={throwKings}
              disabled={!ready}
              className={buttonPrimary}
            >
              Tirar reyes
            </button>
            <button
              type="button"
              onClick={arrangeByHand}
              disabled={!ready}
              className={buttonSecondary}
            >
              Armar a mano
            </button>
          </>
        )}
      </div>
    </div>
  )
}
