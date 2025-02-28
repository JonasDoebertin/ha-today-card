# Today Card for Home Assistant

[![HACS][hacs-badge]][hacs-url]
[![Release][release-badge]][releases-url]

[![Open in your Home Assistant instance][my-ha-badge]][my-ha-url]

![Today Card for Home Assistant Lovelace Preview](docs/preview.png)

## Installation

### HACS

Since **Today Card** is not yet available through the HACS store, you have to add it as a custom repository. After this initial step, the installation und future updates work the same as with any other HACS project.

1. Navigate to the HACS Dashboard] in your instance and click the three dots in the top right corner.
2. Select _Custom Repositories_ and add **Today Card**
   - Repository: `JonasDoebertin/ha-today-card`
   - Type: `Dashboard`
3. Click _Add_ to add **Today Card** to the list of your HACS repositories.
4. Add the `custom:today-card` to your Dashboard like any other card (using either editor or YAML configuration).

### Manual

1. Download the `ha-today-card.js` file from the [latest release][latest-release-url].
2. Put the `ha-today-card.js` file into your `config/www` folder.
3. Go to _Configuration_ → _Lovelace Dashboards_ → _Resources_ → Click Plus button
   - Set _Url_ as `/local/ha-today-card.js`
   - Set _Resource type_ as `JavaScript Module`.
4. Add the `custom:today-card` to your Dashboard like any other card (using either editor or YAML configuration).

## Configuration

The card can be configured via a fully featured visual UI editor or via YAML.

### Minimal YAML Configuration
```yaml
type: custom:today-card
entities:
  - calendar.your_calendar
```

### Full YAML Configuration
```yaml
type: custom:today-card
title: "Today's Schedule"
advance: 4
show_all_day_events: true
show_past_events: false
fallback_color: teal
entities:
  - entity: calendar.your_calendar_1
    color: "#1abcf2"
  - entity: calendar.your_calendar_2
    color: pink
```

### Configuration Options

#### Main Options

| Name                  | Type            | Requirement  | Default   | Description                                                                                                                                                                     |
|-----------------------|-----------------|--------------|-----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `type`                | string          | **Required** |           | `custom:today-card`                                                                                                                                                             |
| `entities`            | list of objects | **Required** |           | Either a simple list of calendar entities (see [minimal configuration](#Minimal-YAML-Configuration) example) or a list of objects (see [Calendar Entities](#Calendar-Entities)) |
| `title`               | string          | Optional     | `""`      | Card title (if empty, no card title will be shown)                                                                                                                              |
| `advance`             | number          | Optional     | `0`       | Advance                                                                                                                                                                         |
| `show_all_day_events` | boolean         | Optional     | `true`    | Whether to show all day events in the schedule                                                                                                                                  |
| `show_past_events`    | boolean         | Optional     | `false`   | Whether to include past events in the schedule                                                                                                                                  |
| `time_format`         | string          | Optional     | `HH:mm`   | Define a custom format for displaying the events start and end times (see [time formats](#Time-Formatting))                                                                     |
| `fallback_color`      | string          | Optional     | `primary` | Color to use as a fallback, eg. when no events are left for the day (see [colors](#Colors))                                                                                     |

#### Calendar Entities

Calendar entities can either be provided as a simple list of calendar entities (see [minimal configuration](#Minimal-YAML-Configuration) example) or a list of objects following the below-mentioned structure.

| Name   | Type   | Required     | Default | Description                                                                                                                                                    |
|--------|--------|--------------|---------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| entity | string | **Required** |         | An entity id of the `calendar.*` domain                                                                                                                        |
| color  | string | Optional     |         | The calendars color in the schedule (see [colors](#Colors)). If no color is specified, a color from the list of available colors will be chosen automatically. |

#### Time Formatting

With the `time_format` configuration option, you can change how the events start and end times are being displayed. Choose from the following formatting placeholders:

| Format | Output | Description                       |
|--------|--------|-----------------------------------|
| `H`    | 0-23   | The hour                          |
| `HH`   | 00-23  | The hour, 2-digits                |
| `h`    | 1-12   | The hour, 12-hour clock           |
| `hh`   | 01-12  | The hour, 12-hour clock, 2-digits |
| `m`    | 0-59   | The minute                        |
| `mm`   | 00-59  | The minute, 2-digits              |
| `A`    | AM PM  |                                   |
| `a`    | am pm  |                                   |

Using those in combination can result in the following common formats:

| Format    | Output   |
|-----------|----------|
| `H:mm`    | 8:02     |
| `HH:mm`   | 08:02    |
| `h:mm A`  | 8:02 AM  |
| `hh:mm A` | 08:02 AM |
| `h:mm a`  | 8:02 am  |
| `hh:mm a` | 08:02 am |

#### Colors

The card generally use Home Assistants default colors, which can be overwritten by your theme. Any of the following values can be used as a color in the cards configuration.

You can also directly specify a hex color code instead, e.g. `color: "#1abcf2"`.

| Name          | Used CSS Variable     |
|---------------|-----------------------|
| `primary`     | `--primary-color`     |
| `accent`      | `--accent-color`      |
| `disabled`    | `--disabled-color`    |
| `red`         | `--red-color`         |
| `pink`        | `--pink-color`        |
| `purple`      | `--purple-color`      |
| `deep-purple` | `--deep-purple-color` |
| `indigo`      | `--indigo-color`      |
| `blue`        | `--blue-color`        |
| `light-blue`  | `--light-blue-color`  |
| `cyan`        | `--cyan-color`        |
| `teal`        | `--teal-color`        |
| `green`       | `--green-color`       |
| `light-green` | `--light-green-color` |
| `lime`        | `--lime-color`        |
| `yellow`      | `--yellow-color`      |
| `amber`       | `--amber-color`       |
| `orange`      | `--orange-color`      |
| `deep-orange` | `--deep-orange-color` |
| `brown`       | `--brown-color`       |
| `light-grey`  | `--light-grey-color`  |
| `grey`        | `--grey-color`        |
| `dark-grey`   | `--dark-grey-color`   |
| `blue-grey`   | `--blue-grey-color`   |
| `black`       | `--black-color`       |
| `white`       | `--white-color`       |

<!-- Badges -->

[hacs-badge]: https://img.shields.io/badge/HACS-Default-41BDF5.svg?style=for-the-badge
[release-badge]: https://img.shields.io/github/v/release/JonasDoebertin/ha-today-card?style=for-the-badge
[my-ha-badge]: https://my.home-assistant.io/badges/hacs_repository.svg

<!-- References -->

[hacs-url]: https://github.com/hacs/integration
[my-ha-url]: https://my.home-assistant.io/redirect/hacs_repository/?owner=JonasDoebertin&repository=ha-today-card
[releases-url]: https://github.com/JonasDoebertin/ha-today-card/releases
[latest-release-url]: https://github.com/JonasDoebertin/ha-today-card/releases/latest
