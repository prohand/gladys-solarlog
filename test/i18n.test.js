import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, formatNumber, localize, pick } from '../src/i18n.js';

test('the languages are the ones of the Gladys interface, English first', () => {
  assert.deepEqual(LANGUAGES, ['en', 'fr', 'de', 'es']);
});

test('pick falls back to English', () => {
  assert.equal(pick('de', { en: 'Stop', de: 'Stopp' }), 'Stopp');
  assert.equal(pick('it', { en: 'Stop', de: 'Stopp' }), 'Stop');
});

test('localize builds one text per language', () => {
  assert.deepEqual(
    localize((language) => `[${language}]`),
    { en: '[en]', fr: '[fr]', de: '[de]', es: '[es]' },
  );
});

test('numbers use the decimal mark of the reader', () => {
  assert.equal(formatNumber('en', 12.45, 1), '12.5');
  assert.equal(formatNumber('fr', 12.45, 1), '12,5');
  assert.equal(formatNumber('de', 12.45, 1), '12,5');
  assert.equal(formatNumber('it', 12.45, 1), '12.5');
});
