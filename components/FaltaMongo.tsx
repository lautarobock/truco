export function FaltaMongo() {
  return (
    <p className="rounded-2xl bg-black/20 p-4 leading-relaxed text-cream">
      Falta configurar MongoDB. Agregá{" "}
      <code className="rounded bg-black/30 px-1">MONGODB_URI</code> y{" "}
      <code className="rounded bg-black/30 px-1">MONGODB_DB</code> en{" "}
      <code className="rounded bg-black/30 px-1">.env.local</code>.
    </p>
  )
}

export function MongoCaido() {
  return (
    <p className="rounded-2xl bg-black/20 p-4 text-cream">
      No se pudo conectar con MongoDB.
    </p>
  )
}
