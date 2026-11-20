import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGETS, WIDGET_KEYS, refreshWidgets } from '../src/capabilities/widgets.js';
import { buildDiscoveredDevices } from '../src/devices/index.js';
import { LANGUAGES } from '../src/i18n.js';
import { setup } from './helpers/setup.js';

const request = (language = 'en') => ({ settings: {}, language, units: 'metric' });

test('every widget content is rendered exactly as sent, in every language', async () => {
  const { gladys, service } = await setup({ solarLog: { battery: [50, 50, 0, 0] } });
  await service.refresh();
  for (const [key, widget] of Object.entries(WIDGETS)) {
    for (const language of LANGUAGES) {
      const content = await widget.get(gladys, service, request(language));
      assert.deepEqual(validateWidgetContent(content), [], `${key} (${language})`);
    }
  }
});

test('the contents are valid before the first reading and without a meter', async () => {
  const { gladys, fake, service } = await setup({
    solarLog: { basic: { 110: 0, 111: 0, 115: 0 } },
  });
  for (const widget of Object.values(WIDGETS)) {
    assert.deepEqual(validateWidgetContent(await widget.get(gladys, service, request())), []);
  }
  fake.state.down = true;
  await service.refresh().catch(() => {});
  for (const widget of Object.values(WIDGETS)) {
    const content = await widget.get(gladys, service, request('fr'));
    assert.deepEqual(validateWidgetContent(content), []);
    assert.match(content.components[0].text, /ne répond pas/);
  }
  fake.state.down = false;
  await service.refresh();
  for (const widget of Object.values(WIDGETS)) {
    assert.deepEqual(validateWidgetContent(await widget.get(gladys, service, request())), []);
  }
});

test('the live tiles and the chart reference published features', async () => {
  const { gladys, service } = await setup();
  await service.refresh();
  const features = new Set(
    buildDiscoveredDevices(gladys, service.inventory).flatMap((d) =>
      d.features.map((f) => f.external_id),
    ),
  );
  const content = await WIDGETS[WIDGET_KEYS.OVERVIEW].get(gladys, service, request());
  const referenced = content.components.flatMap((c) => [
    ...(c.device_feature ? [c.device_feature] : []),
    ...(c.device_features ?? []),
  ]);
  assert.ok(referenced.length >= 3);
  for (const id of referenced) {
    assert.ok(features.has(id), `unknown feature ${id}`);
  }
});

test('the refresh button reads now and answers a short toast', async () => {
  const { gladys, service } = await setup();
  const content = await WIDGETS[WIDGET_KEYS.OVERVIEW].get(gladys, service, request());
  const buttons = content.components.filter((c) => c.type === 'button');
  assert.equal(buttons.length, 0, 'no snapshot yet: no button');
  await service.refresh();
  const live = await WIDGETS[WIDGET_KEYS.OVERVIEW].get(gladys, service, request());
  const [button] = live.components.filter((c) => c.type === 'button');
  const toast = await WIDGETS[WIDGET_KEYS.OVERVIEW].action(gladys, service, {
    actionKey: button.action.key,
    params: {},
  });
  for (const language of LANGUAGES) {
    assert.ok(toast[language].length <= 200);
  }
  assert.equal(toast.fr, 'Production : 3\u202f200 W');
  assert.equal(toast.de, 'Erzeugung: 3.200 W');
});

test('a failed refresh reaches the user as an error', async () => {
  const { gladys, fake, service } = await setup();
  fake.state.down = true;
  await assert.rejects(
    WIDGETS[WIDGET_KEYS.OVERVIEW].action(gladys, service, { actionKey: 'refresh', params: {} }),
    /does not answer/,
  );
  await assert.rejects(
    WIDGETS[WIDGET_KEYS.OVERVIEW].action(gladys, service, { actionKey: 'nope', params: {} }),
    /Unknown widget action/,
  );
});

test('refreshWidgets nudges every widget', async () => {
  const { gladys } = await setup();
  refreshWidgets(gladys);
  assert.deepEqual(gladys.fake.widgetRefreshes, Object.keys(WIDGETS));
});
