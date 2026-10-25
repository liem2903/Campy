import { useEffect, useState } from 'react'

// Seconds since `startedAt` (a Date.now() timestamp), ticking once a second while `running`;
// frozen while it isn't. Measured from timestamps, so a throttled background tab stays right.
export function useElapsedSeconds(startedAt: number, running: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const ticker = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(ticker)
  }, [running])
  // Just after a restart, `now` is still the old tick, so clamp to 0 until the next one.
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}
