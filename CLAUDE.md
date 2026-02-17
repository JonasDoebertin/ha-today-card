# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Today Card is a custom Lovelace card for Home Assistant that displays calendar events for the current day (or other days via the `advance` option). It is built as a Web Component using Lit and TypeScript, bundled with Parcel, and distributed via HACS.

## Tech Stack

- **Framework**: Lit (Web Components)
- **Language**: TypeScript with strict mode enabled
- **Bundler**: Bun (built-in bundler via `bun build`)
- **Package Manager**: Bun
- **Styling**: CSS loaded as inline strings via `--loader .css:text`
- **Validation**: Superstruct for runtime config validation
- **Date handling**: Day.js
- **Home Assistant integration**: custom-card-helpers, home-assistant-js-websocket

## Development Commands

```bash
# Install dependencies
bun install

# Build for production (output to dist/)
bun run build

# Watch mode for development
bun run watch

# Format check
bun run format:check

# Format fix
bun run format:fix
```

## Architecture

### Directory Structure

- `src/elements/` - Lit components (card, editor, entity-editor)
- `src/functions/` - Pure utility functions (calendar, colors, config, icons, hacks)
- `src/structs/` - Superstruct schemas for runtime validation (config, action, event)
- `src/common/` - Shared utilities (action handler, event firing)
- `src/localization/` - i18n support with language files in `lang/`

### Key Components

**TodayCard (`src/elements/card.ts`)**: Main custom element registered as `today-card`. Fetches calendar events via Home Assistant API on an interval (60s), processes and filters them based on config, then renders the event list. Uses action handlers for tap interactions.

**Editor (`src/elements/editor.ts`)**: Visual configuration editor for the card, built with Home Assistant's form components.

**CalendarEvent (`src/structs/event.ts`)**: Class that wraps raw calendar event data from HA API. Computes properties like `isAllDay`, `isMultiDay`, `isCurrent`, `isInPast`, `isInFuture`, and formats time/day schedules based on card config.

### Event Fetching Flow

1. Card calls `getEvents()` with config and entities
2. Parallel API calls to Home Assistant's `calendars/{entity}` endpoints
3. Raw events transformed into `CalendarEvent` instances
4. Events filtered based on `show_all_day_events` and `show_past_events` config
5. Events sorted: all-day events first (by duration, then day), then regular events (by start time)

### Configuration Validation

Config is validated at runtime using Superstruct schemas. The `cardConfigStruct` defines the shape of the card's configuration, supporting both simple entity arrays (`string[]`) and detailed entity configs (`EntitiesRowConfig[]`).

### Color System

Supports both Home Assistant named colors (mapped to CSS variables like `--primary-color`) and direct hex codes. The `computeCssColor()` function handles resolution. Colors are automatically assigned to entities if not explicitly configured.

### CSS Class Hooks

Events receive dynamic classes for custom styling via card-mod:
- `.is-all-day`, `.is-multi-day`, `.is-first-day`, `.is-last-day`
- `.is-in-past`, `.is-in-future`, `.is-current`

## Localization

Translations are stored in `src/localization/lang/{locale}.json`. Currently supports: English (en), German (de), Spanish (es).

To add a new language:
1. Add `{locale}.json` file in `src/localization/lang/`
2. Import and register in `src/localization/localize.ts`

## Release Process

Releases are automated via GitHub Actions when a tag matching `v*.*.*` is pushed:
1. Version number is injected into `src/const.ts` (replacing `v0.0.0`)
2. Project is built
3. Draft release is created with `dist/ha-today-card.js`

The output file is what HACS downloads and serves to Home Assistant users.

## Code Style

- EditorConfig: 4-space indentation, LF line endings, UTF-8
- Prettier: no bracket spacing, experimental operators at start of line
- TypeScript: strict mode with all safety features enabled (see tsconfig.json)
- **Import conventions**: Lit package imports require explicit `.js` extensions due to package.json exports (e.g., `"lit/directives/class-map.js"` not `"lit/directives/class-map"`)
