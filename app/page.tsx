import Link from "next/link";
import { Suspense } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/ui";
import { PartidasEnCurso } from "@/components/PartidasEnCurso";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Truco</h1>
      <p className="mt-2 text-cream/80">
        Anotador de la mesa. A 30, malas y buenas.
      </p>
      <nav className="mt-8 grid gap-3">
        <Link href="/partida/nueva" className={buttonPrimary}>
          Nueva partida
        </Link>
        <Link href="/jugadores" className={buttonSecondary}>
          Jugadores
        </Link>
        <Link href="/historial" className={buttonSecondary}>
          Historial
        </Link>
        <Link href="/tabla" className={buttonSecondary}>
          Tabla
        </Link>
      </nav>
      <Suspense fallback={null}>
        <PartidasEnCurso />
      </Suspense>
    </div>
  );
}
