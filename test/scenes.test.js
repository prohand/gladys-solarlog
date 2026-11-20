import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SCENE_ACTIONS, YIELD_PERIODS } from '../src/capabilities/scenes.js';
import { TRIGGERS } from '../src/solarlog/monitor.js';
import { setup } from './helpers/setup.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const declarationOf = (list, key) => manifest[list].find((entry) => entry.key === key);
const keysOf = (list) => (list ?? []).map((entry) => entry.key);

function assertDeclaredOutputs(key, outputs) {
  const declared = declarationOf('scene_actions', key).outputs;
  for (const [name, value] of Object.entries(outputs)) {
    const output = declared.find((entry) => entry.key === name);
    assert.ok(output, `${key}: output "${name}" is not declared, the core would drop it`);
    assert.equal(typeof value, output.type, `${key}: output "${name}" must be a ${output.type}`);
  }
}

test('read_values returns the live values', async () => {
  const { service } = await setup();
  const outputs = await SCENE_ACTIONS.read_values(service, { fields: {} });
  assert.deepEqual(outputs, {
    reachable: true,
    production_w: 3200,
    consumption_w: 900,
    surplus_w: 2300,
    yield_today_kwh: 12.45,
    self_consumption_percent: 28,
  });
  assertDeclaredOutputs('read_values', outputs);
});

test('read_values reports an unreachable Solar-Log through its output', async () => {
  const { fake, service } = await setup();
  fake.state.down = true;
  const outputs = await SCENE_ACTIONS.read_values(service, { fields: {} });
  assert.equal(outputs.reachable, false);
  assertDeclaredOutputs('read_values', outputs);
});

test('check_surplus compares the surplus with the minimum', async () => {
  const { service } = await setup();
  assert.deepEqual(await SCENE_ACTIONS.check_surplus(service, { fields: { min_surplus: 2000 } }), {
    available: true,
    surplus_w: 2300,
  });
  const outputs = await SCENE_ACTIONS.check_surplus(service, { fields: { min_surplus: 2500 } });
  assert.equal(outputs.available, false);
  assertDeclaredOutputs('check_surplus', outputs);
});

test('check_surplus is never true on stale data', async () => {
  const { fake, service } = await setup();
  await service.refresh();
  fake.state.down = true;
  const outputs = await SCENE_ACTIONS.check_surplus(service, { fields: { min_surplus: 0 } });
  assert.equal(outputs.available, false);
});

test('get_yield returns the energies of every declared period', async () => {
  const { service } = await setup();
  const options = declarationOf('scene_actions', 'get_yield').fields[0].options.map((o) => o.value);
  assert.deepEqual(options.sort(), Object.keys(YIELD_PERIODS).sort());
  const outputs = await SCENE_ACTIONS.get_yield(service, { fields: { period: 'month' } });
  assert.deepEqual(outputs, { reachable: true, production_kwh: 210, consumption_kwh: 150 });
  assertDeclaredOutputs('get_yield', outputs);
});

test('the data of every fired event is declared by its trigger', async () => {
  // Every event the monitor can fire, with the data it carries.
  const { gladys, fake, service } = await setup({ solarLog: { basic: { 101: 0, 110: 300 } } });
  await service.refresh();
  fake.state.basic = { ...fake.state.basic, 101: 2500 };
  await service.refresh(); // production + surplus started
  fake.state.basic = { ...fake.state.basic, 101: 0 };
  await service.refresh(); // production stopped + surplus ended
  fake.state.down = true;
  for (let i = 0; i < 3; i += 1) await service.refresh().catch(() => {});
  fake.state.down = false;
  await service.refresh(); // lost then restored

  const fired = new Set(gladys.fake.sceneEvents.map((event) => event.key));
  assert.deepEqual([...fired].sort(), Object.values(TRIGGERS).sort(), 'every trigger is exercised');
  for (const { key, data } of gladys.fake.sceneEvents) {
    const trigger = declarationOf('scene_triggers', key);
    const declared = [...keysOf(trigger.fields), ...keysOf(trigger.variables)];
    for (const [name, value] of Object.entries(data)) {
      assert.ok(declared.includes(name), `${key}: data.${name} is not declared`);
      assert.ok(value === null || typeof value !== 'object', `${key}: data.${name} is flat`);
    }
  }
});

test('connection_lost reasons are the options of its filter', () => {
  const options = declarationOf('scene_triggers', 'connection_lost')
    .fields.find((field) => field.key === 'reason')
    .options.map((option) => option.value);
  assert.deepEqual(options.sort(), [
    'auth',
    'invalid_data',
    'json_disabled',
    'not_configured',
    'unreachable',
  ]);
});
