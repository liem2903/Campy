# Campi

Campi is a note-taking app with AI study tools: blurting practice, active-recall quizzes, flashcards, and user-defined grading criteria.

## Roadmap
- **Sprint 1**: basic note taking (CRUD) + authentication
- **Sprint 2**: AI features (blurting, quizzes, flashcards, custom criteria)
- **Sprint 3**: concurrency (safe concurrent access and editing of notes)

## Stack and commands
- TypeScript + Node.js + Express
- `npm run dev`: run with auto-reload (tsx watch)
- `npm run build`: compile `src/` to `dist/` with tsc
- `npm start`: run the compiled server
- Server defaults to port 3000 (override with `PORT`). Health check: `GET /health`
- Database: Supabase Postgres. Migrations are SQL files in `supabase/migrations/`. Scripts: `db:start`/`db:stop` (local stack, needs Docker), `db:new -- <name>` (new migration), `db:reset` (rebuild local DB from migrations), `db:push` (apply to the hosted project). Never edit a migration that has already been applied; add a new one.

## Conventions
- ESM with `NodeNext` module resolution: relative imports must use `.js` extensions.
- Strict TypeScript. Avoid `any`.
- Source lives only in `src/`. Never edit `dist/`.
- Secrets go in `.env*` files (gitignored). Never hard-code them.
- Back-end layers, each calling only the one below:
  - `src/routes/`: wiring only (paths, rate limiters, middleware → controller methods).
  - `src/controllers/` + `src/middleware/`: HTTP only. Parse/validate `req`, call a service, map results and domain errors (`src/errors.ts`) to status codes, JSON and cookies. No SQL.
  - `src/services/`: business rules and transactions (`sql.begin`). No `req`/`res`, no SQL text.
  - `src/repositories/`: SQL only. Take a `db: Db = sql` last parameter so services can pass a transaction; return typed plain objects.

## Working style
- Build features in small checkpoints of at most 50 lines each. Test files are exempt from the limit.
- Keep code as simple as possible while still efficient.
- Order: write the acceptance tests first, then go top-down: page → `client/src/api.ts` → route → controller → service → repository/DB.
- Each checkpoint stubs the next layer (real signature, `throw new Error('Not implemented')`) so every commit builds.
- After each checkpoint, stop: explain what the code does and the decisions in it, and wait for the user's pushback before starting the next one.
- Tag every checkpoint with its blast radius, i.e. how much existing code it can break. When unsure, pick the higher tag.
  - 🟢: new code in one place that nothing existing calls yet (a new file, a stub, a test). No existing signatures or behavior change. A mistake can't spread.
  - 🟡: wires a few files together (typically 2–3 adjacent layers, e.g. route → controller). Edits existing files only additively; no shared contract changes.
  - 🔴: touches many files or changes something shared: types used across layers, `src/errors.ts`, middleware, the axios instance in `client/src/api.ts`, DB schema/migrations, config, or folder structure. List every affected file in the plan, and run the full build and tests before committing.
- Present each checkpoint plan in this order:
  1. **What it achieves**, in plain words, including what's stubbed. Start with the blast-radius tag and one line on why it gets that tag.
  2. **Flow**: a small diagram of what calls what.
  3. **Existing code it uses**: the pre-existing code the change calls or relies on (types, functions, components), shown inline with a line on what each piece does.
  4. **The code**: `diff` blocks (green `+` lines) in call order, each with "Called by / Calls" notes, then a short "Decisions" list explaining each non-obvious choice.
- Commit after every checkpoint. Put the tag in the message, e.g. `Feat 1 Ticket 3: Checkpoint 4 🟡 - controller`.

## Sub-agents
- After back-end changes, use the `backend-reviewer` sub-agent (`.claude/agents/backend-reviewer.md`) to review them before committing.
- Before invoking it, ask the user to describe the feature they built (unless they already have) and include that description in the agent prompt.
- Show the agent's findings table to the user as-is.
