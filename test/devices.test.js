import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { buildDiscoveredDevices, buildStates } from '../src/devices/index.js';
import { parseBasicData } from '../src/solarlog/parse.js';
import { BASIC } from './helpers/fakeSolarLog.js';

const FULL = {
  hasConsumptionMeter: true,
  inverters: [
    { index: 0, name: 'East' },
    { index: 1, name: null },
  ],
  hasBattery: true,
};

test('Gladys accepts the discovery payload', async () => {
  // The SDK fake refuses what the host API refuses (unknown category, type,
  // unit, missing NOT NULL column...): a 400 would hide every device.
  const gladys = createFakeGladys();
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, FULL));
  assert.equal(gladys.fake.discoveredDevices.length, 4);
});

test('every feature carries the columns Gladys needs to create it', () => {
  const gladys = createFakeGladys();
  for (const device of buildDiscoveredDevices(gladys, FULL)) {
    for (const feature of device.features) {
      const where = `${device.name} / ${feature.name}`;
      assert.ok(feature.name, `${where}: name`);
      assert.ok(Number.isFinite(feature.min) && Number.isFinite(feature.max), `${where}: min/max`);
      assert.ok(feature.min <= feature.max, `${where}: min <= max`);
      assert.equal(feature.read_only, true, `${where}: every feature is a measurement`);
      assert.equal(typeof feature.has_feedback, 'boolean', `${where}: has_feedback`);
    }
  }
});

test('no device is polled by Gladys: the integration reads on its own timer', () => {
  const gladys = createFakeGladys();
  for (const device of buildDiscoveredDevices(gladys, FULL)) {
    assert.equal(device.poll_frequency, undefined, device.name);
  }
});

test('external ids are stable and unique', () => {
  const gladys = createFakeGladys();
  const ids = buildDiscoveredDevices(gladys, FULL).flatMap((device) => [
    device.external_id,
    ...device.features.map((feature) => feature.external_id),
  ]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes(`ext:${gladys.selector}:solarlog:main:production-power`));
});

test('an unnamed inverter gets a readable name', () => {
  const gladys = createFakeGladys();
  const names = buildDiscoveredDevices(gladys, FULL).map((device) => device.name);
  assert.ok(names.includes('Solar-Log – East'));
  assert.ok(names.includes('Solar-Log – Inverter 2'));
});

test('without a consumption meter, no consumption feature', () => {
  const gladys = createFakeGladys();
  const [device] = buildDiscoveredDevices(gladys, { ...FULL, hasConsumptionMeter: false });
  assert.ok(!device.features.some((feature) => feature.external_id.includes('consumption')));
});

test('every published state targets a discovered feature', () => {
  const gladys = createFakeGladys();
  const features = new Set(
    buildDiscoveredDevices(gladys, FULL).flatMap((d) => d.features.map((f) => f.external_id)),
  );
  const snapshot = {
    reading: parseBasicData(BASIC),
    inverterPower: new Map([
      [0, 1500],
      [1, 1700],
    ]),
    battery: { level_percent: 50, charge_power_w: 0, discharge_power_w: 100 },
  };
  const states = buildStates(gladys, snapshot, FULL);
  assert.equal(states.length, 14);
  for (const state of states) {
    assert.ok(features.has(state.device_feature_external_id), state.device_feature_external_id);
    assert.ok(Number.isFinite(state.state));
  }
});

test('a total index at 0 (Solar-Log restarting) is not published', () => {
  const gladys = createFakeGladys();
  const reading = parseBasicData({ ...BASIC, 109: 0 });
  const states = buildStates(gladys, { reading }, FULL);
  assert.ok(!states.some((state) => state.device_feature_external_id.endsWith(':yield-total')));
});
