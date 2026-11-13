import Link from "next/link"
import { connection } from "next/server"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { FaltaMongo, MongoCaido } from "@/components/FaltaMongo"
import { Screen } from "@/components/Screen"
import { Tanteador } from "@/components/Tanteador"
import { buttonPrimary, buttonSecondary } from "@/components/ui"
import { getMatch } from "@/lib/data"
import { mongoConfigured } from "@/lib/db"
import { readResult } from "@/lib/guard"
import { formatWhen, joinNames } from "@/lib/names"
import { phaseText } from "@/lib/scoring"
import type { MatchView } from "@/lib/types"

export const metadata = { title: "Partida" }

export default function PartidaPage({ params }: PageProps<"/partida/[id]">) {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-cream/80">Cargando partida…</p>}>
      <Partida params={params} />
    </Suspense>
  )
}

async function Partida({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  if (!mongoConfigured()) {
    return (
      <Screen title="Partida">
        <FaltaMongo />
      </Screen>
    )
  }

  const { id } = await params
  const result = await readResult(() => getMatch(id))
  if (!result.ok) {
    return (
      <Screen title="Partida">
        <MongoCaido />
      </Screen>
    )
  }

  const match = result.data
  if (!match) notFound()
  if (match.status === "playing") {
    return (
      <Tanteador
        matchId={match.id}
        teams={match.teams}
        benchNames={match.benchNames}
        seats={match.seats}
        dealerSeat={match.dealerSeat}
        round={match.round}
        hand={match.hand}
        picaStep={match.picaStep}
        picaPica={match.picaPica}
        modality={match.modality}
      />
    )
  }
  if (match.status === "cancelled") return <Anulada />
  return <Cerrada match={match} />
}

function Anulada() {
  return (
    <Screen title="Partida anulada">
      <p className="leading-relaxed text-cream/85">
        Esta partida se anuló y no cuenta en la tabla.
      </p>
      <Link href="/partida/nueva" className={buttonPrimary}>
        Nueva partida
      </Link>
    </Screen>
  )
}

function Cerrada({ match }: { match: MatchView }) {
  const winner = match.winnerTeam
  const when = match.finishedAt ? formatWhen(match.finishedAt) : null

  return (
    <Screen title="Partida cerrada">
      {when ? <p className="text-sm text-cream/70">{when}</p> : null}
      {winner !== null ? (
        <p className="font-display text-3xl font-semibold">
          Ganó {joinNames(match.teams[winner].names)}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        {match.teams.map((team) => (
          <section key={team.ids.join("-")} className="rounded-2xl bg-black/15 p-3">
            <p className="text-sm leading-tight">{joinNames(team.names)}</p>
            <p className="mt-2 font-display text-4xl font-semibold tabular-nums">
              {team.score}
            </p>
            <p className="text-sm text-cream/75">{phaseText(team.score)}</p>
          </section>
        ))}
      </div>
      {match.seats.length > 0 ? (
        <section className="rounded-2xl bg-black/15 px-4 py-3">
          <h2 className="text-sm tracking-wide text-cream/70 uppercase">Mesa</h2>
          <p className="mt-1 leading-relaxed">{joinNames(match.seats.map((seat) => seat.name))}</p>
          <p className="mt-1 text-sm text-cream/70">En ese orden alrededor de la mesa.</p>
        </section>
      ) : null}
      {match.picaPica.length > 0 ? (
        <section className="rounded-2xl bg-black/15 px-4 py-3">
          <h2 className="text-sm tracking-wide text-cream/70 uppercase">Pica pica</h2>
          <ul className="mt-2 grid gap-2">
            {match.seats.length >= 6
              ? [0, 1, 2].map((index) => {
                  const left = match.seats[index]
                  const right = match.seats[index + 3]
                  if (!left || !right) return null
                  let leftPoints = 0
                  let rightPoints = 0
                  for (const duel of match.picaPica) {
                    const [first, second] = duel.playerIds
                    const same =
                      (first === left.id && second === right.id) ||
                      (first === right.id && second === left.id)
                    if (!same) continue
                    if (duel.winnerId === left.id) leftPoints += duel.points
                    else if (duel.winnerId === right.id) rightPoints += duel.points
                  }
                  if (leftPoints === 0 && rightPoints === 0) return null
                  return (
                    <li key={left.id} className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{left.name}</span>
                      <span className="font-display text-xl font-semibold tabular-nums">
                        {leftPoints}–{rightPoints}
                      </span>
                      <span>{right.name}</span>
                    </li>
                  )
                })
              : null}
          </ul>
        </section>
      ) : null}
      <Link href="/historial" className={buttonPrimary}>
        Ver historial
      </Link>
      <Link href="/tabla" className={buttonSecondary}>
        Ver tabla
      </Link>
    </Screen>
  )
}
