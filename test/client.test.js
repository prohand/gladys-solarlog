import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SolarLogClient } from '../src/solarlog/client.js';
import { ERROR_CODES } from '../src/solarlog/errors.js';
import { createFakeSolarLog } from './helpers/fakeSolarLog.js';

const HOST = 'http://192.168.1.20';
const clientFor = (fake, password = '') =>
  new SolarLogClient({ host: HOST, password, fetch: fake.fetch });

test('reads the plant summary without any password', async () => {
  const fake = createFakeSolarLog();
  const reading = await clientFor(fake).getBasicData();
  assert.equal(reading.production_w, 3200);
  assert.equal(reading.yield_today_kwh, 12.45);
  assert.equal(reading.surplus_w, 2300);
  const [request] = fake.state.requests;
  assert.equal(request.path, '/getjp');
  assert.equal(request.body, '{"801":{"170":null}}');
  assert.equal(request.headers['X-SL-CSRF-PROTECTION'], '1');
});

test('a disabled JSON interface is reported as such', async () => {
  const fake = createFakeSolarLog({ jsonDisabled: true });
  await assert.rejects(clientFor(fake).getBasicData(), { code: ERROR_CODES.JSON_DISABLED });
});

test('a Solar-Log that does not answer is unreachable', async () => {
  const fake = createFakeSolarLog();
  fake.state.down = true;
  await assert.rejects(clientFor(fake).getBasicData(), { code: ERROR_CODES.UNREACHABLE });
});

test('no host configured is reported before any request', async () => {
  const fake = createFakeSolarLog();
  const client = new SolarLogClient({ host: '', fetch: fake.fetch });
  await assert.rejects(client.getBasicData(), { code: ERROR_CODES.NOT_CONFIGURED });
  assert.equal(fake.state.requests.length, 0);
});

test('extended data logs in with the password (older firmware: token in the body)', async () => {
  const fake = createFakeSolarLog({ password: 's3cret', inverters: ['East', 'West'] });
  const client = clientFor(fake, 's3cret');
  const inverters = await client.getInverters();
  assert.deepEqual(inverters, [
    { index: 0, name: 'East' },
    { index: 1, name: 'West' },
  ]);
  assert.equal(fake.state.logins, 1);
  // The session is reused, no second login.
  await client.getInverterPower();
  assert.equal(fake.state.logins, 1);
});

test('recent firmware: the password is sent bcrypt-hashed with the published salt', async () => {
  const fake = createFakeSolarLog({
    password: 's3cret',
    hashed: true,
    battery: [52.1, 80, 0, 450],
  });
  const battery = await clientFor(fake, 's3cret').getBattery();
  assert.deepEqual(battery, {
    voltage_v: 52.1,
    level_percent: 80,
    charge_power_w: 0,
    discharge_power_w: 450,
  });
  const logins = fake.state.requests.filter((r) => r.path === '/login');
  assert.equal(logins.length, 2, 'plain password first, hashed second');
  assert.match(decodeURIComponent(logins[1].body), /^u=user&p=\$2[aby]\$/);
});

test('a wrong password is an authentication error', async () => {
  const fake = createFakeSolarLog({ password: 's3cret', hashed: true });
  await assert.rejects(clientFor(fake, 'wrong').getInverters(), { code: ERROR_CODES.AUTH });
});

test('extended data without a password configured is an authentication error', async () => {
  const fake = createFakeSolarLog({ password: 's3cret' });
  await assert.rejects(clientFor(fake).getInverters(), { code: ERROR_CODES.AUTH });
});

test('the firmware version is read', async () => {
  const fake = createFakeSolarLog();
  assert.equal(await clientFor(fake).getFirmware(), '3.6.0 Build 120');
});

test('no battery and an unknown key are not errors', async () => {
  const fake = createFakeSolarLog();
  assert.equal(await clientFor(fake).getBattery(), null);
});
