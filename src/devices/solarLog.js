// -----------------------------------------------------------------------------
// Device: the Solar-Log itself — the whole plant as the Solar-Log sums it up.
//
// Features (the external ids are forever, never rename a key):
//   production-power  AC power fed by the inverters        energy-production-sensor/power
//   dc-power          DC power from the panels             energy-sensor/power
//   ac-voltage        AC voltage                           energy-sensor/voltage
//   dc-voltage        DC voltage                           energy-sensor/voltage
//   yield-total       production meter index (kWh)         energy-production-sensor/index
//   consumption-power house consumption (W)                energy-sensor/power
//   consumption-total consumption meter index (kWh)        energy-sensor/index
//   surplus-power     production - consumption (W, signed) energy-sensor/power
//   self-consumption  share of the production used (%)     unknown/integer
//
// The daily / monthly / yearly yields are not features: Gladys derives the
// production of any period from the `yield-total` index (energy monitoring),
// and a second "index" per period would be counted twice. They are shown by
// the "Solar yields" widget and returned by the `get_yield` scene action.
//
// The consumption features only make sense with a consumption meter wired to
// the Solar-Log: without one they are not published at all.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';

const DEVICE_TYPE = 'solarlog';
// One integration install talks to one Solar-Log: a fixed platform id keeps
// the device (and its history) when the Solar-Log changes IP address.
const PLATFORM_ID = 'main';

export const FEATURES = {
  PRODUCTION_POWER: 'production-power',
  DC_POWER: 'dc-power',
  AC_VOLTAGE: 'ac-voltage',
  DC_VOLTAGE: 'dc-voltage',
  YIELD_TOTAL: 'yield-total',
  CONSUMPTION_POWER: 'consumption-power',
  CONSUMPTION_TOTAL: 'consumption-total',
  SURPLUS_POWER: 'surplus-power',
  SELF_CONSUMPTION: 'self-consumption',
};

// Plant sizes go from a balcony kit to a farm roof: wide bounds, the real
// range is the installed power the Solar-Log reports.
const MAX_POWER_W = 1_000_000;
const MAX_INDEX_KWH = 100_000_000;

const sensor = (fields) => ({
  read_only: true,
  has_feedback: false,
  keep_history: true,
  ...fields,
});

function ids(gladys) {
  return gladys.externalIds(DEVICE_TYPE, PLATFORM_ID);
}

export const solarLog = {
  key: DEVICE_TYPE,

  deviceExternalId(gladys) {
    return ids(gladys).device;
  },

  featureExternalId(gladys, feature) {
    return ids(gladys).feature(feature);
  },

  /**
   * @param {object} gladys
   * @param {{ hasConsumptionMeter: boolean }} inventory what the Solar-Log reports
   */
  buildDevice(gladys, { hasConsumptionMeter = true } = {}) {
    const { device, feature } = ids(gladys);
    const features = [
      sensor({
        name: 'Production power',
        external_id: feature(FEATURES.PRODUCTION_POWER),
        category: CATEGORIES.ENERGY_PRODUCTION_SENSOR,
        type: TYPES.ENERGY_PRODUCTION_SENSOR.POWER,
        unit: UNITS.WATT,
        min: 0,
        max: MAX_POWER_W,
      }),
      sensor({
        name: 'DC power',
        external_id: feature(FEATURES.DC_POWER),
        category: CATEGORIES.ENERGY_SENSOR,
        type: TYPES.ENERGY_SENSOR.POWER,
        unit: UNITS.WATT,
        min: 0,
        max: MAX_POWER_W,
      }),
      sensor({
        name: 'AC voltage',
        external_id: feature(FEATURES.AC_VOLTAGE),
        category: CATEGORIES.ENERGY_SENSOR,
        type: TYPES.ENERGY_SENSOR.VOLTAGE,
        unit: UNITS.VOLT,
        min: 0,
        max: 1000,
      }),
      sensor({
        name: 'DC voltage',
        external_id: feature(FEATURES.DC_VOLTAGE),
        category: CATEGORIES.ENERGY_SENSOR,
        type: TYPES.ENERGY_SENSOR.VOLTAGE,
        unit: UNITS.VOLT,
        min: 0,
        max: 1500,
      }),
      sensor({
        name: 'Total yield',
        external_id: feature(FEATURES.YIELD_TOTAL),
        category: CATEGORIES.ENERGY_PRODUCTION_SENSOR,
        type: TYPES.ENERGY_PRODUCTION_SENSOR.INDEX,
        unit: UNITS.KILOWATT_HOUR,
        min: 0,
        max: MAX_INDEX_KWH,
      }),
    ];
    if (hasConsumptionMeter) {
      features.push(
        sensor({
          name: 'Consumption power',
          external_id: feature(FEATURES.CONSUMPTION_POWER),
          category: CATEGORIES.ENERGY_SENSOR,
          type: TYPES.ENERGY_SENSOR.POWER,
          unit: UNITS.WATT,
          min: 0,
          max: MAX_POWER_W,
        }),
        sensor({
          name: 'Total consumption',
          external_id: feature(FEATURES.CONSUMPTION_TOTAL),
          category: CATEGORIES.ENERGY_SENSOR,
          type: TYPES.ENERGY_SENSOR.INDEX,
          unit: UNITS.KILOWATT_HOUR,
          min: 0,
          max: MAX_INDEX_KWH,
        }),
        sensor({
          name: 'Surplus power',
          external_id: feature(FEATURES.SURPLUS_POWER),
          category: CATEGORIES.ENERGY_SENSOR,
          type: TYPES.ENERGY_SENSOR.POWER,
          unit: UNITS.WATT,
          // Signed: negative when the house draws more than the panels give.
          min: -MAX_POWER_W,
          max: MAX_POWER_W,
        }),
        sensor({
          name: 'Self-consumption',
          external_id: feature(FEATURES.SELF_CONSUMPTION),
          category: CATEGORIES.UNKNOWN,
          type: TYPES.SENSOR.INTEGER,
          unit: UNITS.PERCENT,
          min: 0,
          max: 100,
        }),
      );
    }
    return {
      name: 'Solar-Log',
      external_id: device,
      model: 'Solar-Log',
      features,
    };
  },

  /** The states of one reading, in the publishStates format. */
  buildStates(gladys, reading) {
    const { feature } = ids(gladys);
    const state = (key, value) => ({ device_feature_external_id: feature(key), state: value });
    const states = [
      state(FEATURES.PRODUCTION_POWER, reading.production_w),
      state(FEATURES.DC_POWER, reading.dc_power_w),
      state(FEATURES.AC_VOLTAGE, reading.ac_voltage_v),
      state(FEATURES.DC_VOLTAGE, reading.dc_voltage_v),
    ];
    // A total index never goes back: a 0 means the Solar-Log has not counted
    // yet (restart), and publishing it would draw a huge negative production.
    if (reading.yield_total_kwh > 0) {
      states.push(state(FEATURES.YIELD_TOTAL, reading.yield_total_kwh));
    }
    if (reading.has_consumption_meter) {
      states.push(
        state(FEATURES.CONSUMPTION_POWER, reading.consumption_w),
        state(FEATURES.SURPLUS_POWER, reading.surplus_w),
      );
      if (reading.consumption_total_kwh > 0) {
        states.push(state(FEATURES.CONSUMPTION_TOTAL, reading.consumption_total_kwh));
      }
      // At night there is no production to share: keep the last value.
      if (reading.self_consumption_percent !== null) {
        states.push(state(FEATURES.SELF_CONSUMPTION, reading.self_consumption_percent));
      }
    }
    return states;
  },
};
