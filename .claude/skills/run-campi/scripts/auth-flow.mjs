// Drives Campi's auth flow in Chromium and checks every status and cookie.
// Usage: node auth-flow.mjs <outDir> <chromePath> --pw <dir with playwright-core> [--base http://localhost:5173]
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({ allowPositionals: true, options: { pw: { type: 'string' }, base: { type: 'string', default: 'http://localhost:5173' } } })
const [outDir, chromePath] = positionals
if (!outDir || !chromePath || !values.pw) {
  console.error('Usage: node auth-flow.mjs <outDir> <chromePath> --pw <dir> [--base <url>]')
  process.exit(2)
}
// ESM ignores NODE_PATH, so load Playwright from the scratchpad install explicitly.
const { chromium } = createRequire(join(values.pw, 'package.json'))('playwright-core')
const BASE = values.base
mkdirSync(outDir, { recursive: true })

const failures = []
const expect = (label, actual, wanted) => {
  const ok = actual === wanted
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${actual}${ok ? '' : ` (expected ${wanted})`}`)
  if (!ok) failures.push(label)
}

const browser = await chromium.launch({ executablePath: chromePath })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
const requests = []
page.on('response', (r) => {
  if (r.url().includes('/api/auth/')) requests.push(`${r.request().method()} ${new URL(r.url()).pathname} -> ${r.status()}`)
})

let n = 0
const shot = async (p, name) => {
  await p.waitForTimeout(400)
  await p.screenshot({ path: join(outDir, `${String(++n).padStart(2, '0')}-${name}.png`) })
}
const hasSid = async () => (await ctx.cookies()).some((c) => c.name === 'sid')
// Waits for the response a click triggers, so the status is checked for that exact request.
const submit = async (path, selector) => {
  const [res] = await Promise.all([page.waitForResponse((r) => r.url().endsWith(path)), page.click(selector)])
  return res.status()
}
const checkMe = async (name, wanted) => {
  const tab = await ctx.newPage()
  const res = await tab.goto(`${BASE}/api/auth/me`)
  expect(`GET /me (${name})`, res.status(), wanted)
  await shot(tab, name)
  await tab.close()
}
const fillForm = async () => {
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', password)
}

const email = `e2e-${Date.now()}@example.com`
const password = 'correct-horse-battery-9'

try {
  await page.goto(`${BASE}/signup`)
  await page.waitForSelector('input[type=email]')
  await shot(page, 'signup-form')
  await fillForm()
  await shot(page, 'signup-filled')
  expect('POST /signup', await submit('/api/auth/signup', 'button[type=submit]'), 201)
  await page.getByText('Log out').waitFor()
  await shot(page, 'after-signup-workspace')
  expect('sid cookie after signup', await hasSid(), true)
  await checkMe('me-after-signup', 200)

  expect('POST /logout', await submit('/api/auth/logout', 'text=Log out'), 204)
  await page.waitForURL('**/login')
  await shot(page, 'after-first-logout')
  expect('sid cookie after logout', await hasSid(), false)

  await fillForm()
  await shot(page, 'login-filled')
  expect('POST /login', await submit('/api/auth/login', 'button[type=submit]'), 200)
  await page.getByText('Log out').waitFor()
  await shot(page, 'after-login-workspace')
  expect('sid cookie after login', await hasSid(), true)
  await checkMe('me-after-login', 200)

  expect('POST /logout (2nd)', await submit('/api/auth/logout', 'text=Log out'), 204)
  await page.waitForURL('**/login')
  await shot(page, 'after-logout')
  expect('sid cookie after 2nd logout', await hasSid(), false)
  await checkMe('me-after-logout', 401)

  await page.goto(BASE)
  await page.waitForURL('**/login')
  await shot(page, 'root-redirects-to-login')
} catch (err) {
  failures.push(`crashed: ${err instanceof Error ? err.message : String(err)}`)
  await shot(page, 'crash').catch(() => {})
} finally {
  await browser.close()
}

console.log(`\nAccount: ${email}\nAuth requests:\n  ${requests.join('\n  ')}`)
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log(`\nAll checks passed. Screenshots in ${outDir}`)
