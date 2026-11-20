import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS } from '../src/capabilities/actions.js';
import { LANGUAGES } from '../src/i18n.js';
import { setup } from './helpers/setup.js';

test('test_connection answers the live values and the firmware in every language', async () => {
  const { service } = await setup();
  const message = await ACTIONS.test_connection(service, { fields: {} });
  assert.deepEqual(Object.keys(message), LANGUAGES);
  assert.equal(message.en, 'Solar-Log OK (firmware 3.6.0 Build 120): 3,200 W now, 12.5 kWh today.');
  assert.match(message.de, /3\.200 W/);
});

test('test_connection explains a failure instead of throwing', async () => {
  const { service } = await setup({ solarLog: { jsonDisabled: true } });
  const message = await ACTIONS.test_connection(service, { fields: {} });
  assert.match(message.en, /open JSON interface is disabled/);
  assert.match(message.es, /interfaz JSON abierta/);
});

test('rediscover publishes the devices and counts what it found', async () => {
  const { gladys, service } = await setup({
    solarLog: { inverters: ['A', 'B', 'C'], inverterPower: [1, 2, 3] },
  });
  const message = await ACTIONS.rediscover(service, { fields: {} });
  assert.match(message.en, /^3 inverter\(s\) found/);
  assert.ok(gladys.fake.discoveredDevices.length >= 4);
});
