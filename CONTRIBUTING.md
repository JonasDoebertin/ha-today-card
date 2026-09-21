# Contributing to Today Card

Thanks for taking the time. Bug reports, translations, documentation fixes and
code are all useful, and none of them need to be large to be worth opening.

## Reporting a bug

Open an issue with the bug report template. The two things that make a report
actionable are the YAML configuration of the card and what the card shows
instead of what you expected. Your Home Assistant version and browser matter
for rendering problems.

## Suggesting a feature

Open an issue with the feature request template and describe the situation on
your dashboard, not only the option you have in mind. The card shows one day of
events and that scope is deliberate, so ideas get measured against it first.

## Adding a translation

Translations live in `src/localization/lang/` as one JSON file per locale.

1. Copy `en.json` to `<locale>.json` and translate the values.
2. Import and register the file in `src/localization/localize.ts`.
3. Run `bun run format:fix` and open a pull request.

Missing keys fall back to English, so a partial translation still works. It is
better to leave a key out than to guess at it.

## Development setup

The project is a Lit web component, written in TypeScript and bundled with
[Bun](https://bun.sh).

```bash
bun install          # install dependencies
bun run watch        # rebuild dist/ha-today-card.js on every change
bun run build        # production build
```

To try a local build in Home Assistant, copy `dist/ha-today-card.js` into your
`config/www` folder and register it as a dashboard resource, as described in
the manual installation section of the README.

## Checks

The same checks run in CI, so running them before pushing saves a round trip.

```bash
bun run format:check # Prettier
bun run typecheck    # tsc --noEmit, strict mode
bun test             # unit and component tests
bun run build        # the bundle CI publishes
```

Tests live in `tests/`, mirroring the structure of `src/`. A bug fix is easiest
to review when it arrives with a test that fails without it.

## Code style

- Four spaces, LF line endings, UTF-8, as described by `.editorconfig`.
- Prettier decides formatting. Do not hand-format around it.
- TypeScript runs in strict mode with every safety flag on. Prefer changing the
  types over suppressing the error.
- Lit imports need explicit `.js` extensions, for example
  `lit/directives/class-map.js`.

## Pull requests

Keep a pull request to one subject. A short description of what changes and why
is enough; the diff explains how. Pull requests land as merge commits, and the
repository has squash and rebase turned off, so every commit on your branch
ends up in the history. Worth a tidy-up before you open it.

## Preview images

The PNGs in `docs/` come from `docs/preview/preview.html`, which copies the
card markup and `src/elements/card.css` into a plain page. Serve the repository
with any static server, open the page with `?scene=hero`, `?scene=schedule`,
`?scene=advance`, `?scene=states` or `?scene=og`, and take a screenshot at the
size the page renders. `?theme=dark` switches to the dark variant.
