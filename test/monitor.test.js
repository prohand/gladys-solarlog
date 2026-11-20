import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAILURES_BEFORE_LOST, TRIGGERS, createMonitor } from '../src/solarlog/monitor.js';
import { normalizeConfig } from '../src/config.js';

const config = normalizeConfig({
  production_threshold: 100,
  surplus_threshold: 1000,
  surplus_hysteresis: 200,
});
const reading = (production, consumption = 500) => ({
  production_w: production,
  consumption_w: consumption,
  surplus_w: production - consumption,
  yield_today_kwh: 10,
});
const keys = (events) => events.map((event) => event.key);

test('the first reading only sets the baseline', () => {
  const monitor = createMonitor();
  assert.deepEqual(monitor.update(reading(5000), config), []);
});

test('production starts at the threshold and stops below half of it', () => {
  const monitor = createMonitor();
  monitor.update(reading(0, 0), config);
  assert.deepEqual(keys(monitor.update(reading(99, 0), config)), []);
  const started = monitor.update(reading(100, 0), config);
  assert.deepEqual(keys(started), [TRIGGERS.PRODUCTION_STARTED]);
  assert.deepEqual(started[0].data, { production_w: 100 });
  assert.deepEqual(keys(monitor.update(reading(60, 0), config)), [], 'hysteresis');
  const stopped = monitor.update(reading(40, 0), config);
  assert.deepEqual(keys(stopped), [TRIGGERS.PRODUCTION_STOPPED]);
  assert.deepEqual(stopped[0].data, { yield_today_kwh: 10 });
});

test('surplus starts at the threshold and ends below threshold - margin', () => {
  const monitor = createMonitor();
  monitor.update(reading(1000), config); // surplus 500
  const started = monitor.update(reading(1500), config); // surplus 1000
  assert.deepEqual(keys(started), [TRIGGERS.SURPLUS_STARTED]);
  assert.deepEqual(started[0].data, { surplus_w: 1000, production_w: 1500, consumption_w: 500 });
  assert.deepEqual(keys(monitor.update(reading(1350), config)), [], 'passing cloud: 850 W');
  assert.deepEqual(keys(monitor.update(reading(1250), config)), [TRIGGERS.SURPLUS_ENDED]);
});

test('no consumption meter: no surplus event', () => {
  const monitor = createMonitor();
  const noMeter = (p) => ({ ...reading(p), surplus_w: null });
  monitor.update(noMeter(200), config);
  assert.deepEqual(keys(monitor.update(noMeter(5000), config)), []);
});

test('the link is lost after several failures in a row, then restored', () => {
  const monitor = createMonitor();
  monitor.update(reading(2000), config);
  for (let i = 1; i < FAILURES_BEFORE_LOST; i += 1) {
    assert.deepEqual(monitor.fail('unreachable'), [], 'one glitch is not an event');
  }
  assert.deepEqual(monitor.fail('unreachable'), [
    { key: TRIGGERS.CONNECTION_LOST, data: { reason: 'unreachable' } },
  ]);
  assert.deepEqual(monitor.fail('unreachable'), [], 'fired once');
  assert.deepEqual(keys(monitor.update(reading(2000), config)), [TRIGGERS.CONNECTION_RESTORED]);
});

test('a Solar-Log never reached since the start fires nothing', () => {
  const monitor = createMonitor();
  for (let i = 0; i < FAILURES_BEFORE_LOST + 2; i += 1) {
    assert.deepEqual(monitor.fail('unreachable'), []);
  }
});

test('a Solar-Log reached late after the start does not fire "restored"', () => {
  const monitor = createMonitor();
  for (let i = 0; i < FAILURES_BEFORE_LOST; i += 1) {
    monitor.fail('unreachable');
  }
  assert.deepEqual(monitor.update(reading(2000), config), []);
});
