// How long to wait before trying a failed server call again.
export const RETRY_MS = 3000

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
