# Campi (React + Node) Resources

## Knowledge

- [react.dev: Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
  Official React docs on `useEffect`, cleanup timing and Strict Mode's double run. Use for: anything about effects; the `#fetching-data` section is the exact `ignore`/`stale` flag pattern NotePage uses.
- [react.dev: useEffect reference](https://react.dev/reference/react/useEffect)
  API reference for `useEffect`: the setup function, cleanup and dependency array. Use for: precise rules on when effects re-run.
- [MDN: AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
  The other way to handle a stale fetch: cancel it rather than ignore its result. Use for: when cancelling matters (big downloads, rate limits).

## Wisdom (Communities)

- [Reactiflux Discord](https://www.reactiflux.com/)
  Large, moderated React community with help channels. Use for: "is this effect pattern right?" questions and code critique.

## Gaps
- No vetted source yet for Postgres transactions/locks (a listed shaky area).
