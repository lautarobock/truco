import { connection } from "next/server"
import { Suspense } from "react"
import { FaltaMongo, MongoCaido } from "@/components/FaltaMongo"
import { Screen } from "@/components/Screen"
import { listStandings } from "@/lib/data"
import { mongoConfigured } from "@/lib/db"
import { readResult } from "@/lib/guard"

export const metadata = { title: "Tabla" }

export default function TablaPage() {
  return (
    <Screen title="Tabla">
      <Suspense fallback={<p className="text-cream/80">Cargando tabla…</p>}>
        <Tabla />
      </Suspense>
    </Screen>
  )
}

async function Tabla() {
  await connection()
  if (!mongoConfigured()) return <FaltaMongo />

  const result = await readResult(listStandings)
  if (!result.ok) return <MongoCaido />
  const rows = result.data

  if (rows.length === 0) {
    return <p className="text-cream/80">Todavía no hay jugadores.</p>
  }

  return (
      <table className="w-full border-separate border-spacing-y-2 text-left">
        <thead className="text-sm tracking-wide text-cream/70 uppercase">
          <tr>
            <th className="px-3 py-1 font-medium">Jugador</th>
            <th className="px-2 py-1 text-right font-medium">PJ</th>
            <th className="px-2 py-1 text-right font-medium">PG</th>
            <th className="px-2 py-1 text-right font-medium">PP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.playerId}>
              <td className="rounded-l-2xl bg-black/15 px-3 py-3 font-medium">
                {row.name}
              </td>
              <td className="bg-black/15 px-2 py-3 text-right tabular-nums">
                {row.played}
              </td>
              <td className="bg-black/15 px-2 py-3 text-right tabular-nums">
                {row.wins}
              </td>
              <td className="rounded-r-2xl bg-black/15 px-2 py-3 text-right tabular-nums">
                {row.losses}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
  )
}
