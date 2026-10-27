# Campi

Campi is a note-taking app built around one idea: reading your notes isn't the same as knowing them. You write notes like you would anywhere else, and then Campi gives you a few ways to actually test yourself on them.

It's live at a Railway URL for now (no custom domain yet).

## What you can do

**Write notes.** A clean page with a title and a body. Type `- ` or `1. ` to start a list, and Tab / Shift+Tab to nest it. Everything saves as you type.

**Write questions beside your notes.** Like the cue column in Cornell notes: next to your notes you jot down a question and its answer (Ctrl+Alt+M). Each question sits beside the part of the note it's about.

**Quiz yourself on a note.** Run through one note's questions: think of the answer (or type it), flip it, and mark yourself right or wrong.

**Study with flashcards.** All your questions from every note become flashcards with spaced repetition, like Anki. Cards you get right come back later; cards you miss come back sooner. You only see what's due today.

**Blurt.** Pick a note, and Campi hides it. Write down everything you can remember, then reveal the note next to what you wrote and see what you missed.

**Organise with tags.** Tag notes by topic, then filter your notes or study only the flashcards for one tag (handy before an exam on one subject).

Press `?` (when you're not typing) to see every keyboard shortcut.

### Not there yet

Campi doesn't use AI yet. You write your own questions, and you check your own blurts. AI-generated questions and feedback might come later. Folders are planned too.

## Built with

- **Back end:** TypeScript, Node.js, Express, with Postgres on [Supabase](https://supabase.com)
- **Front end:** React, Vite, Tailwind, and [TipTap](https://tiptap.dev) for the editor
- **Hosting:** one Railway service. Express serves both the API and the built front end.

## Getting started

### Prerequisites

- Node.js 22+ and npm
- Docker (for the local database)

### Install

The front end lives in `client/` and has its own dependencies, so install both:

```bash
npm install
npm install --prefix client
```

### Run in development (auto-reload)

```bash
npm run dev:all
```

This starts the Express API on `http://localhost:3000` and the Vite dev server on `http://localhost:5173`. Open **http://localhost:5173** — requests to `/api/*` are proxied to Express. You can also run them separately with `npm run dev` (server) and `npm run dev:client` (client).

If port 3000 is taken, set `PORT` (e.g. `PORT=3001 npm run dev:all`). The Vite proxy reads the same variable.

### Build and run

```bash
npm run build
npm start
```

This builds the server and the client, then Express serves both the API and the built front end on `http://localhost:3000` (override with the `PORT` env var). Check that the API is up with:

```bash
curl http://localhost:3000/api/health
```

## Database

Campi uses [Supabase](https://supabase.com) Postgres. The schema is versioned as plain SQL migrations in `supabase/migrations/`, which run in filename (timestamp) order. The same files are applied locally and in production.

### Local database

```bash
cp .env.example .env   # first time only
npm run db:start       # starts local Supabase in Docker (Postgres on port 54322)
npm run db:stop        # stops it
```

`npm run db:start` also prints a local Studio URL where you can browse the data.

### Adding a migration

```bash
npm run db:new -- create_users   # creates supabase/migrations/<timestamp>_create_users.sql
# write your SQL in that file, then:
npm run db:reset                 # rebuilds the local DB from all migrations
```

Never edit a migration that has already been applied (pushed or shared). Add a new migration to change the schema.

### Production (hosted Supabase)

One-time setup: create a project in the Supabase dashboard, then:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

Apply pending migrations to the hosted database:

```bash
npm run db:push
```

## Deploying (Railway)

Campi runs as a single Railway service, deployed from the `main` branch. Every push to `main` redeploys it.

- **Build:** `npm run build` (installs the client's dependencies, then builds the server and the client)
- **Start:** `npm start`
- **Variables:** `DATABASE_URL` (the Supabase **session pooler** string, not the direct one) and `TRUST_PROXY=1`. Railway sets `PORT` itself.
- **Domain:** service → Settings → Networking → Generate Domain, pointed at the port the app logs on startup.

Railway only deploys code. If you've added a migration, run `npm run db:push` too.
