import { useEffect } from 'react'

// While `shouldAsk` is true, closing or reloading the tab shows the browser's "Leave site?".
export function useAskBeforeClosingTab(shouldAsk: boolean): void {
  useEffect(() => {
    if (!shouldAsk) return
    const askBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', askBeforeLeaving)
    return () => window.removeEventListener('beforeunload', askBeforeLeaving)
  }, [shouldAsk])
}
