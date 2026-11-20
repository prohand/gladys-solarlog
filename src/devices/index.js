// -----------------------------------------------------------------------------
// Device registry: what the integration publishes, from what the Solar-Log
// reports (the "inventory": consumption meter, inverters, battery).
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { solarLog } from './solarLog.js';
import { inverter } from './inverter.js';
import { battery } from './battery.js';

/** What the Solar-Log has, before the first successful discovery. */
export const EMPTY_INVENTORY = Object.freeze({
  hasConsumptionMeter: true,
  inverters: [],
  hasBattery: false,
});

/** The discovery payload: the Solar-Log, its inverters, its battery. */
export function buildDiscoveredDevices(gladys, inventory = EMPTY_INVENTORY) {
  return [
    solarLog.buildDevice(gladys, inventory),
    ...inventory.inverters.map((entry) => inverter.buildDevice(gladys, entry)),
    ...(inventory.hasBattery ? [battery.buildDevice(gladys)] : []),
  ];
}

/**
 * Every state of one snapshot, in the publishStates format.
 * @param {object} snapshot `{ reading, inverterPower: Map, battery }`
 */
export function buildStates(gladys, snapshot, inventory = EMPTY_INVENTORY) {
  const states = solarLog.buildStates(gladys, snapshot.reading);
  for (const { index } of inventory.inverters) {
    if (snapshot.inverterPower?.has(index)) {
      states.push(...inverter.buildStates(gladys, index, snapshot.inverterPower.get(index)));
    }
  }
  if (inventory.hasBattery && snapshot.battery) {
    states.push(...battery.buildStates(gladys, snapshot.battery));
  }
  return states;
}

/**
 * The transport badge of every device: all of them are reached through the
 * Solar-Log on the LAN, so they share its state.
 */
export function buildTransportEntries(gladys, inventory, reachable) {
  const transport = reachable ? DEVICE_TRANSPORTS.LOCAL : DEVICE_TRANSPORTS.UNREACHABLE;
  return buildDiscoveredDevices(gladys, inventory).map((device) => ({
    external_id: device.external_id,
    transport,
  }));
}

export { solarLog, inverter, battery };
