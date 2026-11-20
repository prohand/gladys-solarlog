// -----------------------------------------------------------------------------
// Device: one inverter connected to the Solar-Log.
//
// The Solar-Log numbers its inverters by slot (0, 1, 2...): the slot is the
// platform id, so renaming an inverter in the Solar-Log keeps its Gladys
// device. Only its live AC power is exposed — the per-inverter energies of
// the JSON interface are day tables, not a meter Gladys could follow.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS as UNITS,
} from '@gladysassistant/integration-sdk';

const DEVICE_TYPE = 'inverter';
export const INVERTER_FEATURES = { POWER: 'power' };

function ids(gladys, index) {
  return gladys.externalIds(DEVICE_TYPE, String(index));
}

export const inverter = {
  key: DEVICE_TYPE,

  deviceExternalId(gladys, index) {
    return ids(gladys, index).device;
  },

  /** @param {{ index: number, name: string | null }} entry */
  buildDevice(gladys, { index, name }) {
    const { device, feature } = ids(gladys, index);
    return {
      name: `Solar-Log – ${name ?? `Inverter ${index + 1}`}`,
      external_id: device,
      model: 'Inverter',
      features: [
        {
          name: 'Power',
          external_id: feature(INVERTER_FEATURES.POWER),
          category: CATEGORIES.ENERGY_PRODUCTION_SENSOR,
          type: TYPES.ENERGY_PRODUCTION_SENSOR.POWER,
          unit: UNITS.WATT,
          min: 0,
          max: 1_000_000,
          read_only: true,
          has_feedback: false,
          keep_history: true,
        },
      ],
    };
  },

  buildStates(gladys, index, powerW) {
    return [
      {
        device_feature_external_id: ids(gladys, index).feature(INVERTER_FEATURES.POWER),
        state: powerW,
      },
    ];
  },
};
