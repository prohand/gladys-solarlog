import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, normalizeHost } from '../src/config.js';

test('an empty config gets the defaults', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('the host becomes a base URL, whatever the user typed', () => {
  assert.equal(normalizeHost('192.168.1.20'), 'http://192.168.1.20');
  assert.equal(normalizeHost(' http://192.168.1.20/ '), 'http://192.168.1.20');
  assert.equal(normalizeHost('solarlog.local:8080/home'), 'http://solarlog.local:8080');
  assert.equal(normalizeHost('https://pv.example'), 'https://pv.example');
  assert.equal(normalizeHost(''), '');
  assert.equal(normalizeHost('http://'), '');
});

test('numbers typed as strings are converted and kept in range', () => {
  const config = normalizeConfig({
    poll_frequency: '5',
    surplus_threshold: '1500',
    inverters: 'false',
  });
  assert.equal(config.poll_frequency, 30, 'one read per 30 s at most');
  assert.equal(config.surplus_threshold, 1500);
  assert.equal(config.inverters, false);
  assert.equal(normalizeConfig({ poll_frequency: 'abc' }).poll_frequency, 60);
});
