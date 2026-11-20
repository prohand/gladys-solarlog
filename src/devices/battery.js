// -----------------------------------------------------------------------------
// Device: the storage battery managed by the Solar-Log, when there is one.
//
// Published only when the Solar-Log reports a battery (JSON key 858 not
// empty): most plants have none.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';

const DEVICE_TYPE = 'battery';
const PLATFORM_ID = 'main';

export const BATTERY_FEATURES = {
  LEVEL: 'level',
  CHARGE_POWER: 'charge-power',
  DISCHARGE_POWER: 'discharge-power',
};

const ids = (gladys) => gladys.externalIds(DEVICE_TYPE, PLATFORM_ID);

const feature = (fields) => ({
  read_only: true,
  has_feedback: false,
  keep_history: true,
  category: CATEGORIES.BATTERY_STORAGE,
  ...fields,
});

export const battery = {
  key: DEVICE_TYPE,

  deviceExternalId(gladys) {
    return ids(gladys).device;
  },

  buildDevice(gladys) {
    const { device, feature: featureId } = ids(gladys);
    return {
      name: 'Solar-Log – Battery',
      external_id: device,
      model: 'Battery',
      features: [
        feature({
          name: 'Battery level',
          external_id: featureId(BATTERY_FEATURES.LEVEL),
          type: TYPES.BATTERY_STORAGE.BATTERY_LEVEL,
          unit: UNITS.PERCENT,
          min: 0,
          max: 100,
        }),
        feature({
          name: 'Charge power',
          external_id: featureId(BATTERY_FEATURES.CHARGE_POWER),
          type: TYPES.BATTERY_STORAGE.CHARGE_POWER,
          unit: UNITS.WATT,
          min: 0,
          max: 1_000_000,
        }),
        feature({
          name: 'Discharge power',
          external_id: featureId(BATTERY_FEATURES.DISCHARGE_POWER),
          type: TYPES.BATTERY_STORAGE.DISCHARGE_POWER,
          unit: UNITS.WATT,
          min: 0,
          max: 1_000_000,
        }),
      ],
    };
  },

  buildStates(gladys, data) {
    const { feature: featureId } = ids(gladys);
    return [
      { device_feature_external_id: featureId(BATTERY_FEATURES.LEVEL), state: data.level_percent },
      {
        device_feature_external_id: featureId(BATTERY_FEATURES.CHARGE_POWER),
        state: data.charge_power_w,
      },
      {
        device_feature_external_id: featureId(BATTERY_FEATURES.DISCHARGE_POWER),
        state: data.discharge_power_w,
      },
    ];
  },
};
