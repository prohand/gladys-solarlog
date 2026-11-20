# Changelog

All notable changes to this integration are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[semantic versioning](https://semver.org/), bumped by the Release workflow.

## [Unreleased]

## [0.0.1] - 2026-11-20

### Added

- First version of the Solar-Log integration, read on the local network through the open JSON
  interface (no cloud).
- "Solar-Log" device: production power, DC power, AC and DC voltages, total yield index and,
  with a consumption meter, consumption power, total consumption, surplus and self-consumption.
- One device per inverter (live power) and a battery device when the Solar-Log manages one.
- Login with the "user" password, plain or bcrypt-hashed (recent firmwares).
- Scene triggers: production started / stopped, solar surplus available / ended, Solar-Log
  unreachable / reachable again.
- Scene actions: read the solar values, check the solar surplus, get the yield of a period.
- Dashboard widgets "Solar production" and "Solar yields".
- English, French, German and Spanish texts and documentation.

[Unreleased]: https://github.com/prohand/gladys-solarlog/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/prohand/gladys-solarlog/releases/tag/v0.0.1
