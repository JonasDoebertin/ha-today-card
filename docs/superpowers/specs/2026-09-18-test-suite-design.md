# Test Suite Design

Date: 2026-09-18
Status: approved

## Problem

The project ships a Lovelace card with no automated tests. Its densest logic
is date arithmetic — all-day versus timed events, multi-day spans, `advance`
offsets, "is this in the past" — which is exactly the kind of code that breaks
quietly and is tedious to verify by hand in a running Home Assistant. Several
source comments already record regressions that a test would have caught: the
`isInPast` offset bug that hid tomorrow's morning meeting, the empty `exclude`
pattern that blanked a whole calendar, the empty-string colour that leaked
through the editor.

## Scope

Two layers, both running under one test runner:

1. **Unit** — pure functions, the `CalendarEvent` model, and the `getEvents`
   pipeline exercised through its public entry point.
2. **Component** — the three Lit elements rendered in a DOM, asserting on their
   output and on the events they fire.

Out of scope: a real browser (Playwright against the built bundle) and
end-to-end tests against a running Home Assistant. Both were considered and
deferred; see "Deliberate gaps".

## Runner

`bun test`.

Verified by probe before this design was written:

- TypeScript, `experimentalDecorators` and `useDefineForClassFields: false`
  work without configuration, so Lit's `@customElement` and `@state` behave.
- `import styles from "./card.css"` resolves in the test runtime, so no loader
  shim is needed.
- The JSON language files import as expected.
- `setSystemTime()` freezes the clock that `dayjs()` reads.
- `process.env.TZ` can be reassigned mid-run (a 12-hour shift was measured),
  so timezone behaviour can be tested directly rather than by spawning
  processes.
- Coverage is built in.

Alternatives rejected:

- **Vitest** — more mature ecosystem, but pulls the Vite toolchain into a
  project that deliberately runs on Bun alone, for no capability this suite
  needs.
- **@web/test-runner + Playwright** — the canonical Lit setup and the only way
  to get real browser semantics, but it is a second toolchain and roughly an
  order of magnitude slower. The Home Assistant elements the card renders into
  do not exist in that browser either, so most of its fidelity advantage is
  unrealised here.

New dev dependencies: `@happy-dom/global-registrator` and `@types/bun`.

## Layout

```
bunfig.toml                    # [test] preload
tests/
  support/
    setup.ts                   # TZ pinning, happy-dom, HA element stubs, globals reset
    factories.ts               # builders for raw events, card config, fake hass
    mount.ts                   # mount an element and await its update
  functions/
    colors.test.ts
    config.test.ts
    calendar.test.ts
  structs/
    event.test.ts
    event.timezone.test.ts
    config.test.ts
    action.test.ts
  localization/
    localize.test.ts
  common/
    fire-event.test.ts
    handle-action.test.ts
  elements/
    card.test.ts
    editor.test.ts
    entity-editor.test.ts
```

The tree mirrors `src/`, so the test for a file is where its path says it is.

`tests/support/setup.ts` is loaded via `bunfig.toml` preload and does four
things: pin `TZ` to UTC, register happy-dom globally, define stand-ins for the Home Assistant elements the card
renders into, and reset the `globals.ts` hass singleton between files. The
`action-handler` stub is not optional — without it `card.ts` throws during
render, since the real element is supplied by Home Assistant.

## Coverage by area

### `structs/event.ts`

- `start` / `end` for `date` and `dateTime` forms, including Home Assistant's
  exclusive all-day `end` (the `subtract(1, "day")` rule).
- `isAllDay` across all three branches, `isMultiDay`, `isFirstDay`,
  `isLastDay`, `numberOfDays`, `currentDay`, each with and without `advance`.
- `timeSchedule` in all four branches: multi-day first day with a time,
  multi-day last day with a time, a plain timed range, and the `null` case.
- `daySchedule` formatting.
- `isInPast` / `isInFuture` / `isCurrent` against a frozen clock, including the
  documented regression: with `advance: 1`, tomorrow's 09:00 event must not be
  treated as past at 09:01 today.
- `id` falling back from `id` to `uid`; `title`, `description`, `location`,
  `color` defaults.

### `functions/calendar.ts`

Exercised through `getEvents()` with a fake `hass.callApi`, so the tests
describe behaviour rather than the private helpers.

- The requested window, including the `advance` offset.
- Filtering: `show_all_day_events`, `show_past_events`, and all-day events that
  ended before the displayed day.
- `exclude`: case-insensitive substring, `/pattern/flags` regex, an invalid
  regex falling back to matching its body as text, a blank pattern that must
  not hide the calendar, and matching against `description` as well as `title`.
- Sorting: all-day events before timed ones, ordered by span length, then by
  current day, then by title; timed events by start then end; the anchors used
  for multi-day events that neither start nor end today.
- `limit` for `0`, `null`, negative and positive values.
- A calendar whose fetch rejects appears in `failed` while the other calendars'
  events still arrive.

### Remaining unit areas

- `functions/colors.ts` — theme names mapped to CSS variables, hex passed
  through, empty and undefined falling back to primary, `getFallBackColor`
  wrapping around its list.
- `functions/config.ts` — `processEditorEntities` for string and object
  entries, with and without colour assignment, treating `""` as absent, and
  dropping non-calendar entities; `getEntityName` with and without hass;
  `isEqual` for nested objects, arrays and differing key counts.
- `localization/localize.ts` — a known key, a key missing from a non-English
  language falling back to English, an unknown key returned raw, an unknown
  language, and the `en-GB` alias. Plus a parity test reporting any key present
  in `en.json` but missing from `de`, `es`, `fr` or `it`.
- `structs/config.ts` and `structs/action.ts` — valid configurations accepted,
  a negative `limit` rejected, both `entities` forms accepted, and the
  `dynamic` action struct resolving to the right variant per action type.
- `common/fire-event.ts` and `common/handle-action.ts` — event name, detail
  payload, and the `bubbles` / `composed` defaults.

### Elements

- **card** — the fallback row when nothing is scheduled; event rows carrying
  the CSS class hooks that card-mod users style against; the error row
  replacing the empty-state message when a calendar fails, with friendly
  names resolved; `role` and `tabindex` present only when `tap_action` is
  actionable; `getCardSize`; `getStubConfig` and `getEntitySuggestion`
  filtering on the `calendar.` domain; the refresh interval installed on
  connect and cleared on disconnect; an invalid config rejected by `setConfig`.
- **editor** — `exclude` joined into the text field and split back out with
  trimming, blank lines dropped and an empty array omitted from the saved
  config; no `config-changed` fired when nothing actually changed.
- **entity-editor** — one row per entity; changing a colour; clearing a colour
  removing the key rather than storing `""`; a duplicate calendar ignored; the
  picker reset after use; row removal including the out-of-range guard.

## Time and timezone

Anything that reads the clock runs under `setSystemTime()` with an explicit
instant, so no test depends on when it runs.

`setup.ts` pins `TZ` to UTC unconditionally, making the suite deterministic
whatever zone the shell that started it was in. `tests/structs/event.timezone.test.ts`
then switches deliberately to `Europe/Berlin` and `Pacific/Auckland` and checks
the all-day and multi-day interpretation there, because that is where the real
risk sits: an event marked all-day on the 18th must not start on the 17th in
Auckland.

## Tooling and CI

- `package.json` gains `test` (`bun test`) and `test:coverage`
  (`bun test --coverage`).
- `tsconfig.json` adds `tests/**/*` to `include` and `bun` to `types`, so
  `bun run typecheck` checks the tests under the same strict settings as the
  source.
- `bunfig.toml` preloads `tests/support/setup.ts` so a bare `bun test` works.
- `.github/workflows/build.yml` runs the suite between `Typecheck` and `Build`,
  in the existing job. The suite runs in well under a second, so no separate
  job is warranted.
- `.github/workflows/release.yml` runs the suite before building the artifact,
  so a tag cannot publish a bundle whose tests fail.
- Coverage is reported, not enforced. A floor is worth setting once the real
  number is known; picking one in advance would be arbitrary.

## Deliberate gaps

- happy-dom is not a browser. Layout, the real CSS cascade and
  `adoptedStyleSheets` semantics are not covered. Closing that needs a
  Playwright layer against the built bundle, which is a separate decision.
- The Home Assistant element stubs can drift from the real components. They are
  kept minimal on purpose so that drift stays visible rather than being papered
  over by an elaborate fake.
- These tests pin today's behaviour. Where that behaviour turns out to be
  wrong, the defect is reported with a reproduction rather than fixed here, so
  that this change adds tests and changes nothing about how the card behaves.
