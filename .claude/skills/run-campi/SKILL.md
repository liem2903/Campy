---
name: run-campi
description: Launch Campi (Express API + Vite client + local Supabase) and drive the auth flow in a real browser (sign up, /me, log out, log in, /me, log out) with screenshots. Use when asked to run, start, screenshot, or end-to-end check the app.
---

# Run Campi end to end

Put all logs, screenshots and installs in the session scratchpad (`$S` below), never in the repo.

## 1. Database
`docker ps --format '{{.Names}}' | grep -q supabase_db_Campi || npm run db:start`

## 2. Servers (port 3100, not 3000)
Port 3000 can be held by an unresponsive Windows/WSL listener: curl hangs and the API dies with EADDRINUSE. Use 3100 for both servers; the Vite proxy reads the same `PORT`.
```bash
(PORT=3100 npm run dev > $S/server.log 2>&1 &)
(PORT=3100 npm run dev:client > $S/client.log 2>&1 &)
for i in $(seq 30); do curl -s -m 2 localhost:3100/health >/dev/null && break; sleep 1; done
curl -s -m 3 localhost:5173/api/auth/me   # expect {"error":"You're not logged in"}
```
Always use `curl -m` so a dead port can't hang the shell. To stop servers, find PIDs with `ps -eo pid,args | grep -E '[v]ite|[t]sx watch'` and `kill` them. Never `pkill -f vite`: the pattern matches the shell running the command and kills it.

## 3. Playwright (once per scratchpad)
Not a project dependency. Install it next to the logs, and use the Chromium already cached on this machine:
```bash
mkdir -p $S/pw && cd $S/pw && npm init -y >/dev/null && npm i playwright-core@1.55.0
CHROME=$(ls ~/.cache/ms-playwright/chromium-1228/chrome-linux*/chrome)
```

## 4. Drive the flow
```bash
node .claude/skills/run-campi/scripts/auth-flow.mjs $S/shots "$CHROME" --pw $S/pw
```
It exits non-zero on any wrong status code or cookie state. Expected: signup 201, login 200, logout 204, /me 200 while logged in and 401 after logout. The `sid` cookie is `Secure`, which Chromium still sends on `http://localhost`. GETs to /me that return 401 on /signup and /login are normal: the client checks the session on every page load.

## 5. Check and share
Look at the screenshots yourself (03 = workspace after signup, 06 = filled login form, 10 = 401 JSON). A blank frame means it failed. If the user wants a link, publish an HTML page with the PNGs embedded as data URIs.

Each run leaves an `e2e-<timestamp>@example.com` user in the local DB; `npm run db:reset` clears it.
