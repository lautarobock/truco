import Link from "next/link"
import { connection } from "next/server"
import { listLiveMatches } from "@/lib/data"
import { mongoConfigured } from "@/lib/db"
import { readResult } from "@/lib/guard"
import { joinNames } from "@/lib/names"
import { phaseText } from "@/lib/scoring"

export async function PartidasEnCurso() {
  await connection()
  if (!mongoConfigured()) return null

  const result = await readResult(listLiveMatches)
  if (!result.ok || result.data.length === 0) return null
  const matches = result.data

  return (
      <section className="mt-8">
        <h2 className="text-sm tracking-[0.16em] text-cream/70 uppercase">
          En curso
        </h2>
        <ul className="mt-3 grid gap-2">
          {matches.map((match) => (
            <li key={match.id}>
              <Link
                href={`/partida/${match.id}`}
                className="block rounded-2xl border border-cream/30 bg-black/10 px-4 py-3"
              >
                <span className="block text-sm">
                  {joinNames(match.teams[0].names)}
                </span>
                <span className="mt-1 block font-display text-xl font-semibold">
                  {phaseText(match.teams[0].score)} · {phaseText(match.teams[1].score)}
                </span>
                <span className="mt-1 block text-sm">
                  {joinNames(match.teams[1].names)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
  )
}
