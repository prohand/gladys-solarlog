import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAILURES_BEFORE_LOST, TRIGGERS } from '../src/solarlog/monitor.js';
import { solarLog, FEATURES } from '../src/devices/solarLog.js';
import { inverter } from '../src/devices/inverter.js';
import { battery } from '../src/devices/battery.js';
import { setup } from './helpers/setup.js';

test('a read publishes the states, the connection status and the badges', async () => {
  const { gladys, service, changes } = await setup();
  await service.refresh();
  const production = solarLog.featureExternalId(gladys, FEATURES.PRODUCTION_POWER);
  assert.equal(gladys.fake.lastState(production), 3200);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.ok(gladys.fake.transports.every((entry) => entry.transport === 'local'));
  assert.equal(changes(), 1, 'the widgets are nudged');
});

test('the inverters and the battery are discovered and published', async () => {
  const { gladys, service } = await setup({
    solarLog: {
      inverters: ['East', 'West'],
      inverterPower: [1500, 1700],
      battery: [51, 64, 300, 0],
    },
  });
  await service.refresh();
  const published = gladys.fake.discoveredDevices.map((device) => device.external_id);
  assert.ok(published.includes(inverter.deviceExternalId(gladys, 0)));
  assert.ok(published.includes(inverter.deviceExternalId(gladys, 1)));
  assert.ok(published.includes(battery.deviceExternalId(gladys)));
  const west = gladys.fake.discoveredDevices.find(
    (device) => device.external_id === inverter.deviceExternalId(gladys, 1),
  );
  assert.equal(west.name, 'Solar-Log – West');
  assert.equal(gladys.fake.lastState(`${inverter.deviceExternalId(gladys, 1)}:power`), 1700);
  assert.equal(gladys.fake.lastState(`${battery.deviceExternalId(gladys)}:level`), 64);
});

test('the inverter toggle off publishes no inverter device', async () => {
  const { gladys, service } = await setup({ config: { inverters: false } });
  await service.refresh();
  assert.equal(service.inventory.inverters.length, 0);
  assert.ok(!gladys.fake.discoveredDevices.some((d) => d.external_id.includes(':inverter:')));
});

test('unchanged values are not re-sent at every read', async () => {
  const { gladys, service } = await setup();
  await service.refresh();
  const count = gladys.fake.states.length;
  await service.refresh();
  assert.equal(gladys.fake.states.length, count);
});

test('a refused extended access keeps the plant summary working', async () => {
  const { gladys, service } = await setup({ solarLog: { password: 'secret' } });
  await service.refresh();
  assert.equal(service.inventory.inverters.length, 0);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('an unreachable Solar-Log reports the status once and fires connection_lost', async () => {
  const { gladys, fake, service } = await setup();
  await service.refresh();
  fake.state.down = true;
  for (let i = 0; i < FAILURES_BEFORE_LOST; i += 1) {
    await assert.rejects(service.refresh());
  }
  const statuses = gladys.fake.connectionStatuses.filter((status) => !status.connected);
  assert.equal(statuses.length, 1, 'the same failure is reported once');
  assert.match(statuses[0].message.fr, /ne répond pas/);
  assert.ok(gladys.fake.transports.some((entry) => entry.transport === 'unreachable'));
  assert.deepEqual(gladys.fake.sceneEvents.at(-1), {
    key: TRIGGERS.CONNECTION_LOST,
    data: { reason: 'unreachable' },
  });

  fake.state.down = false;
  await service.refresh();
  assert.equal(gladys.fake.sceneEvents.at(-1).key, TRIGGERS.CONNECTION_RESTORED);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('a surplus fires surplus_started with its data', async () => {
  const { gladys, fake, service } = await setup({ solarLog: { basic: { 101: 1200, 110: 900 } } });
  await service.refresh();
  fake.state.basic = { ...fake.state.basic, 101: 2500 };
  await service.refresh();
  assert.deepEqual(gladys.fake.sceneEvents.at(-1), {
    key: TRIGGERS.SURPLUS_STARTED,
    data: { surplus_w: 1600, production_w: 2500, consumption_w: 900 },
  });
});

test('no address configured: a clear status, no request', async () => {
  const { gladys, fake, service } = await setup({ config: { host: '' } });
  await assert.rejects(service.refresh(), { code: 'not_configured' });
  assert.equal(fake.state.requests.length, 0);
  assert.match(gladys.fake.connectionStatus.message.en, /address/);
});

test('concurrent reads share one request', async () => {
  const { fake, service } = await setup({ config: { inverters: false } });
  await Promise.all([service.refresh(), service.refresh(), service.refresh()]);
  assert.equal(fake.state.requests.filter((r) => r.body.includes('"801"')).length, 1);
});

test('the read loop reads at the configured pace', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { fake, service } = await setup({ config: { poll_frequency: 120, inverters: false } });
  const reads = () => fake.state.requests.filter((r) => r.body.includes('"170"')).length;
  service.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads(), 1, 'reads right away');
  t.mock.timers.tick(119_000);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads(), 1);
  t.mock.timers.tick(1_000);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reads(), 2);
  service.stop();
});

test('a refusal from Gladys does not make the Solar-Log unreachable', async () => {
  const { gladys, service } = await setup();
  gladys.publishChangedStates = async () => {
    throw new Error('429 Too Many Requests');
  };
  await service.refresh();
  assert.equal(service.reachable, true);
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('a failed inventory read keeps the inverters already known', async () => {
  const { fake, service } = await setup({
    solarLog: { inverters: ['East', 'West'], inverterPower: [1, 2] },
  });
  await service.refresh();
  assert.equal(service.inventory.inverters.length, 2);
  const original = fake.fetch;
  service.client.fetch = async (url, init) => {
    if (String(init.body).includes('"740"')) throw new TypeError('fetch failed');
    return original(url, init);
  };
  await service.rediscover();
  assert.equal(service.inventory.inverters.length, 2);
});
