// -----------------------------------------------------------------------------
// Consistency checks between `gladys-assistant-integration.json` and the code.
// The store indexer validates the manifest shape; only these tests know which
// handlers the code registers and which events it fires.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ACTIONS } from '../src/capabilities/actions.js';
import { SCENE_ACTIONS } from '../src/capabilities/scenes.js';
import { WIDGETS } from '../src/capabilities/widgets.js';
import { TRIGGERS } from '../src/solarlog/monitor.js';
import { DEFAULT_CONFIG } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const keysOf = (list) => (list ?? []).map((entry) => entry.key);

// Every list of form fields the manifest declares (same field grammar).
const allFields = [
  ...manifest.config_schema,
  ...[...manifest.actions, ...manifest.scene_triggers, ...manifest.scene_actions].flatMap(
    (item) => item.fields ?? [],
  ),
];

function minGladysVersion() {
  const match = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.(\d+)/);
  assert.ok(match, 'gladys_version must declare a minimum version');
  return match.slice(1).map(Number);
}

function isAtLeast(version, required) {
  for (let i = 0; i < required.length; i += 1) {
    if (version[i] !== required[i]) {
      return version[i] > required[i];
    }
  }
  return true;
}

/** Every multi-language text of the manifest, with its path. */
function* texts(node, path = '') {
  if (Array.isArray(node)) {
    for (const [index, child] of node.entries()) yield* texts(child, `${path}[${index}]`);
  } else if (node && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      if (['label', 'description', 'placeholder'].includes(key)) {
        yield [`${path}.${key}`, child];
      } else {
        yield* texts(child, `${path}.${key}`);
      }
    }
  }
}

test('every text is written in English, French, German and Spanish', () => {
  for (const [path, text] of texts(manifest)) {
    assert.equal(typeof text, 'object', `${path} must be a multi-language object`);
    assert.deepEqual(Object.keys(text).sort(), [...LANGUAGES].sort(), `${path}: languages`);
    for (const [language, value] of Object.entries(text)) {
      assert.ok(value.trim().length > 0, `${path}.${language} is empty`);
    }
  }
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [language, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${language}: ${text.length}`);
  }
});

test('the integration declares a local-only transport', () => {
  // The Solar-Log is read on the LAN only (its open JSON interface): no
  // cloud channel, so no "prefer local" toggle to show.
  assert.deepEqual(manifest.transports, ['local']);
});

test('countries are unique ISO 3166-1 alpha-2 codes', () => {
  assert.ok(manifest.countries.length >= 1 && manifest.countries.length <= 20);
  assert.equal(new Set(manifest.countries).size, manifest.countries.length);
  for (const code of manifest.countries) {
    assert.match(code, /^[A-Z]{2}$/);
  }
});

test('keywords are 1 to 10 unique terms of 2 to 30 characters', () => {
  const normalized = manifest.keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.ok(normalized.length >= 1 && normalized.length <= 10);
  assert.equal(new Set(normalized).size, normalized.length);
  for (const keyword of normalized) {
    assert.ok(keyword.length >= 2 && keyword.length <= 30, keyword);
  }
});

test('gladys_version covers every field older cores reject', () => {
  // categories: 4.86.0; widgets / scene triggers / scene actions: 5.1.0;
  // keywords / countries: 5.3.0.
  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
  assert.ok(manifest.scene_triggers && manifest.scene_actions && manifest.widgets);
  assert.ok(manifest.keywords && manifest.countries);
  assert.ok(isAtLeast(minGladysVersion(), [5, 3, 0]), manifest.gladys_version);
});

test('every manifest action has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.actions).sort(), Object.keys(ACTIONS).sort());
});

test('every scene action has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_actions).sort(), Object.keys(SCENE_ACTIONS).sort());
});

test('every scene trigger the code fires is declared, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.scene_triggers).sort(), Object.values(TRIGGERS).sort());
});

test('every widget has a handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.widgets).sort(), Object.keys(WIDGETS).sort());
  for (const widget of manifest.widgets) {
    for (const [language, label] of Object.entries(widget.label)) {
      assert.ok(label.length >= 3 && label.length <= 30, `${widget.key}.label.${language}`);
    }
    for (const [language, text] of Object.entries(widget.description)) {
      assert.ok(text.length <= 100, `${widget.key}.description.${language}`);
    }
  }
});

test('config_schema defaults stay consistent with DEFAULT_CONFIG', () => {
  const stored = manifest.config_schema.filter((field) => field.type !== 'section');
  assert.deepEqual(stored.map((field) => field.key).sort(), Object.keys(DEFAULT_CONFIG).sort());
  for (const field of stored) {
    if (field.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[field.key], field.default, field.key);
    }
  }
});

test('the password is a secret field', () => {
  const password = manifest.config_schema.find((field) => field.key === 'password');
  assert.equal(password.type, 'secret');
  assert.equal(password.default, undefined);
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((f) => f.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('field defaults match their type and options', () => {
  for (const field of allFields) {
    if (field.default === undefined) continue;
    if (field.type === 'number') assert.equal(typeof field.default, 'number', field.key);
    if (field.type === 'boolean') assert.equal(typeof field.default, 'boolean', field.key);
    if (field.type === 'select') {
      assert.ok(
        field.options.some((option) => option.value === field.default),
        field.key,
      );
    }
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`), manifest.docker_image);
});
