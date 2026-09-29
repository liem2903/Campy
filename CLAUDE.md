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

## Sub-agents
- After back-end changes, use the `backend-reviewer` sub-agent (`.claude/agents/backend-reviewer.md`) to review them before committing.
- Before invoking it, ask the user to describe the feature they built (unless they already have) and include that description in the agent prompt.
- Show the agent's findings table to the user as-is.
