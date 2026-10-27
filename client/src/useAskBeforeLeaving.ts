import { useEffect } from 'react'
import { useAskBeforeClosingTab } from './useAskBeforeClosingTab.ts'

// While `shouldAsk` is true, a click on a link asks `question` before leaving the page, and
// closing or reloading the tab shows the browser's "Leave site?". The router here has no
// navigation blocker, so a move that isn't a link click (the back button, the sidebar's
// New note button) isn't caught.
export function useAskBeforeLeaving(shouldAsk: boolean, question: string): void {
  useAskBeforeClosingTab(shouldAsk)
  useEffect(() => {
    if (!shouldAsk) return
    const askBeforeFollowingLink = (event: MouseEvent) => {
      // Ctrl, ⌘ or Shift + click opens a new tab or window, so nothing here is lost.
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (!(event.target instanceof Element) || !event.target.closest('a[href]')) return
      if (window.confirm(question)) return
      event.preventDefault()
      event.stopPropagation()
    }
    // Capture phase on document, so it runs before React Router's click handler navigates.
    document.addEventListener('click', askBeforeFollowingLink, { capture: true })
    return () => document.removeEventListener('click', askBeforeFollowingLink, { capture: true })
  }, [shouldAsk, question])
}
