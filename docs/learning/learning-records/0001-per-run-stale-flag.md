# The stale flag works because each effect run has its own copy

The user understands that NotePage's `stale` flag is a front-end-only guard: the server still answers, and the old reply's callback runs but stops at `!stale`, so `setFetched` never runs. They also understand why the flag must be declared inside the effect: a shared flag gets reset to `false` by the newer run, so the old reply slips through.

**Evidence:** Asked what happens if `let stale` moved outside the effect (shared, reset each run), they answered (after self-correcting from "true") that the late reply isn't ignored because the shared flag is `false` again.

**Implications:** Not yet tested on the second guard (`fetched.id === noteId`) or on naming the concept "closure". Also corrected: `.then(a, b)` splits on resolve vs reject, not "detail vs no detail"; 404 Not Found resolves to `null` and goes to callback a.

**Update (2026-10-18), second guard:** Correctly said that just after switching, `fetched` still holds the old note and would show without the ID tag. Misconceptions corrected along the way: (1) thought the ID tag blocks writes; it only filters display, since `useState` holds one value and an unguarded late reply overwrites it. (2) Blurred `noteId` (what's in the URL) with `fetched` (the last saved reply). (3) Forgot that cleanup runs every time you *leave* a note, so a reply for a note you left is ignored. (4) Thought the ID tag also helps when two requests are for the *same* note; it can't tell runs apart, only `stale` can. Summary they reached: "stale guards the door, the ID tag guards the screen."
