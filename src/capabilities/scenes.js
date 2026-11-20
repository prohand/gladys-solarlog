// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
// Each handler receives the RESOLVED fields and returns the declared scalar
// `outputs`. A scene action is never a condition: an unreachable Solar-Log is
// reported through the `reachable` output, not by throwing, so the scene
// author decides what follows. The triggers ("production started", "surplus
// available"...) are fired by the read loop, see src/solarlog/monitor.js.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'scenes' });

/** Periods of the `get_yield` action, mapped to the reading fields. */
export const YIELD_PERIODS = {
  today: ['yield_today_kwh', 'consumption_today_kwh'],
  yesterday: ['yield_yesterday_kwh', 'consumption_yesterday_kwh'],
  month: ['yield_month_kwh', 'consumption_month_kwh'],
  year: ['yield_year_kwh', 'consumption_year_kwh'],
  total: ['yield_total_kwh', 'consumption_total_kwh'],
};

/**
 * A fresh reading when the Solar-Log answers, the last one otherwise.
 * @returns {Promise<{ reading: object | null, reachable: boolean }>}
 */
async function currentReading(service) {
  try {
    const { reading } = await service.refresh();
    return { reading, reachable: true };
  } catch (err) {
    logger.warn(`Scene action: Solar-Log unreachable (${err.code ?? err.message})`);
    return { reading: service.snapshot?.reading ?? null, reachable: false };
  }
}

export const SCENE_ACTIONS = {
  async read_values(service) {
    const { reading, reachable } = await currentReading(service);
    return {
      reachable,
      production_w: reading?.production_w ?? 0,
      consumption_w: reading?.consumption_w ?? 0,
      surplus_w: reading?.surplus_w ?? 0,
      yield_today_kwh: reading?.yield_today_kwh ?? 0,
      self_consumption_percent: reading?.self_consumption_percent ?? 0,
    };
  },

  async check_surplus(service, { fields }) {
    const { reading, reachable } = await currentReading(service);
    const minimum = Number(fields.min_surplus ?? service.config.surplus_threshold);
    const surplus = reading?.surplus_w ?? null;
    return {
      // Never "available" on stale data: the dishwasher would start at night.
      available: reachable && surplus !== null && surplus >= minimum,
      surplus_w: surplus ?? 0,
    };
  },

  async get_yield(service, { fields }) {
    const [production, consumption] = YIELD_PERIODS[fields.period] ?? YIELD_PERIODS.today;
    const { reading, reachable } = await currentReading(service);
    return {
      reachable,
      production_kwh: reading?.[production] ?? 0,
      consumption_kwh: reading?.[consumption] ?? 0,
    };
  },
};
