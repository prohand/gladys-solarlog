// -----------------------------------------------------------------------------
// An in-memory Solar-Log, answering like its open JSON interface does, behind
// a `fetch` the client takes as an option. No network in the tests.
// -----------------------------------------------------------------------------

import bcrypt from 'bcryptjs';

export const BASIC = {
  100: '20.11.26 12:30:15',
  101: 3200,
  102: 3350,
  103: 231,
  104: 610,
  105: 12450,
  106: 18300,
  107: 210000,
  108: 4100000,
  109: 25600000,
  110: 900,
  111: 6400,
  112: 9100,
  113: 150000,
  114: 2900000,
  115: 18700000,
  116: 6000,
};

/**
 * @param {object} [options]
 * @param {string} [options.password] protects the extended data
 * @param {boolean} [options.hashed] recent firmware: bcrypt-hashed password expected
 * @param {boolean} [options.jsonDisabled] the open JSON interface is off
 * @param {object} [options.basic] the 801.170 block
 * @param {string[]} [options.inverters] names, one per slot in use
 * @param {number[] | null} [options.battery] the 858 array, null for none
 */
export function createFakeSolarLog(options = {}) {
  const salt = bcrypt.genSaltSync(4);
  const state = {
    basic: { ...BASIC, ...options.basic },
    inverters: options.inverters ?? ['SMA STP 6000'],
    inverterPower: options.inverterPower ?? [3200],
    battery: options.battery ?? null,
    down: false,
    jsonDisabled: options.jsonDisabled ?? false,
    requests: [],
    logins: 0,
  };
  const session = 'sess-42';
  const expected = options.hashed
    ? bcrypt.hashSync(options.password ?? '', salt)
    : options.password;

  const reply = (text, headers = {}) => new Response(text, { status: 200, headers });

  function isLoggedIn(init, body) {
    if (!options.password) {
      return true;
    }
    const cookie = init.headers?.Cookie ?? '';
    return (
      cookie.includes(`SolarLog=${session}`) &&
      (options.hashed || body.startsWith(`token=${session};`))
    );
  }

  async function fetch(url, init) {
    const path = new URL(url).pathname;
    const body = String(init.body ?? '');
    state.requests.push({ path, body, headers: init.headers });
    if (state.down) {
      throw new TypeError('fetch failed');
    }
    if (path === '/login') {
      state.logins += 1;
      if (!options.password) {
        return reply('FAILED - User was wrong');
      }
      const password = decodeURIComponent(body.replace(/^u=user&p=/, ''));
      if (password !== expected) {
        return reply('FAILED - Password was wrong');
      }
      return reply('SUCCESS - Password was correct, you are now logged in', {
        'Set-Cookie': `SolarLog=${session}; path=/`,
      });
    }
    if (path !== '/getjp') {
      return new Response('not found', { status: 404 });
    }
    if (state.jsonDisabled) {
      return reply('{"QUERY IMPOSSIBLE 000"}');
    }
    const json = body.replace(/^token=[^;]*;\s*/, '');
    const query = JSON.parse(json);
    const answer = {};
    const extended = isLoggedIn(init, body);
    for (const key of Object.keys(query)) {
      if (key === '801') {
        answer['801'] = {};
        for (const sub of Object.keys(query['801'])) {
          if (sub === '170') answer['801']['170'] = state.basic;
          if (sub === '101') answer['801']['101'] = '3.6.0 Build 120';
          if (sub === '102') answer['801']['102'] = '01.06.2025';
        }
      } else if (key === '550') {
        answer['550'] = { 104: options.hashed ? salt : 'QUERY IMPOSSIBLE 000' };
      } else if (!extended) {
        return reply('ACCESS DENIED');
      } else if (key === '740') {
        answer['740'] = Object.fromEntries(
          [...state.inverters.map(() => 'Ok'), 'Err', 'Err'].map((v, i) => [String(i), v]),
        );
      } else if (key === '141') {
        answer['141'] = Object.fromEntries(
          Object.keys(query['141']).map((slot) => [slot, { 119: state.inverters[Number(slot)] }]),
        );
      } else if (key === '782') {
        answer['782'] = Object.fromEntries(
          state.inverterPower.map((w, i) => [String(i), String(w)]),
        );
      } else if (key === '858') {
        answer['858'] = state.battery ?? [];
      } else {
        answer[key] = 'QUERY IMPOSSIBLE 000';
      }
    }
    return reply(JSON.stringify(answer));
  }

  return { fetch, state };
}
