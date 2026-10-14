"use client"

import { useState, useTransition } from "react"
import { buttonPrimary, buttonSecondary } from "@/components/ui"
import { startMatch } from "@/lib/actions"
import { joinNames } from "@/lib/names"
import { tirarReyes, type Draw } from "@/lib/reyes"
import { MODALITIES, type Modality, type Player } from "@/lib/types"

export function NuevaPartida({ players }: { players: Player[] }) {
  const [modality, setModality] = useState<Modality>(3)
  const [selected, setSelected] = useState<string[]>([])
  const [draw, setDraw] = useState<Draw | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const needed = modality * 2
  const ready = selected.length >= needed
  const names = new Map(players.map((player) => [player.id, player.name]))

  function chooseModality(next: Modality) {
    setModality(next)
    setDraw(null)
  }

  function toggle(id: string) {
    setDraw(null)
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    )
  }

  function throwKings() {
    if (!ready) return
    setError(null)
    setDraw(tirarReyes(selected, modality))
  }

  function start() {
    if (!draw) return
    startTransition(async () => {
      const result = await startMatch({
        modality,
        teams: draw.teams,
        bench: draw.bench,
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
          {draw.teams.map((team, index) => (
            <section key={index} className="rounded-2xl bg-banner p-4 text-ink">
              <h2 className="text-sm tracking-wide uppercase">Equipo {index + 1}</h2>
              <p className="mt-1 font-display text-2xl font-semibold">
                {joinNames(team.map((id) => names.get(id) ?? "Jugador"))}
              </p>
            </section>
          ))}
          {draw.bench.length > 0 ? (
            <section className="rounded-2xl border border-cream/30 p-4">
              <h2 className="text-sm tracking-wide text-cream/70 uppercase">
                Afuera
              </h2>
              <p className="mt-1 text-lg">
                {joinNames(draw.bench.map((id) => names.get(id) ?? "Jugador"))}
              </p>
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
              onClick={() => setDraw(null)}
              disabled={pending}
              className={buttonSecondary}
            >
              Elegir de nuevo
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={throwKings}
            disabled={!ready}
            className={buttonPrimary}
          >
            Tirar reyes
          </button>
        )}
      </div>
    </div>
  )
}
