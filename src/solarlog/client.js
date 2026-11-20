// -----------------------------------------------------------------------------
// HTTP client of the Solar-Log open JSON interface (local network only).
//
// Every read is a POST to /getjp whose body is a JSON query of numeric keys.
// The interface must be enabled on the Solar-Log ("Open JSON Interface");
// when it is off, the answer is `{"QUERY IMPOSSIBLE 000"}`.
//
// Access protection: the live summary (801.170) is open once the interface is
// on. When the "user" access level has a password, the extended data
// (inverters, battery) answers "ACCESS DENIED" until we log in:
//   1. POST /login `u=user&p=<password>` -> a `SolarLog` session cookie;
//   2. "FAILED - User was wrong" means no password is set: nothing to do;
//   3. "FAILED - Password was wrong" on a recent firmware means it expects
//      the password hashed with bcrypt and the salt it publishes in 550.104;
//   4. older firmwares also want the session as `token=<cookie>; ` in front
//      of every query body, newer ones only read the cookie.
// The password and the session never reach the logs.
// -----------------------------------------------------------------------------

import bcrypt from 'bcryptjs';
import { ERROR_CODES, SolarLogError } from './errors.js';
import { parseBasicData, parseBattery, parseInverterPower, parseInverterSlots } from './parse.js';

const HEADERS = { 'Content-Type': 'text/html', 'X-SL-CSRF-PROTECTION': '1' };
const DEFAULT_TIMEOUT_MS = 10_000;

/** The `SolarLog=<value>` session cookie of a response, if any. */
function sessionCookieOf(response) {
  const cookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie') ?? ''];
  for (const cookie of cookies) {
    const match = /(?:^|[;,\s])SolarLog=([^;,\s]+)/.exec(cookie);
    if (match) {
      return match[1];
    }
  }
  return null;
}

export class SolarLogClient {
  /**
   * @param {object} options
   * @param {string} options.host base URL, e.g. http://192.168.1.20
   * @param {string} [options.password] password of the "user" access level
   * @param {number} [options.timeoutMs]
   * @param {typeof fetch} [options.fetch] injected by the tests
   */
  constructor({ host, password = '', timeoutMs = DEFAULT_TIMEOUT_MS, fetch = globalThis.fetch }) {
    this.host = host;
    this.password = password;
    this.timeoutMs = timeoutMs;
    this.fetch = fetch;
    this.cookie = null; // SolarLog session cookie
    this.token = null; // same value, sent in the body for older firmwares
  }

  async request(path, body) {
    if (!this.host) {
      throw new SolarLogError(ERROR_CODES.NOT_CONFIGURED);
    }
    const headers = { ...HEADERS };
    if (this.cookie) {
      headers.Cookie = `SolarLog=${this.cookie}`;
    }
    let response;
    try {
      response = await this.fetch(`${this.host}/${path}`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new SolarLogError(ERROR_CODES.UNREACHABLE, err?.message ?? String(err));
    }
    if (response.status === 401 || response.status === 403) {
      throw new SolarLogError(ERROR_CODES.AUTH, `HTTP ${response.status}`);
    }
    if (!response.ok) {
      throw new SolarLogError(ERROR_CODES.UNREACHABLE, `HTTP ${response.status}`);
    }
    return { response, text: await response.text() };
  }

  /**
   * Send one JSON query and decode the answer. An "ACCESS DENIED" answer
   * triggers one login (when a password is configured) and one retry.
   * @param {object} query e.g. `{ 801: { 170: null } }`
   */
  async query(query, { retried = false } = {}) {
    const json = JSON.stringify(query);
    const body = this.token ? `token=${this.token}; ${json}` : json;
    const { text } = await this.request('getjp', body);

    if (text.includes('QUERY IMPOSSIBLE 000') && !text.trimStart().startsWith('{"')) {
      throw new SolarLogError(ERROR_CODES.JSON_DISABLED);
    }
    if (text.includes('{"QUERY IMPOSSIBLE 000"}')) {
      throw new SolarLogError(ERROR_CODES.JSON_DISABLED);
    }
    if (text.includes('ACCESS DENIED') && !text.startsWith('{"550":{')) {
      if (!retried && this.password && (await this.login())) {
        return this.query(query, { retried: true });
      }
      throw new SolarLogError(ERROR_CODES.AUTH, 'access denied');
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new SolarLogError(ERROR_CODES.INVALID_DATA, 'answer is not JSON');
    }
  }

  /**
   * Open a session with the "user" password. Resolves false when the
   * Solar-Log has no password set (nothing to log in to).
   */
  async login() {
    this.cookie = null;
    this.token = null;
    if (!this.password) {
      return false;
    }
    let { response, text } = await this.request(
      'login',
      `u=user&p=${encodeURIComponent(this.password)}`,
    );
    if (text.includes('FAILED - User was wrong')) {
      return false;
    }
    let hashed = false;
    if (text.includes('FAILED - Password was wrong')) {
      // Recent firmware: the password is expected bcrypt-hashed with the
      // salt the Solar-Log publishes for the "user" level.
      const salt = (await this.query({ 550: null }, { retried: true }))?.['550']?.['104'];
      if (typeof salt !== 'string' || !salt.startsWith('$2')) {
        throw new SolarLogError(ERROR_CODES.AUTH, 'password refused');
      }
      const hash = await bcrypt.hash(this.password, salt);
      ({ response, text } = await this.request('login', `u=user&p=${encodeURIComponent(hash)}`));
      if (text.includes('FAILED')) {
        throw new SolarLogError(ERROR_CODES.AUTH, 'password refused');
      }
      hashed = true;
    }
    const cookie = sessionCookieOf(response);
    if (!cookie) {
      throw new SolarLogError(ERROR_CODES.AUTH, 'no session cookie');
    }
    this.cookie = cookie;
    this.token = hashed ? null : cookie;
    return true;
  }

  /** The live summary of the plant (see parse.js for the fields). */
  async getBasicData() {
    const answer = await this.query({ 801: { 170: null } });
    return parseBasicData(answer?.['801']?.['170']);
  }

  /** Firmware version, for the "Test the connection" answer. */
  async getFirmware() {
    const answer = await this.query({ 801: { 101: null, 102: null } });
    const version = answer?.['801']?.['101'];
    return typeof version === 'string' ? version : null;
  }

  /**
   * The inverters connected to the Solar-Log: `[{ index, name }]`.
   * Extended data: may need the password.
   */
  async getInverters() {
    const slots = parseInverterSlots((await this.query({ 740: null }))?.['740']);
    if (slots.length === 0) {
      return [];
    }
    const names = await this.query({
      141: Object.fromEntries(slots.map((index) => [String(index), { 119: null }])),
    });
    return slots.map((index) => {
      const name = names?.['141']?.[String(index)]?.['119'];
      return {
        index,
        name: typeof name === 'string' && name.trim() !== '' ? name.trim() : null,
      };
    });
  }

  /** Current AC power of each inverter: `Map(index -> W)`. */
  async getInverterPower() {
    return parseInverterPower((await this.query({ 782: null }))?.['782']);
  }

  /** The battery, or null when none is connected. */
  async getBattery() {
    const answer = await this.query({ 858: null });
    return parseBattery(answer?.['858']);
  }
}
