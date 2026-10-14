"use client"

import Link from "next/link"
import { useEffect } from "react"
import { buttonPrimary, buttonSecondary } from "@/components/ui"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      <h1 className="font-display text-3xl font-semibold">Algo salió mal</h1>
      <p className="text-cream/85">No se pudo cargar esta pantalla.</p>
      <button type="button" onClick={reset} className={buttonPrimary}>
        Reintentar
      </button>
      <Link href="/" className={buttonSecondary}>
        Ir al inicio
      </Link>
    </div>
  )
}
