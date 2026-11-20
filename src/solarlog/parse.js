// -----------------------------------------------------------------------------
// Decode the answers of the Solar-Log open JSON interface.
//
// The interface is a single endpoint (POST /getjp) queried with numeric keys.
// `{"801":{"170":null}}` returns the live summary of the plant:
//
//   100 last update "dd.mm.yy HH:MM:SS"   109 total yield (Wh)
//   101 AC power (W)                      110 consumption power (W)
//   102 DC power (W)                      111 consumption today (Wh)
//   103 AC voltage (V)                    112 consumption yesterday (Wh)
//   104 DC voltage (V)                    113 consumption this month (Wh)
//   105 yield today (Wh)                  114 consumption this year (Wh)
//   106 yield yesterday (Wh)              115 total consumption (Wh)
//   107 yield this month (Wh)             116 installed peak power (Wp)
//   108 yield this year (Wh)
//
// The energies are converted to kWh here, once, so every other module speaks
// the units Gladys shows.
// -----------------------------------------------------------------------------

import { ERROR_CODES, SolarLogError } from './errors.js';

/** A finite number from a raw value (numbers sometimes arrive as strings). */
function num(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

const kwh = (wh) => Math.round(num(wh)) / 1000;

/**
 * Parse the "dd.mm.yy HH:MM:SS" stamp of the Solar-Log (its local time).
 * @returns {{ text: string, year: number } | null}
 */
export function parseLastUpdate(value) {
  const match = /^(\d{2})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(value ?? ''));
  if (!match) {
    return null;
  }
  const [, day, month, yy, hours, minutes, seconds] = match;
  // Two-digit year: the Solar-Log reset date is 1999, everything else is 20xx.
  const year = Number(yy) >= 90 ? 1900 + Number(yy) : 2000 + Number(yy);
  return {
    // ISO-like, without a zone: the Solar-Log clock is local and its zone is unknown here.
    text: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
    year,
  };
}

/**
 * Turn the `801.170` block into a reading.
 * @param {Record<string, unknown>} raw
 */
export function parseBasicData(raw) {
  if (raw === null || typeof raw !== 'object') {
    throw new SolarLogError(ERROR_CODES.INVALID_DATA, 'missing 801.170 block');
  }
  const lastUpdate = parseLastUpdate(raw['100']);
  // Right after a restart the Solar-Log answers zeros dated 1999: publishing
  // them would draw a fake drop to 0 W in every chart.
  if (lastUpdate !== null && lastUpdate.year === 1999) {
    throw new SolarLogError(ERROR_CODES.INVALID_DATA, 'values dated 1999 (restart in progress)');
  }

  const production = Math.max(0, num(raw['101']));
  const consumption = Math.max(0, num(raw['110']));
  const consumptionTotal = kwh(raw['115']);
  // Without a consumption meter both read 0 forever: no surplus can be told.
  const hasConsumptionMeter = consumption > 0 || consumptionTotal > 0;
  const installed = Math.max(0, num(raw['116']));

  return {
    last_update: lastUpdate?.text ?? null,
    production_w: production,
    dc_power_w: Math.max(0, num(raw['102'])),
    ac_voltage_v: num(raw['103']),
    dc_voltage_v: num(raw['104']),
    yield_today_kwh: kwh(raw['105']),
    yield_yesterday_kwh: kwh(raw['106']),
    yield_month_kwh: kwh(raw['107']),
    yield_year_kwh: kwh(raw['108']),
    yield_total_kwh: kwh(raw['109']),
    has_consumption_meter: hasConsumptionMeter,
    consumption_w: consumption,
    consumption_today_kwh: kwh(raw['111']),
    consumption_yesterday_kwh: kwh(raw['112']),
    consumption_month_kwh: kwh(raw['113']),
    consumption_year_kwh: kwh(raw['114']),
    consumption_total_kwh: consumptionTotal,
    installed_power_wp: installed,
    // Positive: power left over for the grid (or a boiler, a car...);
    // negative: the house draws more than the panels give.
    surplus_w: hasConsumptionMeter ? production - consumption : null,
    // Share of the production used in the house right now.
    self_consumption_percent:
      hasConsumptionMeter && production > 0
        ? Math.round((Math.min(consumption, production) / production) * 100)
        : null,
    // Production as a share of the installed peak power.
    capacity_percent:
      installed > 0 ? Math.min(100, Math.round((production / installed) * 100)) : null,
  };
}

/**
 * Battery block `858`: `[voltage, level %, charge W, discharge W]`, or `[]`
 * when no battery is connected.
 */
export function parseBattery(raw) {
  if (!Array.isArray(raw) || raw.length < 4) {
    return null;
  }
  return {
    voltage_v: num(raw[0]),
    level_percent: Math.min(100, Math.max(0, num(raw[1]))),
    charge_power_w: Math.max(0, num(raw[2])),
    discharge_power_w: Math.max(0, num(raw[3])),
  };
}

/**
 * Inverter list `740`: `{ "0": "Ok", "1": "Err", ... }` — "Err" marks an
 * unused slot. Returns the indexes of the slots in use, in order.
 */
export function parseInverterSlots(raw) {
  if (raw === null || typeof raw !== 'object') {
    return [];
  }
  return Object.entries(raw)
    .filter(([index, state]) => /^\d+$/.test(index) && state !== 'Err')
    .map(([index]) => Number(index))
    .sort((a, b) => a - b);
}

/** Power per inverter `782`: `{ "0": "1234", ... }` -> `Map(index -> W)`. */
export function parseInverterPower(raw) {
  const power = new Map();
  if (raw === null || typeof raw !== 'object') {
    return power;
  }
  for (const [index, value] of Object.entries(raw)) {
    if (/^\d+$/.test(index)) {
      power.set(Number(index), Math.max(0, num(value)));
    }
  }
  return power;
}
