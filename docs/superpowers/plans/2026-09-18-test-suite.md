# Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the card a unit and component test suite that runs in CI on every push, pull request and release tag.

**Architecture:** One runner, `bun test`, with `@happy-dom/global-registrator` supplying a DOM for the three Lit elements. Tests mirror `src/` under `tests/`. A preloaded `tests/support/setup.ts` pins the timezone, registers happy-dom, and defines stand-ins for the Home Assistant elements the card renders into. Logic that reads the clock is tested under a frozen clock; the `getEvents` pipeline is tested through its public entry point with a fake `hass`.

**Tech Stack:** Bun 1.4, `bun:test`, happy-dom, Lit 3, Day.js, Superstruct, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-09-18-test-suite-design.md`

## Global Constraints

- Formatting is checked in CI. Run `bun run format:fix` before committing; Prettier config is 4-space indent, no bracket spacing, operators at line start.
- `tsconfig.json` is strict, including `noUnusedLocals`, `noUnusedParameters` and `noUncheckedIndexedAccess`. Test files are type-checked under the same settings.
- Import Lit subpath modules with an explicit `.js` extension (`lit/decorators.js`).
- These tests pin today's behaviour. If a test that encodes the obviously correct expectation fails, do **not** change `src/`. Record the finding (file, reproduction, what happened, what was expected), assert the actual behaviour so the suite stays green and honest, and mark the assertion with a comment pointing at the finding. The findings list is delivered in Task 14.
- Never assert against the real clock. Every test whose outcome depends on "now" calls `setSystemTime()` with an explicit instant.
- Node's `Date` parses `"2026-09-18"` as UTC midnight but `"2026-09-18T00:00:00"` as local midnight. Day.js inherits this. Write fixtures deliberately.

---

### Task 1: Test harness and CI wiring

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `.github/workflows/build.yml`
- Modify: `.github/workflows/release.yml`
- Create: `bunfig.toml`
- Create: `tests/support/setup.ts`
- Create: `tests/support/factories.ts`
- Create: `tests/support/mount.ts`
- Test: `tests/support/harness.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `rawTimedEvent(overrides?)`, `rawAllDayEvent(overrides?)`, `cardConfig(overrides?)`, `entityRow(entity, color?)`, `fakeHass(overrides?)`, `calendarApi(responses)` from `tests/support/factories.ts`; `mount<T>(tag, props)` and `flush()` from `tests/support/mount.ts`. Every later task uses these.

- [ ] **Step 1: Add the dev dependencies**

```bash
bun add -d @happy-dom/global-registrator @types/bun
```

- [ ] **Step 2: Create `bunfig.toml`**

```toml
[test]
preload = ["./tests/support/setup.ts"]
coverageReporter = ["text"]
```

- [ ] **Step 3: Create `tests/support/setup.ts`**

`TZ` is pinned before anything imports Day.js so every run agrees on what
midnight means. The Home Assistant elements are stubs on purpose: `ha-card`
and `ha-ripple` only need to exist for Lit to render into, and
`action-handler` needs a `bind` method or `card.ts` throws mid-render.

```typescript
import {afterEach} from "bun:test";
import {GlobalRegistrator} from "@happy-dom/global-registrator";
import {setHass} from "../../src/globals";

process.env.TZ = process.env.TZ || "UTC";

GlobalRegistrator.register();

class HaCardStub extends HTMLElement {}
class HaRippleStub extends HTMLElement {}
class HaFormStub extends HTMLElement {}
class HaExpansionPanelStub extends HTMLElement {}
class HaSvgIconStub extends HTMLElement {}
class HaColorPickerStub extends HTMLElement {}
class HaIconButtonStub extends HTMLElement {}
class HaEntityPickerStub extends HTMLElement {}

// Home Assistant supplies this one at runtime. The card binds to it during
// render, so without a `bind` method every render of an actionable card
// throws.
class ActionHandlerStub extends HTMLElement {
    public bound: Element[] = [];

    bind(element: Element): void {
        this.bound.push(element);
    }
}

const stubs: Record<string, CustomElementConstructor> = {
    "ha-card": HaCardStub,
    "ha-ripple": HaRippleStub,
    "ha-form": HaFormStub,
    "ha-expansion-panel": HaExpansionPanelStub,
    "ha-svg-icon": HaSvgIconStub,
    "ha-color-picker": HaColorPickerStub,
    "ha-icon-button": HaIconButtonStub,
    "ha-entity-picker": HaEntityPickerStub,
    "action-handler": ActionHandlerStub,
};

for (const [tag, constructor] of Object.entries(stubs)) {
    if (!customElements.get(tag)) {
        customElements.define(tag, constructor);
    }
}

afterEach((): void => {
    // The hass singleton outlives a test file, so a test that never sets it
    // would otherwise read whatever the previous file left behind.
    setHass(null as never);
    document.body.innerHTML = "";
});
```

- [ ] **Step 4: Create `tests/support/factories.ts`**

```typescript
import {HomeAssistant} from "custom-card-helpers";
import {CardConfig, EntitiesRowConfig} from "../../src/structs/config";

export function rawTimedEvent(
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        id: "timed-1",
        summary: "Standup",
        description: "",
        location: "",
        start: {dateTime: "2026-09-18T09:00:00Z"},
        end: {dateTime: "2026-09-18T09:30:00Z"},
        ...overrides,
    };
}

export function rawAllDayEvent(
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    // Home Assistant reports the end of an all-day event exclusively, so a
    // one-day event on the 18th ends on the 19th.
    return {
        id: "all-day-1",
        summary: "Holiday",
        description: "",
        location: "",
        start: {date: "2026-09-18"},
        end: {date: "2026-09-19"},
        ...overrides,
    };
}

export function entityRow(entity: string, color?: string): EntitiesRowConfig {
    return color === undefined ? {entity} : {entity, color};
}

export function cardConfig(overrides: Partial<CardConfig> = {}): CardConfig {
    return {
        type: "custom:today-card",
        time_format: "HH:mm",
        show_all_day_events: true,
        show_past_events: true,
        entities: ["calendar.work"],
        ...overrides,
    } as CardConfig;
}

/**
 * A `callApi` that answers each `calendars/<entity>` request from a map, and
 * rejects for any entity whose value is an Error.
 */
export function calendarApi(
    responses: Record<string, Record<string, unknown>[] | Error>,
): (method: string, path: string) => Promise<unknown> {
    return async (_method: string, path: string): Promise<unknown> => {
        const entity = (path.split("?")[0] ?? "").replace("calendars/", "");
        const response = responses[entity];

        if (response === undefined) {
            throw new Error(`no stub response for ${entity}`);
        }

        if (response instanceof Error) {
            throw response;
        }

        return response;
    };
}

export function fakeHass(overrides: Partial<HomeAssistant> = {}): HomeAssistant {
    return {
        language: "en",
        states: {},
        callApi: async () => [],
        ...overrides,
    } as unknown as HomeAssistant;
}
```

- [ ] **Step 5: Create `tests/support/mount.ts`**

```typescript
/** Let pending promises and microtasks settle before asserting. */
export async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Attach an element to the document, apply properties, and wait until Lit has
 * rendered. Returns the element so the caller can read its shadow root.
 */
export async function mount<T extends HTMLElement>(
    tag: string,
    properties: Record<string, unknown> = {},
): Promise<T> {
    const element = document.createElement(tag) as T;

    Object.assign(element, properties);
    document.body.appendChild(element);

    await flush();
    await (element as unknown as {updateComplete: Promise<unknown>})
        .updateComplete;

    return element;
}

/** The rendered markup of an element's shadow root. */
export function shadowHtml(element: HTMLElement): string {
    return element.shadowRoot?.innerHTML ?? "";
}
```

- [ ] **Step 6: Write the harness test**

```typescript
import {describe, expect, test} from "bun:test";
import {mount, shadowHtml} from "./mount";
import {fakeHass} from "./factories";

describe("test harness", (): void => {
    test("pins the timezone so date fixtures mean the same thing everywhere", (): void => {
        expect(process.env.TZ).toBe("UTC");
    });

    test("provides a DOM with custom element support", (): void => {
        expect(typeof customElements.define).toBe("function");
        expect(customElements.get("ha-card")).toBeDefined();
        expect(customElements.get("action-handler")).toBeDefined();
    });

    test("mounts a Lit element and waits for its first render", async (): Promise<void> => {
        await import("../../src/elements/card");

        const card = await mount("today-card", {hass: fakeHass()});

        expect(shadowHtml(card)).toBeString();
    });
});
```

- [ ] **Step 7: Run it**

Run: `bun test tests/support/harness.test.ts`
Expected: 3 passing tests.

- [ ] **Step 8: Add the scripts to `package.json`**

```json
"test": "bun test",
"test:coverage": "bun test --coverage"
```

- [ ] **Step 9: Include the tests in typechecking**

In `tsconfig.json`, change `"include"` to `["src/**/*", "tests/**/*"]` and add `"types": ["bun"]` under `compilerOptions`.

Run: `bun run typecheck`
Expected: no errors. If `noUnusedParameters` complains about a stub method, prefix the parameter with `_`.

- [ ] **Step 10: Wire the suite into the build workflow**

In `.github/workflows/build.yml`, insert between the `Typecheck` and `Build` steps:

```yaml
      - name: Test
        run: bun run test:coverage
```

Coverage is printed for information. The step fails only when a test fails.

- [ ] **Step 11: Gate releases on the suite**

In `.github/workflows/release.yml`, insert between the `Install` and `Build` steps:

```yaml
      - name: Test
        run: bun run test
```

A tag that does not pass its own tests must not produce a published bundle.

- [ ] **Step 12: Format, verify, commit**

```bash
bun run format:fix
bun run format:check && bun run typecheck && bun test
git add -A
git commit -m "add the test harness and run it in CI"
```

---

### Task 2: Colour helpers

**Files:**
- Test: `tests/functions/colors.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the tests**

Cover, as separate test cases:

1. `computeCssColor("red")` → `"var(--red-color)"`, and the same for a second theme colour such as `"deep-purple"`.
2. `computeCssColor("#ff0000")` → `"#ff0000"` (unknown values pass through untouched).
3. `computeCssColor("")`, `computeCssColor(undefined)` → `"var(--primary-color)"`.
4. `computeCssColor("rgb(1, 2, 3)")` → unchanged.
5. `getFallBackColor(0)` → `"light-blue"`; `getFallBackColor(FALLBACK_COLORS.length)` → `"light-blue"` again (wrap-around); `getFallBackColor(7)` → the second entry.
6. Every entry of `FALLBACK_COLORS` is also in `THEME_COLORS`, so an automatically assigned colour always resolves to a CSS variable.

```typescript
import {describe, expect, test} from "bun:test";
import {
    computeCssColor,
    FALLBACK_COLORS,
    getFallBackColor,
    THEME_COLORS,
} from "../../src/functions/colors";

describe("computeCssColor", (): void => {
    test("maps a theme colour name to its CSS variable", (): void => {
        expect(computeCssColor("red")).toBe("var(--red-color)");
        expect(computeCssColor("deep-purple")).toBe("var(--deep-purple-color)");
    });

    test("passes anything that is not a theme colour through untouched", (): void => {
        expect(computeCssColor("#ff0000")).toBe("#ff0000");
        expect(computeCssColor("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
    });

    test("falls back to the primary colour when none is given", (): void => {
        expect(computeCssColor("")).toBe("var(--primary-color)");
        expect(computeCssColor(undefined)).toBe("var(--primary-color)");
    });
});

describe("getFallBackColor", (): void => {
    test("wraps around once the list runs out", (): void => {
        expect(getFallBackColor(0)).toBe(FALLBACK_COLORS[0]);
        expect(getFallBackColor(FALLBACK_COLORS.length)).toBe(
            FALLBACK_COLORS[0],
        );
        expect(getFallBackColor(FALLBACK_COLORS.length + 1)).toBe(
            FALLBACK_COLORS[1],
        );
    });

    test("only returns colours the card can resolve to a variable", (): void => {
        for (const color of FALLBACK_COLORS) {
            expect(THEME_COLORS).toContain(color);
        }
    });
});
```

- [ ] **Step 2: Run and commit**

```bash
bun test tests/functions/colors.test.ts
bun run format:fix
git add -A && git commit -m "test the colour helpers"
```

---

### Task 3: Config helpers

**Files:**
- Test: `tests/functions/config.test.ts`

**Interfaces:**
- Consumes: `fakeHass` from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the tests for `processEditorEntities`**

Cases:

1. A list of plain strings without colour assignment yields `{entity}` objects with **no** `color` key at all — assert with `expect(result[0]).toEqual({entity: "calendar.work"})` so an added `color: undefined` would fail.
2. The same list with `assignColors: true` yields the fallback colours in order.
3. An entry that already has a colour keeps it, even with `assignColors: true`.
4. An entry with `color: ""` is treated as having no colour: without assignment the key is dropped, with assignment it gets a fallback. (This is the editor bug the source comment describes.)
5. Entities outside the `calendar.` domain are dropped, and the colour indices are those of the original positions.
6. An empty list yields an empty list.

- [ ] **Step 2: Write the tests for `getEntityName`**

Cases: returns the `friendly_name` attribute when hass knows the entity; returns the entity id when hass is unset, when the entity is unknown, and when it has no `friendly_name`. Set the singleton with `setHass(fakeHass({states: {...}}))` inside the test.

- [ ] **Step 3: Write the tests for `isEqual`**

Cases: identical primitives; differing primitives; deeply equal nested objects; objects differing in a nested value; objects with a different number of keys; arrays with equal and with differing contents; `null` versus an object; an object versus `undefined`.

- [ ] **Step 4: Run and commit**

```bash
bun test tests/functions/config.test.ts
bun run format:fix
git add -A && git commit -m "test the config helpers"
```

---

### Task 4: Localization

**Files:**
- Test: `tests/localization/localize.test.ts`

**Interfaces:**
- Consumes: `fakeHass` from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the lookup tests**

Cases:

1. A key that exists in the active language returns that language's string (set `fakeHass({language: "de"})` and assert against the value read from `de.json`, imported in the test, rather than a hardcoded string — the test should not break when someone improves the wording).
2. With no hass set, English is used.
3. An unknown language falls back to English.
4. `"en-GB"` resolves to the English file.
5. A key missing from a non-English language falls back to the English string.
6. A key that exists nowhere is returned verbatim.
7. A key whose path runs through a non-object (`"event.schedule.from.nope"`) returns the key rather than throwing.

- [ ] **Step 2: Write the language parity test**

Walk every leaf key in `en.json` and assert that `de`, `es`, `fr` and `it` each define it, reporting the full list of missing keys in one assertion message so a translator sees everything at once.

```typescript
function leafKeys(object: Record<string, unknown>, prefix = ""): string[] {
    return Object.entries(object).flatMap(([key, value]): string[] => {
        const path = prefix ? `${prefix}.${key}` : key;

        return typeof value === "object" && value !== null
            ? leafKeys(value as Record<string, unknown>, path)
            : [path];
    });
}
```

Skip the `default` key that a JSON namespace import adds. If a language is genuinely missing keys today, this is a finding for Task 14, not a licence to edit the JSON.

- [ ] **Step 3: Run and commit**

```bash
bun test tests/localization/localize.test.ts
bun run format:fix
git add -A && git commit -m "test localization and language parity"
```

---

### Task 5: Config and action schemas

**Files:**
- Test: `tests/structs/config.test.ts`
- Test: `tests/structs/action.test.ts`

**Interfaces:**
- Consumes: `cardConfig` from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the card config tests**

Use `is(value, cardConfigStruct)` from Superstruct for boolean assertions and `assert` where the error matters. Cases: a minimal valid config; `entities` as a string array; `entities` as an object array; a mixed array rejected (the union is one or the other); `limit: 0` and `limit: 5` accepted, `limit: -1` rejected; `advance` negative accepted (looking back is legitimate); unknown top-level keys rejected; `tap_action` accepted for each supported action.

- [ ] **Step 2: Write the action struct tests**

The `dynamic` struct picks a variant from the `action` field. Cases: `{action: "url", url_path: "/x"}` accepted but `{action: "url"}` rejected; `{action: "navigate", navigation_path: "/x"}` accepted, missing path rejected; `{action: "perform-action", perform_action: "light.turn_on"}` accepted, with `target.entity_id` both as a string and as an array; `{action: "none"}` accepted; `{action: "fire-dom-event"}` accepted; an unknown action string rejected; a value that is not an object rejected.

- [ ] **Step 3: Run and commit**

```bash
bun test tests/structs/
bun run format:fix
git add -A && git commit -m "test the config and action schemas"
```

---

### Task 6: Event helpers

**Files:**
- Test: `tests/common/fire-event.test.ts`
- Test: `tests/common/handle-action.test.ts`

**Interfaces:**
- Consumes: `fakeHass` from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Test `fireEvent`**

Cases: the listener receives the event under the given type; `detail` arrives on the event; omitting `detail` yields `{}`; `bubbles` and `composed` default to `true` while `cancelable` defaults to `false`; explicit options override the defaults; the function returns the dispatched event.

```typescript
test("carries its detail payload", (): void => {
    const node = document.createElement("div");
    let received: unknown;

    node.addEventListener("hass-action", (event: Event): void => {
        received = (event as CustomEvent).detail;
    });

    fireEvent(node, "hass-action", {config: {}, action: "tap"});

    expect(received).toEqual({config: {}, action: "tap"});
});
```

- [ ] **Step 2: Test `handleAction`**

`handleAction` fires `hass-action` on the node with the config and action in its detail. Assert the event type, the detail contents, and that it bubbles and is composed so it can escape the card's shadow root — that is the whole point of the indirection.

- [ ] **Step 3: Run and commit**

```bash
bun test tests/common/
bun run format:fix
git add -A && git commit -m "test the event helpers"
```

---

### Task 7: CalendarEvent — parsing and day arithmetic

**Files:**
- Test: `tests/structs/event.test.ts`

**Interfaces:**
- Consumes: `rawTimedEvent`, `rawAllDayEvent`, `cardConfig`, `entityRow` from Task 1.
- Produces: a local `makeEvent(raw, configOverrides?, entityOverrides?)` helper used by Task 8; keep it exported from the test file so the timezone test can reuse it.

```typescript
export function makeEvent(
    raw: Record<string, unknown>,
    config: Partial<CardConfig> = {},
    entity: EntitiesRowConfig = entityRow("calendar.work", "red"),
): CalendarEvent {
    return new CalendarEvent(raw, entity, cardConfig(config));
}
```

- [ ] **Step 1: Test the plain accessors**

`id` from `id`, and from `uid` when `id` is absent; `title`, `description`, `location` returning `""` when the raw event omits them; `color` from the entity, and `"currentColor"` when the entity has none.

- [ ] **Step 2: Test `start` and `end` parsing**

Cases:

1. A timed event's `start` and `end` are the given instants.
2. An all-day event's `start` is the start of its day.
3. An all-day event's `end` is the **end of the day before** the exclusive `end.date` — for `start.date: "2026-09-18"`, `end.date: "2026-09-19"`, `end` is 2026-09-18 23:59:59.999.
4. `start` and `end` return clones: mutating the returned Day.js object (Day.js is immutable, so assert instead that two successive reads are equal and `!==` the same object) does not affect a later read.

- [ ] **Step 3: Test `isAllDay`, `isMultiDay`**

Cases: a timed event within one day is neither; an all-day one-day event is all-day and not multi-day; an all-day three-day event is both; a timed event that spans midnight is multi-day and, per the third branch of `isAllDay`, is all-day only on the days between its first and last — assert the behaviour for a middle day using `advance`.

- [ ] **Step 4: Test `isFirstDay`, `isLastDay`, `numberOfDays`, `currentDay` under a frozen clock**

Freeze the clock at a known instant with `setSystemTime()` in `beforeEach` and restore it in `afterEach`. Cases: for a three-day all-day event running the 17th to the 19th with the clock on the 18th — `numberOfDays` is 3, `currentDay` is 2, `isFirstDay` is false, `isLastDay` is false; with the clock on the 17th, `isFirstDay` is true and `currentDay` is 1; with `advance: 1` and the clock on the 17th, the card is showing the 18th, so `currentDay` is 2 and `isFirstDay` is false. A single-day event has `isFirstDay` and `isLastDay` false, since both require `isMultiDay`.

- [ ] **Step 5: Run and commit**

```bash
bun test tests/structs/event.test.ts
bun run format:fix
git add -A && git commit -m "test calendar event parsing and day arithmetic"
```

---

### Task 8: CalendarEvent — schedules and clock-relative state

**Files:**
- Modify: `tests/structs/event.test.ts`
- Create: `tests/structs/event.timezone.test.ts`

**Interfaces:**
- Consumes: `makeEvent` from Task 7.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Test `timeSchedule` in all four branches**

With `time_format: "HH:mm"` and the clock frozen:

1. A single-day timed event renders `"09:00 – 09:30"` (note the en dash with spaces).
2. A multi-day event on its first day, starting at 14:30, renders the localized "from" prefix plus `"14:30"`.
3. A multi-day event on its last day, ending at 11:00, renders the localized "until" prefix plus `"11:00"`.
4. A multi-day event on a middle day renders `null`.
5. An all-day event renders `null`.
6. A multi-day event whose first day starts exactly at midnight renders `null` on that day, not "from 00:00".
7. `time_format: "h:mm A"` changes the rendering, proving the config is honoured.

Assert the localized prefixes by calling `localize("event.schedule.from")` in the test rather than hardcoding "from", so the test survives a wording change.

- [ ] **Step 2: Test `daySchedule`**

`"(2/3)"` for the middle day of a three-day event; `null` for a single-day event.

- [ ] **Step 3: Test `isInPast`, `isInFuture`, `isCurrent`**

With the clock at 2026-09-18T10:00:00Z:

1. An event that ended at 09:30 is past, not future, not current.
2. An event starting at 11:00 is future, not past, not current.
3. An event from 09:30 to 10:30 is current, and neither past nor future.
4. An event ending exactly at 10:00 is current (the comparison is inclusive) and not past.
5. An event starting exactly at 10:00 is current and not future.
6. **The documented regression:** with `advance: 1` and the clock at 2026-09-18T09:01:00Z, an event on the 19th from 09:00 to 09:30 is **not** past — those three getters compare against the real moment, not against the day on screen.

- [ ] **Step 4: Write `tests/structs/event.timezone.test.ts`**

Reassign `process.env.TZ` inside the test and restore it afterwards. For `Europe/Berlin` (UTC+2 in September) and `Pacific/Auckland` (UTC+12):

1. An all-day event on 2026-09-18 starts on the 18th in local time, not the 17th or 19th.
2. Its `end` falls on the 18th too.
3. `numberOfDays` for a three-day all-day event is 3 in every zone.
4. A timed event given in UTC renders its local time in `timeSchedule` — in Berlin, `09:00Z` renders as `"11:00"`.

If any of these fail, that is a genuine finding for Task 14. Record it, assert the actual behaviour with an explanatory comment, and move on.

```typescript
function inTimezone<T>(timezone: string, run: () => T): T {
    const previous = process.env.TZ;

    process.env.TZ = timezone;
    try {
        return run();
    } finally {
        process.env.TZ = previous;
    }
}
```

- [ ] **Step 5: Run and commit**

```bash
bun test tests/structs/
bun run format:fix
git add -A && git commit -m "test event schedules and timezone handling"
```

---

### Task 9: getEvents — window, filtering and exclusion

**Files:**
- Test: `tests/functions/calendar.test.ts`

**Interfaces:**
- Consumes: `calendarApi`, `fakeHass`, `cardConfig`, `entityRow`, `rawTimedEvent`, `rawAllDayEvent` from Task 1.
- Produces: a local `fetchWith(config, responses)` helper reused by Task 10.

```typescript
async function fetchWith(
    config: Partial<CardConfig>,
    responses: Record<string, Record<string, unknown>[] | Error>,
): Promise<CalendarResult> {
    const entities = Object.keys(responses).map((entity) => entityRow(entity));

    return getEvents(
        cardConfig({...config, entities}),
        entities,
        fakeHass({callApi: calendarApi(responses)}),
    );
}
```

- [ ] **Step 1: Test the requested window**

Capture the paths passed to `callApi`. With the clock frozen at 2026-09-18T10:00:00Z, assert that `start` is the start of the 18th and `end` the end of the 18th, and that with `advance: 1` both move to the 19th. Assert one request per configured entity.

- [ ] **Step 2: Test `show_all_day_events` and `show_past_events`**

Cases: with `show_all_day_events: false`, all-day events are dropped and timed ones survive; with `show_past_events: false`, an event that ended before the frozen clock is dropped while a current and a future one survive; with both true, everything survives. Also cover the separate rule that an all-day event whose `end` precedes the displayed day is dropped regardless of `show_past_events`.

- [ ] **Step 3: Test `exclude`**

Cases:

1. A plain substring matches case-insensitively in the title.
2. A plain substring matches in the description.
3. A `/regex/` pattern matches, and its flags are honoured (`/^stand/i`).
4. A pattern that looks like a regex but does not compile (`/[unclosed/`) falls back to matching `"[unclosed"` as plain text rather than never matching.
5. An empty string and a whitespace-only string exclude nothing — the whole calendar must survive.
6. A pattern that matches nothing leaves the list untouched.
7. An absent `exclude` key leaves the list untouched.

- [ ] **Step 4: Run and commit**

```bash
bun test tests/functions/calendar.test.ts
bun run format:fix
git add -A && git commit -m "test the event window, filtering and exclusion"
```

---

### Task 10: getEvents — ordering, limit and failures

**Files:**
- Modify: `tests/functions/calendar.test.ts`

**Interfaces:**
- Consumes: `fetchWith` from Task 9.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Test the ordering**

Assert on the resulting titles in order, which reads far better than indexing into the array.

Cases: all-day events come before timed ones regardless of their times; among all-day events, the longer span comes first; equal spans are ordered by `currentDay` descending; equal on both counts fall back to the title; timed events are ordered by start; timed events with the same start are ordered by end; a multi-day event that started before today sorts by today's start rather than its own.

- [ ] **Step 2: Test `limit`**

Cases: `limit: 2` returns the first two of five, **after** sorting; `limit: 0`, `limit: undefined` and a negative limit all return everything; a limit larger than the list returns everything.

- [ ] **Step 3: Test failure reporting**

Cases: one of two calendars rejecting puts exactly that entity id in `failed` while the other calendar's events still arrive; both rejecting reports both and yields no events; no failures yields an empty `failed` array. Silence the expected `console.error` for the duration of these tests by replacing it and restoring it afterwards, so a passing run does not print stack traces.

- [ ] **Step 4: Run and commit**

```bash
bun test tests/functions/calendar.test.ts
bun run format:fix
git add -A && git commit -m "test event ordering, limits and calendar failures"
```

---

### Task 11: The card element

**Files:**
- Test: `tests/elements/card.test.ts`

**Interfaces:**
- Consumes: `mount`, `shadowHtml`, `flush` from Task 1; `calendarApi`, `fakeHass`, `cardConfig` from Task 1.
- Produces: nothing later tasks depend on.

Mount the card, then call `setConfig` and await `flush()` plus `updateComplete`, since `setConfig` kicks off an asynchronous fetch.

- [ ] **Step 1: Test the three body states**

Cases: with no events and no failures, the fallback row renders with the `is-fallback` class and the localized "nothing scheduled" strings; with events, one `.event` row per event carrying its title; with a failing calendar, an `is-error` row renders, naming the friendly name of the failed entity, and the fallback row does **not** also render — an unknown day must not be reported as an empty one.

- [ ] **Step 2: Test the CSS class hooks**

These are the documented extension point for card-mod users, so assert them explicitly: a timed future event carries `is-in-future`; a past one carries `is-in-past`; a current one carries `is-current`; an all-day one carries `is-all-day`; a multi-day one carries `is-multi-day` plus `is-first-day` or `is-last-day` on the right days.

- [ ] **Step 3: Test the header and interactivity**

Cases: a configured `title` reaches the `ha-card` header attribute; no title leaves it unset; the `has-advance-of-N` class reflects `advance`; with `tap_action: {action: "none"}` the card has no `role` or `tabindex` and renders no `ha-ripple`; with `tap_action: {action: "navigate", navigation_path: "/x"}` it has `role="button"`, `tabindex="0"` and an `ha-ripple`.

- [ ] **Step 4: Test the static helpers**

`getCardSize` returns 1 for an empty untitled card, 2 with a title and no events, and title-plus-event-count otherwise. `getStubConfig` keeps only `calendar.` entities, falls back to the second list when the first has none, and produces a config that satisfies `cardConfigStruct`. `getEntitySuggestion` returns `null` for a non-calendar entity and a config naming the entity for a calendar one.

- [ ] **Step 5: Test the refresh lifecycle**

Cases: connecting installs an interval and disconnecting clears it — assert by spying on `window.setInterval` and `window.clearInterval`; reconnecting installs exactly one interval, not two.

- [ ] **Step 6: Test config rejection**

`setConfig` throws for a config with a negative `limit` and for one missing `entities`, since Superstruct's `assert` is what protects users from a silently broken card.

- [ ] **Step 7: Run and commit**

```bash
bun test tests/elements/card.test.ts
bun run format:fix
git add -A && git commit -m "test the card element"
```

---

### Task 12: The editor element

**Files:**
- Test: `tests/elements/editor.test.ts`

**Interfaces:**
- Consumes: `mount`, `flush`, `fakeHass`, `cardConfig` from Task 1.
- Produces: nothing later tasks depend on.

The editor renders into an `ha-form` stub. Read the form's `.data` property and dispatch `value-changed` on it to simulate the user, rather than trying to drive a form that does not exist outside Home Assistant.

- [ ] **Step 1: Test the data handed to the form**

Cases: `exclude` is joined into a newline-separated string; an absent `exclude` becomes `""`; the remaining config values are passed through unchanged.

- [ ] **Step 2: Test what comes back out**

Dispatch `value-changed` with a detail value and assert on the `config-changed` event the editor fires. Cases: a multi-line `exclude` string is split, trimmed and stripped of blank lines; an `exclude` of only whitespace results in **no** `exclude` key in the emitted config; an unchanged value fires nothing at all (the `isEqual` guard); the `value-changed` event does not escape the editor (`stopPropagation`).

- [ ] **Step 3: Test the entity list pass-through**

Dispatching `entities-changed` from the child editor results in a `config-changed` carrying the new entity list and the rest of the config unchanged.

- [ ] **Step 4: Run and commit**

```bash
bun test tests/elements/editor.test.ts
bun run format:fix
git add -A && git commit -m "test the editor element"
```

---

### Task 13: The entity editor element

**Files:**
- Test: `tests/elements/entity-editor.test.ts`

**Interfaces:**
- Consumes: `mount`, `shadowHtml`, `fakeHass`, `entityRow` from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Test rendering**

Cases: one `.entity` row per configured entity, each showing the friendly name and the raw entity id; an empty list renders the picker but no rows; with no hass the element renders nothing.

- [ ] **Step 2: Test colour changes**

Drive the `ha-color-picker` stubs by dispatching `value-changed` on the right one. Cases: choosing a colour emits `entities-changed` with that colour on the right index and the other rows untouched; choosing the colour the row already has emits nothing; clearing the colour emits a row **without** a `color` key rather than with `color: ""`.

- [ ] **Step 3: Test adding**

Cases: picking an entity emits `entities-changed` with it appended; picking an entity already in the list emits nothing; the picker's value is reset to `""` in both cases; an empty value emits nothing.

- [ ] **Step 4: Test removal**

Cases: clicking the remove button for index 1 of three emits the other two in order; an index outside the list emits nothing; an undefined index emits nothing.

- [ ] **Step 5: Run and commit**

```bash
bun test tests/elements/entity-editor.test.ts
bun run format:fix
git add -A && git commit -m "test the entity editor element"
```

---

### Task 14: Documentation and findings

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md` (only if it documents development commands)
- Create: `docs/superpowers/plans/2026-09-18-test-suite-findings.md`

**Interfaces:**
- Consumes: the findings recorded while writing Tasks 2–13.
- Produces: the report handed back to the maintainer.

- [ ] **Step 1: Run the full suite with coverage**

```bash
bun run format:check && bun run typecheck && bun run test:coverage
```

Record the coverage figures. Do not add a threshold; the spec defers that until the real number is known.

- [ ] **Step 2: Document the commands in `CLAUDE.md`**

Add `bun test` and `bun run test:coverage` to the Development Commands block, and a short "Testing" subsection under Architecture describing the `tests/` layout, the preloaded setup file, the Home Assistant element stubs, and the rule that clock-dependent tests freeze time.

- [ ] **Step 3: Write the findings report**

One section per finding: what the test does, what the code does, what it should arguably do, and how severe it is. If nothing was found, say so in one line — an empty findings list is a real result.

- [ ] **Step 4: Commit and push**

```bash
bun run format:fix
git add -A && git commit -m "document the test suite and report what it found"
git push -u origin feature/test-suite
```

---

## Self-Review

**Spec coverage.** Runner choice and dependencies → Task 1. Layout and `support/` → Task 1. `event.ts` → Tasks 7 and 8. `calendar.ts` → Tasks 9 and 10. `colors` → Task 2. `config` → Task 3. `localize` including parity → Task 4. Superstruct schemas → Task 5. `fire-event` and `handle-action` → Task 6. Card, editor, entity editor → Tasks 11, 12, 13. Timezone handling → Task 8. Tooling, scripts, typecheck and both CI workflows → Task 1, verified again in Task 14. Coverage reported but not enforced → Tasks 1 and 14. Findings reported rather than fixed → Global Constraints and Task 14.

**Placeholders.** None: every task names its cases explicitly, and the tasks that introduce new machinery (harness, factories, mount helpers, timezone switching, the parity walker) carry the actual code.

**Type consistency.** `mount`, `flush` and `shadowHtml` are defined in Task 1 and used under those names throughout. `calendarApi` returns a `callApi`-shaped function consumed by `fakeHass({callApi})` in Tasks 9 to 11. `makeEvent` is defined in Task 7 and reused in Task 8. `fetchWith` is defined in Task 9 and reused in Task 10.
