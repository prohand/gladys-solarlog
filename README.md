# Gladys Assistant — Solar-Log integration

External integration for [Gladys Assistant](https://gladysassistant.com) that reads a
**Solar-Log** photovoltaic data logger on the **local network**, through its open JSON
interface: production, consumption, surplus, yields, inverters and battery, with scene
triggers, scene actions and dashboard widgets. No cloud, nothing leaves the house.

Built from the official
[`integration-template-js`](https://github.com/GladysAssistant/integration-template-js) with the
SDK [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).
Requires **Gladys 5.3+**.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) · [Deutsch](docs/de.md) ·
[Español](docs/es.md).

## Features

| Surface         | What                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Devices         | Solar-Log (production, DC power, voltages, total yield index, consumption, surplus, self-consumption), one per inverter, battery |
| Scene triggers  | `production_started`, `production_stopped`, `surplus_started`, `surplus_ended`, `connection_lost`, `connection_restored`         |
| Scene actions   | `read_values`, `check_surplus`, `get_yield`                                                                                      |
| Widgets         | `solar_overview` (live tiles, gauge, 24 h chart, refresh button), `solar_yields` (per period)                                    |
| Config buttons  | `test_connection`, `rediscover`                                                                                                  |
| Transport badge | `local` (the only channel), `unreachable` when the Solar-Log does not answer                                                     |
| Languages       | English, French, German, Spanish (manifest, messages, widgets, docs)                                                             |
| Countries       | Declared for the European markets of Solar-Log (manifest `countries`)                                                            |

## The Solar-Log open JSON interface

One endpoint, `POST http://<solar-log>/getjp`, queried with numeric keys:

| Query                          | Answer                                                                    |
| ------------------------------ | ------------------------------------------------------------------------- |
| `{"801":{"170":null}}`         | Live summary: power AC/DC, voltages, yields (Wh), consumption, peak power |
| `{"740":null}`                 | Inverter slots in use (`"Err"` = unused)                                  |
| `{"141":{"<i>":{"119":null}}}` | Inverter name                                                             |
| `{"782":null}`                 | AC power per inverter                                                     |
| `{"858":null}`                 | Battery: voltage, level, charge and discharge power (`[]` without one)    |

It must be enabled on the Solar-Log (**Configuration > System > Access control > Open JSON
interface**). When the "user" access level has a password, the extended keys answer
`ACCESS DENIED` until a `POST /login` (`u=user&p=…`, bcrypt-hashed with the salt of key 550 on
recent firmwares) gives a `SolarLog` session cookie. See
[`src/solarlog/client.js`](src/solarlog/client.js).

## Project structure

```
.
├─ index.js                          # SDK wiring only (handlers before connect())
├─ src/
│  ├─ config.js                      # DEFAULT_CONFIG (mirrors the manifest) + normalization
│  ├─ i18n.js                        # en / fr / de / es helpers
│  ├─ service.js                     # the read loop: states, triggers, status, badges
│  ├─ solarlog/
│  │  ├─ client.js                   # HTTP client of the JSON interface (+ login)
│  │  ├─ parse.js                    # raw keys -> reading (W, V, kWh)
│  │  ├─ monitor.js                  # readings -> scene events (transitions, hysteresis)
│  │  └─ errors.js                   # error codes + user messages
│  ├─ devices/                       # solarLog.js, inverter.js, battery.js, index.js
│  └─ capabilities/                  # actions.js, scenes.js, widgets.js
├─ docs/                             # en.md, fr.md, de.md, es.md (re-hosted by Gladys)
├─ test/                             # node --test, fake Gladys (SDK) + fake Solar-Log
├─ gladys-assistant-integration.json # manifest
├─ Dockerfile                        # Node 24 Alpine, non-root, read-only rootfs ready
├─ CHANGELOG.md · CLAUDE.md · SECURITY.md
└─ .github/                          # CI, build, release, GitHub releases, dependabot
```

## Development

```bash
npm install
npm test               # node --test, no network, no hardware
npm run lint           # ESLint
npm run format:check   # Prettier (npm run format to fix)
npx github:GladysAssistant/integration-store --skip-image-check .   # store admission checks
```

Run it against a real Gladys and Solar-Log:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="solarlog" \
LOG_LEVEL=debug \
npm start
```

## CI / release workflows

Same workflows as [`prohand/gladys-devmel`](https://github.com/prohand/gladys-devmel):

- **CI** (`ci.yml`): Prettier, ESLint and tests on Node 22 and 24 on every push and pull
  request; on pull requests also the store admission checks and a Docker build.
- **Release** (`release.yml`): **Actions → Release → Run workflow** (`patch` / `minor` /
  `major`). Bumps `package.json` and the manifest (`version` + `docker_image`), moves the
  `[Unreleased]` section of the changelog, tags `vX.Y.Z`, builds the image, publishes the GitHub
  Release and runs the full store checks.
- **Build** (`build.yml`): multi-arch image (`linux/amd64` + `linux/arm64`) to `ghcr.io`.
- **GitHub releases** (`github-release.yml`): one GitHub Release per version tag.
- **Dependabot**: weekly npm, monthly GitHub Actions and Docker base image.

The repository starts at version `0.0.0`: run the first release with **`major`** to publish
`1.0.0`. Then add the GitHub topic `gladys-assistant-integration` so the store indexes it, and
turn on **Private vulnerability reporting** (see [`SECURITY.md`](SECURITY.md)).

## License

Apache-2.0. Solar-Log is a trademark of its owner; this project is not affiliated with it.
