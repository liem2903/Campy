# Campi

Campi is a note-taking app with built-in AI study tools. Write your notes, then use them to actually learn the material through blurting practice, active-recall quizzes, and flashcards — graded against criteria you define.

## Features

- **Note taking** – create, edit, organize, and delete notes.
- **Authentication** – user accounts so your notes stay private to you.
- **Blurting practice** – write down everything you remember about a note from memory; AI compares your attempt against the original and highlights what you missed.
- **Active recall quizzing** – AI generates quiz questions from your notes to test understanding.
- **Flashcards** – automatically generate flashcards from your notes for review.
- **Custom grading criteria** – define your own criteria for what counts as "correct" or "complete", and have your blurts and quiz answers marked against them.

## Roadmap

### Sprint 1 — Core notes + authentication
- Basic note CRUD (create, read, update, delete)
- User sign-up / login
- Notes scoped to the authenticated user

### Sprint 2 — AI features
- Blurting practice with AI feedback
- AI-generated active recall quizzes
- AI-generated flashcards
- User-defined marking criteria

### Sprint 3 — Concurrency
- Support concurrent access and editing (e.g. multiple sessions/users working on notes at the same time) safely and consistently

## Tech stack

- TypeScript
- Node.js + Express

## Getting started

### Prerequisites

- Node.js 22+ and npm

### Install

```bash
npm install
```

The front end lives in `client/` (Vite + React + TypeScript) and has its own dependencies:

```bash
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
