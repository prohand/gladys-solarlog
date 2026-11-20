// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen.
//
// Each handler resolves the multi-language message shown under its button; a
// thrown error is shown too, so the failures carry the user message.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { formatNumber, localize } from '../i18n.js';
import { userMessageOf } from '../solarlog/errors.js';

const logger = createLogger({ name: 'actions' });

function failure(err) {
  logger.warn(`Action failed: ${err.message}`);
  return userMessageOf(err);
}

export const ACTIONS = {
  /** Read the Solar-Log right now and say what it answers. */
  async test_connection(service) {
    let snapshot;
    try {
      snapshot = await service.refresh();
    } catch (err) {
      return failure(err);
    }
    const firmware = await service.client.getFirmware().catch(() => null);
    const { reading } = snapshot;
    const fw = (prefix) => (firmware ? ` (${prefix} ${firmware})` : '');
    return localize((language) => {
      const watts = formatNumber(language, reading.production_w);
      const kwh = formatNumber(language, reading.yield_today_kwh, 1);
      return {
        en: `Solar-Log OK${fw('firmware')}: ${watts} W now, ${kwh} kWh today.`,
        fr: `Solar-Log OK${fw('firmware')} : ${watts} W actuellement, ${kwh} kWh aujourd'hui.`,
        de: `Solar-Log OK${fw('Firmware')}: aktuell ${watts} W, heute ${kwh} kWh.`,
        es: `Solar-Log OK${fw('firmware')}: ${watts} W ahora, ${kwh} kWh hoy.`,
      }[language];
    });
  },

  /** Re-read the inverters and the battery, and re-publish the devices. */
  async rediscover(service) {
    let inventory;
    try {
      inventory = await service.rediscover();
    } catch (err) {
      return failure(err);
    }
    const count = inventory.inverters.length;
    const battery = inventory.hasBattery;
    return {
      en: `${count} inverter(s)${battery ? ' and a battery' : ''} found: see the Discovery tab.`,
      fr: `${count} onduleur(s)${battery ? ' et une batterie' : ''} trouvé(s) : voir l'onglet Découverte.`,
      de: `${count} Wechselrichter${battery ? ' und eine Batterie' : ''} gefunden: siehe Reiter Erkennung.`,
      es: `${count} inversor(es)${battery ? ' y una batería' : ''} encontrado(s): vea la pestaña Detección.`,
    };
  },
};
