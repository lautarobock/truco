"use client"

import { useActionState, useEffect, useRef } from "react"
import { buttonPrimary } from "@/components/ui"
import { addPlayer } from "@/lib/actions"

export function PlayerForm() {
  const [state, action, pending] = useActionState(addPlayer, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state && "ok" in state) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={40}
          autoComplete="off"
          placeholder="Nombre"
          aria-label="Nombre"
          className="min-h-14 min-w-0 flex-1 rounded-2xl bg-banner px-4 text-base text-ink outline-none placeholder:text-ink/50"
        />
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? "…" : "Agregar"}
        </button>
      </div>
      {state && "error" in state ? (
        <p className="text-sm text-cream">{state.error}</p>
      ) : null}
    </form>
  )
}
