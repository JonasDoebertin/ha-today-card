# What the test suite found

Date: 2026-09-18

The suite was written to pin today's behaviour, not to change it. Nothing in
`src/` was modified. Three things came up that are worth a decision, plus one
observation. Each is recorded in the test that touches it, so the code and the
note cannot drift apart.

## 1. `end` decides which field to read by looking at `start`

`src/structs/event.ts:57` — the `end` getter branches on
`this.rawEvent.start.date`:

```typescript
if (this.rawEvent.start.date) {
    this.cachedEnd = dayjs(this.rawEvent.end.date).subtract(1, "day").endOf("day");
} else {
    this.cachedEnd = dayjs(this.rawEvent.end.dateTime);
}
```

For an event with a dated start and a timed end, `this.rawEvent.end.date` is
`undefined`, and `dayjs(undefined)` returns the current moment. The event then
ends the day before today, whatever its real end was.

**Reproduction** — `tests/structs/event.test.ts`, "a payload with a dated start
and a timed end loses its end". With the clock at 2026-09-18 and a raw event of
`{start: {date: "2026-09-17"}, end: {dateTime: "2026-09-19T02:00:00Z"}}`, `end`
is 2026-09-17 23:59:59.999 and `isMultiDay` is `false`.

**Severity: low.** Home Assistant's calendar API does not mix the two forms, so
no user is hitting this. It is worth noting that this also makes the third
branch of `isAllDay` (`isMultiDay && !isFirstDay && !isLastDay`) unreachable in
practice, since the first two branches cover every payload that actually
arrives. If that branch was meant to catch something, it is not catching it.

**Suggested fix if you want one:** branch on `this.rawEvent.end.date` in the
`end` getter, as `start` already does for its own field.

## 2. Three language files are missing keys

`error.title` is missing from `es`, `fr` and `it`. `config.label.exclude` is
missing from `fr` and `it`. German is complete.

**Reproduction** — `tests/localization/localize.test.ts`, the "language parity"
block. The current gaps are listed in the `KNOWN_GAPS` constant there.

**Severity: cosmetic, but user-visible.** `localize` falls back to English, so
Spanish, French and Italian users see "Calendar unavailable" and an English
field label in an otherwise translated card. That is the designed fallback
rather than a failure.

**Action needed:** when a translation is added, shorten `KNOWN_GAPS` — the
parity test fails until the list matches reality, in both directions. Any newly
added English key that nobody has translated fails the suite immediately, which
is the point.

## 3. The entity editor ignores the `hass` it is handed

`src/elements/entity-editor.ts` declares `@property({attribute: false}) public
hass!: HomeAssistant` and passes it down to the pickers, but resolves the row
labels through `getEntityName`, which reads the module-level singleton in
`src/globals.ts` instead.

**Reproduction** — `tests/elements/entity-editor.test.ts`, "falls back to the
entity id when only its own hass property is set". Mounted with a populated
`hass` property but no singleton, every row shows its raw entity id.

**Severity: low, latent.** Nothing is broken today because the parent editor
calls `setHass` in its `render` before the list renders. It is a hidden
ordering dependency between two components rather than a visible bug, and it is
the kind of thing that breaks quietly if the elements are ever reordered or one
is reused elsewhere.

## Observation: an unreachable guard

`src/common/action-handler.ts:46` checks `if (!actionHandler) { return; }`, but
`getActionHandler` either finds the element or creates one, so it never returns
a falsy value. Harmless, and not worth a change on its own.

## Coverage

97% of functions and 99.5% of lines in `src/` are executed by the suite, which
runs in well under a second. No threshold is enforced in CI; a floor is worth
setting deliberately now that the real number is known, rather than being
inherited from whatever today happened to measure.
