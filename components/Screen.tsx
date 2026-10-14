import Link from "next/link"
import type { ReactNode } from "react"
import { buttonGhost } from "@/components/ui"

export function Screen({
  title,
  children,
  home = true,
}: {
  title: string
  children: ReactNode
  home?: boolean
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-5">
      <header className="mb-6">
        {home ? (
          <Link href="/" className={buttonGhost}>
            Inicio
          </Link>
        ) : null}
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {title}
        </h1>
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}
