export function joinNames(names: readonly string[]): string {
  if (names.length === 0) return ""
  if (names.length === 1) return names[0] ?? ""
  if (names.length === 2) return `${names[0]} y ${names[1]}`
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`
}

export function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim()
}

export function nameKey(name: string): string {
  return name.toLocaleLowerCase("es")
}

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))
}
