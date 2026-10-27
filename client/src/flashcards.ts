// The four grades, keys 1–4.
export type FlashcardGrade = 'again' | 'hard' | 'good' | 'easy'

// One card of a session, as GET /api/flashcards returns it.
export type Flashcard = {
  questionId: string
  question: string
  answer: string
  // Never graded yet.
  isNew: boolean
  // Days until it's due again after each grade, worked out by the server (T4.13).
  nextIntervalDays: Record<FlashcardGrade, number>
}

// Today's cards (new first, then due) and, for the "All done" screen, the next day with cards due.
export type FlashcardSession = {
  cards: Flashcard[]
  // null = nothing scheduled after today.
  nextDue: { daysFromToday: number; cardCount: number } | null
}

// The browser's time zone, e.g. "Australia/Sydney". The server uses it to work out "today" (T4.4).
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// "Next cards due tomorrow (4)." / "Next cards due in 3 days (1)."
export function nextDueText(nextDue: { daysFromToday: number; cardCount: number }): string {
  const when = nextDue.daysFromToday === 1 ? 'tomorrow' : `in ${nextDue.daysFromToday} days`
  return `Next cards due ${when} (${nextDue.cardCount}).`
}
