export async function readResult<T>(
  read: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: await read() }
  } catch (error) {
    console.error(error)
    return { ok: false }
  }
}
