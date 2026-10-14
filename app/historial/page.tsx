import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { FaltaMongo, MongoCaido } from "@/components/FaltaMongo"
import { Screen } from "@/components/Screen"
import { listHistory } from "@/lib/data"
import { mongoConfigured } from "@/lib/db"
import { readResult } from "@/lib/guard"
import { formatWhen, joinNames } from "@/lib/names"
import { phaseText } from "@/lib/scoring"

export const metadata = { title: "Historial" }

export default function HistorialPage() {
  return (
    <Screen title="Historial">
      <Suspense fallback={<p className="text-cream/80">Cargando partidos…</p>}>
        <Historial />
      </Suspense>
    </Screen>
  )
}

async function Historial() {
  await connection()
  if (!mongoConfigured()) return <FaltaMongo />

  const result = await readResult(listHistory)
  if (!result.ok) return <MongoCaido />
  const matches = result.data

  if (matches.length === 0) {
    return <p className="text-cream/80">Todavía no hay partidos cerrados.</p>
  }

  return (
      <ul className="grid gap-3">
        {matches.map((match) => (
          <li key={match.id}>
            <Link
              href={`/partida/${match.id}`}
              className="block rounded-2xl bg-black/15 px-4 py-3"
            >
              <time className="text-sm text-cream/70">
                {formatWhen(match.finishedAt)}
              </time>
              <div className="mt-2 grid gap-2">
                {match.teams.map((team, index) => {
                  const won = index === match.winnerTeam
                  return (
                    <p key={team.names.join("-")} className="flex items-baseline justify-between gap-3">
                      <span className={won ? "font-semibold" : "text-cream/80"}>
                        {joinNames(team.names)}
                        {won ? " · ganó" : ""}
                      </span>
                      <span className="font-display text-xl font-semibold tabular-nums">
                        {team.score}
                      </span>
                    </p>
                  )
                })}
              </div>
              <p className="mt-2 text-sm text-cream/70">
                {phaseText(match.teams[0].score)} · {phaseText(match.teams[1].score)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
  )
}
