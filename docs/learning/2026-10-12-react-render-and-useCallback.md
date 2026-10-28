# React review: renders, setState updaters, useCallback

Notes from going through FEAT-002 Ticket 1, Checkpoint 1 (2026-10-12). Read top to bottom: each
step builds on the one before. Nothing from Checkpoint 1 has been written to the code yet.

---

## Where we are

**Checkpoint 1 🟡: Page.** "+ New page" still opens the note instantly. On top of that,
`NotesProvider` starts a background loop that sends the note to the server:

```
Sidebar click
  → createNote()                    (NotesProvider, already exists)
      → setNotes(...)               add it locally, as today
      → void syncCreate(id)         start the loop, don't wait for it
      → return id                   Sidebar navigates to /notes/<id> at once

syncCreate loop:
  createNoteOnServer(id)            (api.ts, new stub)
    'created' → return              loop ends
    'taken'   → new id, swap it into notes, fix the URL if that note is open, go again
    throws    → wait 3s, go again with the same id
```

**Still to decide:** should `createNoteOnServer(id)` return `'created' | 'taken'` instead of
`NoteDetail`? Reason: the `api.ts` interceptor turns every error into a plain `Error(message)`
and throws away the status code, so the loop couldn't tell a 409 Conflict from a network error.

**Renamed:** the `api.ts` function is `createNoteOnServer` (not `createNote`), so it doesn't
clash with `NotesProvider`'s `createNote`.

---

## Step 1: What a render is

When state changes, React **re-runs the component function** from the top. Every line runs
again. Then React compares the result with last time and updates **only the changed bits** of
the real page.

- State (`notes`) is not re-created. React holds it; the render just reads the current value.
- Functions written inside the component **are** re-created on every render.

## Step 2: Calling vs defining

```ts
const createNote = () => { setNotes(...) }   // DEFINES it: nothing inside runs
createNote()                                  // CALLS it: now setNotes runs
```

A render only *defines* `createNote`. Its body runs only when someone calls it (a click). So
`setNotes` inside it does **not** cause an endless loop.

What *would* loop forever: calling `setNotes` loose in the component body.

## Step 3: `setNotes((prev) => ...)`: where `prev` comes from

`setNotes` is written by React, not us. Simplified:

```ts
let stored = []                // React keeps the notes here
function setNotes(fn) {
  stored = fn(stored)          // ← React calls YOUR function and fills prev
  rerender()
}
```

- `prev` = the **whole list** React holds **before** the change
- what your function returns = the list **after**

Example: React holds `[{id:'aaa'}, {id:'bbb'}]`.
`setNotes((prev) => prev.filter((n) => n.id !== 'aaa'))` → `prev` is both notes → React
stores `[{id:'bbb'}]`. ✅ (you got this one)

The 409 line in `syncCreate` with `id = 'bbb'`, `newId = 'ccc'`:

```ts
setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, id: newId } : n)))
```

| `n` | `n.id === 'bbb'`? | result |
|---|---|---|
| `{ id: 'aaa', ... }` | no | kept as is |
| `{ id: 'bbb', ... }` | yes | copy with `id: 'ccc'`, title/body kept |

## Step 4: Functions are objects

```ts
const a = () => 1
const b = () => 1
a === b   // false: same code, two objects in memory
```

React compares with `===`: "same object?", not "same code?".

**Cookie cutter:** the code in the file is one cutter. Every render stamps out a new function
object (a cookie). "Copy A", "copy B" = cookies from the same cutter, made on different renders.

## Step 5: Closures = a snapshot of the render that made it

A function remembers the **outside** variables from the render that created it.

```ts
// Render 1: notes = [aaa]
const showCount = () => console.log(notes.length)
// later, Render 2: notes = [aaa, bbb]
// calling Render 1's showCount still logs 1: it sees its own snapshot
```

Variables created **inside** the body (like `const id = crypto.randomUUID()`) are fresh on
**every call**.

That's why the loop uses `prev`, not `notes`: the loop may run for a long time, so its `notes`
would be stale. `prev` always comes from React, current.

## Step 6: `useCallback` and the dependency list

```ts
const syncCreate = useCallback(async (firstId) => { ... }, [navigate])
```

Every render React checks the dependency list:

- **same** as last render → hand back the **old** function object
- **changed** → keep the **new** one (with the new snapshot)

Rule: list every value from the component that the function uses. (`setNotes` never needs
listing; React promises it never changes.)

| Function | Uses | Dependencies |
|---|---|---|
| `createNote` (today) | `setNotes` | `[]` |
| `syncCreate` (new) | `setNotes`, `navigate` | `[navigate]` |
| `createNote` (new) | `setNotes`, `syncCreate` | `[syncCreate]` |

## Step 7: Why bother keeping the old function

```
syncCreate ──used by──► createNote ──put in──► value ──read by──► Sidebar, WorkspaceHome, NotePage
```

If `value` is a new object, every component reading it re-renders. Keeping old function objects
lets `value` stay the same when nothing changed. Honestly a small win here, but it's the
standard pattern and matches the rest of the provider.

## Step 8: A running loop never switches copies  ← where we stopped

- `navigate` changes only when the **URL** changes (not when notes change).
- New `navigate` → React keeps a new `syncCreate` → so also a new `createNote`.
- But a loop **already running** stays inside the copy it started in until it returns.
- The new copy just **sits there** until the next "+ New page" click calls it.

```
click 1      → createNote (A) calls syncCreate (A) → loop A runs to 'created' in copy A
URL changes  → React makes copies B (nothing calls them yet)
click 2      → Sidebar now holds createNote (B) → calls syncCreate (B) → loop B, a new note
```

How Sidebar gets copy B: it doesn't import `createNote`; it receives it from the provider on
every render (`const { createNote } = useNotes()`), so it always holds the newest one.

**Not recursion:** nothing calls itself. It's one `for (;;)` loop inside one call.

---

## The whole flow, start to finish

```
① APP LOADS
NotesProvider renders (1st time)
  notes      = [aaa]                     React's state
  navigate   = nav1                      from React Router
  syncCreate = useCallback(..., [nav1])  first time → make & keep  syncCreate#1  (snapshot: nav1)
  createNote = useCallback(..., [syncCreate#1])  first time → keep createNote#1
  value      = { notes, createNote#1, ... }
Sidebar renders → useNotes() hands it createNote#1

② USER CLICKS "+ New page"
Sidebar calls createNote#1()
  id = 'bbb'                              fresh on every call
  setNotes(prev => [...prev, bbb])        React: prev=[aaa] → stores [aaa, bbb]
  void syncCreate#1('bbb')                loop starts, runs in the background
  return 'bbb'
Sidebar: navigate('/notes/bbb')

③ RE-RENDER (notes changed AND URL changed)
NotesProvider renders
  notes      = [aaa, bbb]
  navigate   = nav2                       URL changed → new navigate
  syncCreate: [nav2] ≠ [nav1] → keep NEW  syncCreate#2  (snapshot: nav2)
  createNote: [syncCreate#2] ≠ [syncCreate#1] → keep NEW  createNote#2
  value      = new (notes changed anyway)
Sidebar re-renders → now holds createNote#2 (unused until the next click)

④ MEANWHILE, THE LOOP (still inside syncCreate#1)
try createNoteOnServer('bbb')
  ├─ throws    → wait 3s → try again with 'bbb'
  ├─ 'taken'   → newId = 'ccc'
  │              setNotes(prev => swap bbb→ccc)  React: prev = CURRENT list, not a snapshot
  │              on /notes/bbb? → nav1('/notes/ccc', replace)  old navigate still works
  │              id = 'ccc' → try again
  └─ 'created' → return  ✅ loop over

⑤ AN UNRELATED RE-RENDER (nothing we depend on changed)
  syncCreate: [nav2] same → hand back OLD syncCreate#2
  createNote: [syncCreate#2] same → hand back OLD createNote#2
  value can stay the same → Sidebar etc. aren't disturbed      ← the point of useCallback

⑥ USER CLICKS "+ New page" AGAIN
Sidebar calls createNote#2() → syncCreate#2('ddd') → a new, separate loop
```

- **A render defines functions. A click calls them.** (②)
- **`useCallback` keeps the old function unless a dependency changed.** (③ new, ⑤ old)
- **A running loop stays in the copy it started in, and `prev` keeps it up to date anyway.** (④)

---

## Self-check (answers below)

1. In `setNotes((prev) => [...prev, x])`, who calls the arrow function, and what is `prev`?
2. Does re-rendering `NotesProvider` run the code inside `createNote`?
3. With `[]` as the dependency list, how often does React swap in a new copy?
4. A create keeps failing for 10s while the user clicks through 3 other notes. Which copy of
   `syncCreate` is the loop running in?
5. Why does the loop use `prev` instead of `notes`?

<details><summary>Answers</summary>

1. React calls it. `prev` is the whole notes list React holds before the change.
2. No. A render only defines it; the body runs when someone calls it.
3. Never. Nothing to change, so the first object is kept forever.
4. The copy it started in. A running call never switches copies.
5. The loop can run a long time, so its captured `notes` would be stale; `prev` is always current.

</details>

**Tomorrow:** if Step 8 is still fuzzy, the plan is to write Piece 1 with a temporary
`console.log` so you can watch the copies change in the browser.
