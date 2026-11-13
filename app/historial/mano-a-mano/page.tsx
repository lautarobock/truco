import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { FaltaMongo, MongoCaido } from "@/components/FaltaMongo"
import { Screen } from "@/components/Screen"
import { buttonGhost } from "@/components/ui"
import { listHeadToHead } from "@/lib/data"
import { mongoConfigured } from "@/lib/db"
import { readResult } from "@/lib/guard"

export const metadata = { title: "Mano a mano" }

export default function ManoAManoPage() {
  return (
    <Screen title="Mano a mano">
      <Link href="/historial" className={buttonGhost}>
        Ver partidos
      </Link>
      <p className="text-sm leading-relaxed text-cream/80">
        En partidos cuenta cada vez que quedaron en equipos distintos. En pica pica, cada punto anotado de a uno.
      </p>
      <Suspense fallback={<p className="text-cream/80">Cargando enfrentamientos…</p>}>
        <Rivalidades />
      </Suspense>
    </Screen>
  )
}

async function Rivalidades() {
  await connection()
  if (!mongoConfigured()) return <FaltaMongo />

  const result = await readResult(listHeadToHead)
  if (!result.ok) return <MongoCaido />
  const rows = result.data

  if (rows.length === 0) {
    return <p className="text-cream/80">Todavía no hay enfrentamientos cerrados.</p>
  }

  return (
    <ul className="grid gap-3">
      {rows.map((row) => (
        <li
          key={`${row.players[0].id}-${row.players[1].id}`}
          className="rounded-2xl bg-black/15 px-4 py-3"
        >
          <table className="w-full text-left">
            <thead className="text-xs tracking-wide text-cream/60 uppercase">
              <tr>
                <th className="py-1 font-medium" />
                <th className="px-2 py-1 text-right font-medium">Partidos</th>
                <th className="py-1 text-right font-medium">Pica pica</th>
              </tr>
            </thead>
            <tbody>
              {row.players.map((player, index) => (
                <tr key={player.id}>
                  <th className="py-1 pr-2 font-semibold">{player.name}</th>
                  <td className="px-2 py-1 text-right font-display text-2xl font-semibold tabular-nums">
                    {row.matchWins[index]}
                  </td>
                  <td className="py-1 text-right font-display text-2xl font-semibold tabular-nums">
                    {row.picaWins[index]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </li>
      ))}
    </ul>
  )
}
