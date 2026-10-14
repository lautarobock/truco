import { connection } from "next/server"
import { Suspense } from "react"
import { FaltaMongo, MongoCaido } from "@/components/FaltaMongo"
import { PlayerForm } from "@/components/PlayerForm"
import { Screen } from "@/components/Screen"
import { listPlayers } from "@/lib/data"
import { mongoConfigured } from "@/lib/db"
import { readResult } from "@/lib/guard"

export const metadata = { title: "Jugadores" }

export default function JugadoresPage() {
  return (
    <Screen title="Jugadores">
      <Suspense fallback={<p className="text-cream/80">Cargando jugadores…</p>}>
        <Jugadores />
      </Suspense>
    </Screen>
  )
}

async function Jugadores() {
  await connection()
  if (!mongoConfigured()) return <FaltaMongo />

  const result = await readResult(listPlayers)
  if (!result.ok) return <MongoCaido />
  const players = result.data

  return (
    <>
      <PlayerForm />
      {players.length === 0 ? (
        <p className="text-cream/80">Todavía no hay jugadores.</p>
      ) : (
        <ul className="grid gap-2">
          {players.map((player) => (
            <li
              key={player.id}
              className="rounded-2xl bg-black/15 px-4 py-3 text-lg"
            >
              {player.name}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
