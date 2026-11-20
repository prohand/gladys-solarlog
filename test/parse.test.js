import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBasicData,
  parseInverterPower,
  parseInverterSlots,
  parseLastUpdate,
} from '../src/solarlog/parse.js';
import { ERROR_CODES } from '../src/solarlog/errors.js';
import { BASIC } from './helpers/fakeSolarLog.js';

test('energies are converted from Wh to kWh', () => {
  const reading = parseBasicData(BASIC);
  assert.equal(reading.yield_today_kwh, 12.45);
  assert.equal(reading.yield_total_kwh, 25600);
  assert.equal(reading.consumption_total_kwh, 18700);
  assert.equal(reading.installed_power_wp, 6000);
});

test('surplus, self-consumption and peak share are computed', () => {
  const reading = parseBasicData(BASIC);
  assert.equal(reading.surplus_w, 2300);
  assert.equal(reading.self_consumption_percent, 28);
  assert.equal(reading.capacity_percent, 53);
});

test('without a consumption meter there is no surplus to tell', () => {
  const reading = parseBasicData({ ...BASIC, 110: 0, 111: 0, 115: 0 });
  assert.equal(reading.has_consumption_meter, false);
  assert.equal(reading.surplus_w, null);
  assert.equal(reading.self_consumption_percent, null);
});

test('at night the self-consumption share is unknown, not 0 or 100', () => {
  const reading = parseBasicData({ ...BASIC, 101: 0 });
  assert.equal(reading.self_consumption_percent, null);
  assert.equal(reading.surplus_w, -900);
});

test('values dated 1999 (Solar-Log restarting) are refused', () => {
  assert.throws(() => parseBasicData({ ...BASIC, 100: '01.01.99 00:00:00' }), {
    code: ERROR_CODES.INVALID_DATA,
  });
});

test('numbers sent as strings and garbage are tolerated', () => {
  const reading = parseBasicData({ ...BASIC, 101: '1500', 102: 'n/a' });
  assert.equal(reading.production_w, 1500);
  assert.equal(reading.dc_power_w, 0);
});

test('the last update stamp is read', () => {
  assert.deepEqual(parseLastUpdate('20.11.26 12:30:15'), {
    text: '2026-11-20 12:30:15',
    year: 2026,
  });
  assert.equal(parseLastUpdate('garbage'), null);
});

test('inverter slots skip the unused ones', () => {
  assert.deepEqual(parseInverterSlots({ 0: 'Ok', 1: 'Err', 2: 'Ok' }), [0, 2]);
  assert.deepEqual(parseInverterSlots('QUERY IMPOSSIBLE 000'), []);
  assert.deepEqual(
    [...parseInverterPower({ 0: '1200', 2: 300 })],
    [
      [0, 1200],
      [2, 300],
    ],
  );
});
