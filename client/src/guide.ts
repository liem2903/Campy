// Whether this browser has seen the "How Campi works" guide, so it only opens by itself once.

const STORAGE_KEY = 'campi.guideSeen'

export function hasSeenGuide(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    // Storage unavailable: count it as seen rather than open the guide on every page load.
    return true
  }
}

export function rememberGuideSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Storage unavailable: nothing to remember it in.
  }
}
