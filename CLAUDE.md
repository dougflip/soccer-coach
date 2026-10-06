# Soccer Coach

PWA for youth soccer coaches to track lineups, playing time and positions.
Start with `high-level-design.md` (goals, key decisions), then `design-doc.html` (UX), then
`arch-doc.md` (architecture, phasing). Phase 1 = Supabase + basic sync (no realtime).

## Commands

- `npm run check`: typecheck + lint + format check (run before every commit)
- `npm run test:run`: unit tests (`npm test` for watch)
- `npm run format`: apply formatting
- `npm run dev` / `npm run build`

## Dependencies

Always install latest via `npm i <pkg>` (no versions from memory). Read the package's
current docs before writing config; APIs move fast (Vite 8, TS 7, zod 4, oxlint).

## Architecture rules

1. **Domain logic lives in `src/domain/`**: pure TS, no React/DOM/storage imports,
   heavily unit-tested. Components stay thin and call into it.
2. A game is an **append-only event log** (`src/domain/events.ts`). All state (lineups,
   clock, stats) is derived. Never mutate an event; corrections = `event_voided` + replacement.
3. Game-clock time (`GameTime`: period + ms) drives stats. Wall time is only for
   clock-control events.
4. Side effects (IDs, `Date.now`) are injected (`CommandContext`) so domain code is deterministic.

## TypeScript

1. Strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, etc.). No `any`; use
   `unknown` + narrowing. No `!` outside tests.
2. Discriminated unions + exhaustive `switch` with `assertNever`.
3. zod validates at boundaries (storage, network, imports); types inferred from schemas.
   Trust types inside.
4. Branded IDs (`PlayerId`, `GameId`, ...) from `src/domain/ids.ts`, applied only by schemas.
5. `type` over `interface`. Avoid `as`; if unavoidable, add a comment and an
   `oxlint-disable-next-line` explaining why.

## React

1. React 19 + React Compiler: don't add `useMemo`/`useCallback` by hand.
2. No `useEffect` for derived state; compute during render. Effects only for real side
   effects (wake lock, sync, timers).
3. State: local DB is the source of truth for persisted data; `useState`/`useReducer` for
   UI; context only for app-wide (auth, current team). No Redux/Zustand.
4. Named exports only. Feature/page folders (`src/features/<name>/`), shared `src/ui/`.
5. Styling: CSS Modules + custom properties from `src/tokens.css`. No raw colors in modules.
6. Accessibility: real `<button>`s, labels; jsx-a11y lint rules on.

## Workflow

- CI runs check, tests and build on every PR. No pre-commit hooks.
- Commit messages explain the "why".
