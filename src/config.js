// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. The SDK fetches it (`getConfig()`) and
// notifies every change (`onConfigUpdated()`). This module provides the
// defaults and normalizes the received object, so the rest of the code never
// deals with `undefined`, strings typed in a form or out-of-range numbers.
// -----------------------------------------------------------------------------

// Defaults: they MUST stay equal to the `default` values of the manifest
// `config_schema` (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  // Address of the Solar-Log on the LAN. No default: the user types it.
  host: '',
  // Password of the "user" access level, only when the Solar-Log protects it.
  password: '',
  // Seconds between two reads. The Solar-Log refreshes its own values about
  // every 15 to 60 seconds: reading faster only loads its small web server.
  poll_frequency: 60,
  // Production (W) above which the plant is "producing" (production_started).
  production_threshold: 50,
  // Surplus (production - consumption, W) that fires surplus_started...
  surplus_threshold: 1000,
  // ...and how far below it the surplus must drop to fire surplus_ended, so a
  // passing cloud does not start and stop the dishwasher ten times.
  surplus_hysteresis: 200,
  // One Gladys device per inverter (needs the extended JSON data).
  inverters: true,
};

// Bounds of the numeric fields, mirrored from the manifest `min` / `max`.
const BOUNDS = {
  poll_frequency: [30, 3600],
  production_threshold: [0, 100000],
  surplus_threshold: [0, 1000000],
  surplus_hysteresis: [0, 100000],
};

function toNumber(value, key) {
  const number = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(number)) {
    return DEFAULT_CONFIG[key];
  }
  const [min, max] = BOUNDS[key];
  return Math.min(max, Math.max(min, number));
}

function toBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return value === true || value === 'true' || value === 1 || value === '1';
}

/**
 * Normalize the host typed by the user into a base URL: `192.168.1.20`,
 * `http://192.168.1.20/` and `solarlog.local:8080` all work.
 *
 * @param {unknown} host
 * @returns {string} `http(s)://host[:port]` without trailing slash, or ''
 */
export function normalizeHost(host) {
  let value = String(host ?? '').trim();
  if (value === '') {
    return '';
  }
  if (!/^https?:\/\//i.test(value)) {
    value = `http://${value}`;
  }
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    host: normalizeHost(raw.host),
    password: typeof raw.password === 'string' ? raw.password : '',
    poll_frequency: toNumber(raw.poll_frequency, 'poll_frequency'),
    production_threshold: toNumber(raw.production_threshold, 'production_threshold'),
    surplus_threshold: toNumber(raw.surplus_threshold, 'surplus_threshold'),
    surplus_hysteresis: toNumber(raw.surplus_hysteresis, 'surplus_hysteresis'),
    inverters: toBoolean(raw.inverters, DEFAULT_CONFIG.inverters),
  };
}
