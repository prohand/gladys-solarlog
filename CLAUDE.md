# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human contributors.

## What this is

A Gladys Assistant **external integration** (Node 22+, ESM, no build step) for a **Solar-Log**
photovoltaic data logger, read on the **local network** through its open JSON interface
(`POST /getjp`). Runtime dependencies: `@gladysassistant/integration-sdk` and `bcryptjs` (the
hashed login of recent Solar-Log firmwares). Requires Gladys 5.3+ (manifest `keywords` and
`countries`). Started from the official JavaScript template; workflows copied from
`prohand/gladys-devmel`.

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/service.test.js          # one file
node --test --test-name-pattern "surplus" # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store --skip-image-check .   # store admission checks
```

The CI runs `format:check`, `lint` and `test` on Node 22 and 24, and on pull requests the store
checks and a Docker build: run the three commands before pushing.

## Architecture

```
index.js                     SDK wiring only: handlers registered before connect()
src/service.js               THE read loop: one read serves states, triggers, status, widgets
src/solarlog/client.js       HTTP client of the JSON interface, login (plain / bcrypt), retries once on ACCESS DENIED
src/solarlog/parse.js        raw numeric keys -> reading (W, V, kWh), 1999 = restarting -> refused
src/solarlog/monitor.js      readings -> scene events (transitions only, hysteresis, baseline at start)
src/solarlog/errors.js       error codes + their { en, fr, de, es } user messages
src/devices/                 solarLog.js, inverter.js, battery.js + index.js (discovery, states, badges)
src/capabilities/            actions.js (config buttons), scenes.js (scene actions), widgets.js
src/config.js                DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
src/i18n.js                  LANGUAGES = en, fr, de, es; pick / localize / formatNumber
docs/{en,fr,de,es}.md        user documentation, re-hosted by Gladys (en + fr mandatory)
test/helpers/fakeSolarLog.js in-memory Solar-Log behind an injected fetch
```

### Invariants worth knowing

- **Local only.** The manifest declares `"transports": ["local"]`; every device badge is
  `local` when the last read succeeded, `unreachable` otherwise. Never add a cloud call.
- **One read loop.** `service.js` reads on its own timer (`poll_frequency` seconds, ≥ 30), not
  through Gladys `onPoll`: triggers and widgets need data before any device is created. Devices
  carry no `poll_frequency`. Concurrent `refresh()` calls share one request.
- **States go through `publishChangedStates`** with a 30-minute heartbeat (300 states/min limit).
- **Total indexes never go back**: a `yield-total` / `consumption-total` of 0 (restart) is not
  published, and readings dated 1999 are refused.
- **Period yields are not features**: Gladys derives them from the `yield-total` index; a second
  index per period would be counted twice. They live in the `solar_yields` widget and the
  `get_yield` scene action.
- **Triggers fire on transitions only**, never on the first reading after a start;
  `connection_lost` after `FAILURES_BEFORE_LOST` failed reads in a row.
- **Connection status** is sent on change only (one status per error code).
- **Secrets**: the password and the `SolarLog` session cookie never reach the logs.

## Rules

- **External ids are forever.** `gladys.externalIds('solarlog', 'main')`,
  `('inverter', '<slot>')`, `('battery', 'main')`. Feature keys, config keys, action, trigger,
  scene action and widget keys are stored by users: never rename them.
- **Every feature carries `name`, `min`, `max`, `read_only` and `has_feedback`** (Gladys stores
  them NOT NULL). `test/devices.test.js` checks them against the SDK's fake Gladys.
- **The container rootfs is read-only.** Write only under `/data` (nothing is written today).
- **Versions belong to the Release workflow** (Actions → Release). Never edit `version` in
  `package.json` or the manifest, nor the `docker_image` tag, by hand. `test/manifest.test.js`
  checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]` in
  `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`). Never write a version
  heading: the Release workflow moves the section.
- **Manifest.** Every `label`, `description` and `placeholder` is `{ en, fr, de, es }` — the
  manifest test enforces the four languages. The catalog `description` holds 10 to 100
  characters per language; widget labels 3 to 30, widget descriptions ≤ 100. `gladys_version`
  stays `>=5.3.0` while `keywords` / `countries` are declared. `test/manifest.test.js` ties the
  manifest to the code (defaults, actions, triggers, scene actions, widgets): change both sides
  together.
- **User-facing text** is written in English, French, German and Spanish: action messages,
  connection status, widgets (`src/i18n.js`) and `docs/{en,fr,de,es}.md`, kept in sync.
- **Widgets**: `validateWidgetContent(content)` must return `[]` in every language and state
  (before the first reading, unreachable, without a consumption meter) — see
  `test/widgets.test.js`.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why, in English. Tests
  never touch the network.
