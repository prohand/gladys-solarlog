// A service wired to a fake Gladys (SDK testing) and a fake Solar-Log.

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { SolarLogClient } from '../../src/solarlog/client.js';
import { createService } from '../../src/service.js';
import { normalizeConfig } from '../../src/config.js';
import { createFakeSolarLog } from './fakeSolarLog.js';

export async function setup({ solarLog = {}, config = {} } = {}) {
  const gladys = createFakeGladys();
  const fake = createFakeSolarLog(solarLog);
  let changes = 0;
  const service = createService(gladys, {
    createClient: (cfg) =>
      new SolarLogClient({ host: cfg.host, password: cfg.password, fetch: fake.fetch }),
    onChange: () => {
      changes += 1;
    },
  });
  await service.configure(normalizeConfig({ host: '192.168.1.20', ...config }));
  return { gladys, fake, service, changes: () => changes };
}
