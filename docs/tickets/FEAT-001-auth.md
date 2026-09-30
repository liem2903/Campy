# FEAT-001 - auth

**Sprint:** 1 · **Branch:** `feature/auth` (from `main`) · **Created:** 2026-09-30

## Context

Campi needs real authentication for Sprint 1. The schema already supports self-managed auth:
`users.password_hash`, a table of hashed tokens, RLS enabled with no policies, and Express
connecting as `postgres`. There is no server auth code or DB client yet, and
`client/src/pages/LoginPage.tsx` is a stub.

We build our own auth instead of using Supabase Auth; Supabase is only the Postgres host. It
should be ready for real users eventually.

The work is split into **four tracer-bullet tickets, one per endpoint**. Each one is a thin
slice through DB → API → UI → test that runs and demos on its own. Shared setup goes into the
first ticket that needs it.

**Out of scope:** Railway deploy, password reset, email verification, log out everywhere,
change password, breached-password check.

## Shared decisions (apply to every ticket)

| Area | Decision |
|---|---|
| Sessions | Opaque 32-byte base64url token. Only its SHA-256 hash is stored in `sessions`. Sliding 30-day expiry; `expires_at` is bumped at most once a day. |
| Cookie | `sid`, `httpOnly; Secure; SameSite=Lax; Path=/` |
| CSRF | SameSite=Lax, plus mutating `/api` requests must be `Content-Type: application/json` (otherwise 415) |
| Password hashing | argon2id via `argon2` (fallback: `crypto.scrypt`) |
| Password policy | 8–128 characters, no composition rules |
| Rate limiting | `express-rate-limit`, in-memory store, limiters created inside `createApp()` |
| Proxy | `app.set('trust proxy', TRUST_PROXY)`: off locally, `1` on Railway |
| DB client | `postgres` (postgres.js) tagged-template queries |
| Env | `--env-file-if-exists=.env` in `dev`/`test` scripts. Fail fast if `DATABASE_URL` is missing. On Railway, use the Supabase **session pooler** URL (IPv4). |
| Tests | Jest + ts-jest (ESM preset, `NODE_OPTIONS=--experimental-vm-modules`, `moduleNameMapper` stripping `.js`) + Supertest, in top-level `test/`. They run against local Supabase and use unique `test-<uuid>@example.com` users that are deleted afterwards. |
| Enumeration | Login always says "Invalid email or password". Signup returns 409 for a taken email (accepted until email verification exists). |
| Ownership | `requireAuth` sets `req.user`. All note/block queries are scoped by `user_id`, and another user's note returns 404. |

### Definition of done (every ticket)
- [ ] Acceptance tests written and passing (`npm test`)
- [ ] `npm run build` passes (strict TS, no `any`)
- [ ] Demo path works in `npm run dev:all`
- [ ] Feature described by the developer, `backend-reviewer` sub-agent run, findings addressed
- [ ] Committed on `feature/auth`

---

## Ticket 1: Sign up (carries the foundation)

**Slice:** A new user fills in `/signup`. The account is created, they're logged in with a
session cookie, and they land in the workspace.

### Foundation
- [ ] Edit `supabase/migrations/20260929103133_create_users.sql`. This is allowed **only because
  it has not been pushed yet**.
  - Rename `refresh_tokens` → `sessions` (and `refresh_tokens_user_id_idx` → `sessions_user_id_idx`)
  - Add `last_used_at timestamptz not null default now()`
- [ ] Update `src/db/types.ts`: `RefreshToken` → `Session` (add `last_used_at`)
- [ ] `npm run db:start` + `npm run db:reset`
- [ ] Add `postgres` dependency and create `src/db/client.ts` (reads `DATABASE_URL`, fails fast)
- [ ] Add `TRUST_PROXY` to `.env.example`, and add `--env-file-if-exists=.env` to the `dev` script
- [ ] Split `src/index.ts` → `src/app.ts` (`createApp()`) + `src/index.ts` (`listen` only)
- [ ] Unknown `/api/*` routes return 404 JSON instead of the SPA fallback
- [ ] Jest + ts-jest + Supertest setup, `test/` folder with its own tsconfig, `npm test` script

### Feature
- [ ] `src/auth/password.ts`: argon2id hash/verify
- [ ] `src/auth/sessions.ts`: create a session (random token, store hash, set cookie)
- [ ] `POST /api/auth/signup`: validate the email and password policy, 409 on a taken email,
  creates the user and logs them in; signup limiter 5/hour per IP
- [ ] Client: `/signup` page (email + password), link from `LoginPage`, redirect to `/` on success

### Acceptance tests
- [ ] Valid signup → 201 + `Set-Cookie` with `HttpOnly`, `Secure`, `SameSite=Lax`
- [ ] `users` row stores an argon2 hash, never the raw password
- [ ] Duplicate email (including a different case) → 409
- [ ] Invalid email or 7-char password → 400
- [ ] Non-JSON body → 415
- [ ] 6th signup in an hour from one IP → 429

**Demo:** `npm run dev:all` → sign up → workspace; the `sid` cookie is visible in devtools.

---

## Ticket 2: Who am I (`/me`) + route protection + ownership

**Slice:** The session cookie is recognized. A reload keeps you logged in, a missing cookie
sends you to `/login`, and notes are scoped to their owner.

### Tasks
- [ ] `src/auth/requireAuth.ts`: hash the cookie, look up an unexpired and unrevoked session,
  set `req.user`, sliding bump at most daily (updates `expires_at` and `last_used_at`)
- [ ] `GET /api/auth/me` → `{ id, email }` or 401
- [ ] Apply `requireAuth` + `user_id` scoping to any existing notes/blocks routes (blocks scoped
  via a join to `notes`); another user's note → 404
- [ ] Client: `client/src/AuthProvider.tsx` (calls `/api/auth/me` on load; state
  `user | null | loading`)
- [ ] Client: `RequireAuth` wrapper around the `Workspace` route in `client/src/App.tsx`; blank or
  loading state while pending (no login flash)
- [ ] Client: any 401 from the API → redirect to `/login`

### Acceptance tests
- [ ] No cookie → 401
- [ ] Garbage cookie → 401
- [ ] Expired session → 401
- [ ] Revoked session → 401
- [ ] Valid session → 200 with the correct user
- [ ] Sliding bump only writes when `expires_at` was last bumped more than a day ago
- [ ] Cross-user note access → 404 (once notes routes exist)

**Demo:** Sign up → reload stays in the workspace; delete the cookie → `/` redirects to `/login`.

---

## Ticket 3: Log in

**Slice:** An existing user logs in from `/login` and lands in the workspace.

### Tasks
- [ ] `POST /api/auth/login`:
  - Always responds "Invalid email or password" on failure
  - Runs a dummy argon2 verify when the email doesn't exist (timing parity)
  - Deletes that user's expired sessions opportunistically
  - Limiters: 5 per 15 min per IP+email, 20 per 15 min per IP
- [ ] Client: wire `LoginPage` to the API, show the error message, redirect to `/` (or the
  originally requested page)

### Acceptance tests
- [ ] Correct credentials → 200 + cookie that works on `/api/auth/me`
- [ ] Wrong password and unknown email → both 401 with an identical body
- [ ] Email matched case-insensitively
- [ ] 6th bad attempt for one email within 15 min → 429
- [ ] Expired sessions for that user are deleted on login

**Demo:** Log in with the Ticket 1 account; a wrong password shows the error.

---

## Ticket 4: Log out (+ hosted DB push)

**Slice:** Clicking logout ends the session on the server and returns you to `/login`.

### Tasks
- [ ] `POST /api/auth/logout`: set `revoked_at` on the current session, clear the cookie,
  idempotent (204 even without a session)
- [ ] Client: logout button in `Sidebar`; clears the `AuthProvider` user and navigates to `/login`
- [ ] After merge: create the hosted Supabase project (developer) → `supabase link` →
  `npm run db:push`. **The migration is frozen from here; later changes need new migrations.**

### Acceptance tests
- [ ] After logout, the old cookie → 401 on `/api/auth/me`
- [ ] Logout response clears the `sid` cookie
- [ ] Logout with no cookie → 204

**Demo:** Log in → log out → reload or back button stays on `/login`.

---

## Overall verification (after Ticket 4)
- [ ] Full flow in `npm run dev:all`: sign up → reload → log out → log in → 6 bad logins → 429
- [ ] `npm run build` and `npm test` pass
- [ ] `curl localhost:3000/api/auth/me` without a cookie → 401
