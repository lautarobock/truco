import Link from "next/link"
import { connection } from "next/server"
import { Suspense } from "react"
import { FaltaMongo, MongoCaido } from "@/components/FaltaMongo"
import { NuevaPartida } from "@/components/NuevaPartida"
import { Screen } from "@/components/Screen"
import { buttonPrimary } from "@/components/ui"
import { listPlayers } from "@/lib/data"
import { mongoConfigured } from "@/lib/db"
import { readResult } from "@/lib/guard"

export const metadata = { title: "Nueva partida" }

export default function NuevaPartidaPage() {
  return (
    <Screen title="Nueva partida">
      <Suspense fallback={<p className="text-cream/80">Cargando jugadores…</p>}>
        <Nueva />
      </Suspense>
    </Screen>
  )
}

async function Nueva() {
  await connection()
  if (!mongoConfigured()) return <FaltaMongo />

  const result = await readResult(listPlayers)
  if (!result.ok) return <MongoCaido />
  const players = result.data

  if (players.length === 0) {
    return (
      <div className="grid gap-4">
        <p className="leading-relaxed text-cream/85">
          Primero cargá los jugadores de la mesa.
        </p>
        <Link href="/jugadores" className={buttonPrimary}>
          Ir a jugadores
        </Link>
      </div>
    )
  }

  return <NuevaPartida players={players} />
}
