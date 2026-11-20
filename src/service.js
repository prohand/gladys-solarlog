// -----------------------------------------------------------------------------
// The Solar-Log service: one read loop shared by every surface.
//
// Every `poll_frequency` seconds it reads the Solar-Log once, then:
//   - publishes the states that changed (devices);
//   - fires the scene triggers the reading causes (monitor.js);
//   - keeps the connection status and the transport badges in line;
//   - keeps the snapshot the widgets and the scene actions answer from.
//
// The loop is the integration's own timer rather than Gladys' onPoll: the
// scene triggers and the widgets need the readings even before the user has
// created any device, and one read serves all the devices at once. Gladys
// silently drops the states of a device not created yet.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { SolarLogClient } from './solarlog/client.js';
import { ERROR_CODES, SolarLogError, userMessageOf } from './solarlog/errors.js';
import { createMonitor } from './solarlog/monitor.js';
import {
  EMPTY_INVENTORY,
  buildDiscoveredDevices,
  buildStates,
  buildTransportEntries,
} from './devices/index.js';

const logger = createLogger({ name: 'solarlog' });

// An unchanged value is re-sent every 30 minutes, so Gladys keeps it dated.
const STATE_HEARTBEAT_MS = 30 * 60 * 1000;
// The inventory (inverters, battery) is re-read at this pace: a new inverter
// shows up in the Discovery tab without restarting the integration.
const INVENTORY_REFRESH_MS = 6 * 60 * 60 * 1000;

/**
 * @param {object} gladys the SDK instance
 * @param {object} [options]
 * @param {(config) => SolarLogClient} [options.createClient] injected by the tests
 * @param {() => void} [options.onChange] called when what the widgets show changed
 */
export function createService(gladys, { createClient, onChange = () => {} } = {}) {
  const makeClient =
    createClient ??
    ((config) => new SolarLogClient({ host: config.host, password: config.password }));
  const monitor = createMonitor();

  let config = null;
  let client = null;
  let inventory = { ...EMPTY_INVENTORY };
  let inventoryReadAt = 0;
  let snapshot = null; // { reading, inverterPower, battery, at }
  let lastError = null; // SolarLogError of the last failed read
  let statusKey = null; // last status sent to setConnectionStatus ('ok' or an error code)
  let timer = null;
  let running = null; // the read in progress, shared by concurrent callers

  // Sent on change only: a Solar-Log switched off for the night must not
  // send the same status every minute.
  async function setConnection(ok, error) {
    const key = ok ? 'ok' : error.code;
    if (key === statusKey) {
      return;
    }
    statusKey = key;
    await gladys
      .setConnectionStatus(ok, ok ? undefined : userMessageOf(error))
      .catch((err) => logger.warn(`setConnectionStatus failed: ${err.message}`));
  }

  async function publishTransports() {
    const entries = buildTransportEntries(
      gladys,
      inventory,
      lastError === null && snapshot !== null,
    );
    await gladys.publishTransports(entries).catch((err) => {
      logger.warn(`publishTransports failed: ${err.message}`);
    });
  }

  async function fireEvents(events) {
    for (const { key, data } of events) {
      logger.info(`Scene event ${key}`);
      await gladys.publishSceneEvent(key, data).catch((err) => {
        logger.warn(`publishSceneEvent ${key} failed: ${err.message}`);
      });
    }
  }

  /**
   * Read what the Solar-Log has (consumption meter, inverters, battery) and
   * re-publish the discovery list when it changed. The extended data may be
   * refused (password): the plant summary alone still works.
   */
  async function discover(reading) {
    // A failed read keeps what was known: one dropped answer must not hide
    // the inverters from the Discovery tab until the next inventory.
    const next = {
      hasConsumptionMeter: reading ? reading.has_consumption_meter : inventory.hasConsumptionMeter,
      inverters: config.inverters ? inventory.inverters : [],
      hasBattery: inventory.hasBattery,
    };
    if (config.inverters) {
      try {
        next.inverters = await client.getInverters();
      } catch (err) {
        logger.warn(`Inverter list unavailable (${err.code ?? err.message})`);
      }
    }
    try {
      next.hasBattery = (await client.getBattery()) !== null;
    } catch (err) {
      logger.debug(`Battery data unavailable (${err.code ?? err.message})`);
    }
    inventoryReadAt = Date.now();
    const changed = JSON.stringify(next) !== JSON.stringify(inventory);
    inventory = next;
    if (changed) {
      logger.info(
        `Inventory: ${next.inverters.length} inverter(s), battery: ${next.hasBattery ? 'yes' : 'no'}, consumption meter: ${next.hasConsumptionMeter ? 'yes' : 'no'}`,
      );
      await gladys
        .publishDiscoveredDevices(buildDiscoveredDevices(gladys, inventory))
        .catch((err) => logger.warn(`publishDiscoveredDevices failed: ${err.message}`));
    }
    return inventory;
  }

  async function readOnce() {
    try {
      if (!config?.host) {
        throw new SolarLogError(ERROR_CODES.NOT_CONFIGURED);
      }
      const reading = await client.getBasicData();
      const wasDown = lastError !== null || snapshot === null;
      if (
        Date.now() - inventoryReadAt > INVENTORY_REFRESH_MS ||
        reading.has_consumption_meter !== inventory.hasConsumptionMeter
      ) {
        await discover(reading);
      }
      let inverterPower = new Map();
      if (inventory.inverters.length > 0) {
        inverterPower = await client.getInverterPower().catch((err) => {
          logger.debug(`Inverter power unavailable (${err.code ?? err.message})`);
          return new Map();
        });
      }
      let batteryData = null;
      if (inventory.hasBattery) {
        batteryData = await client.getBattery().catch(() => null);
      }
      snapshot = { reading, inverterPower, battery: batteryData, at: new Date().toISOString() };
      lastError = null;

      // A refusal from Gladys (rate limit...) is not a Solar-Log failure: the
      // states that did not go through are re-sent by the next read.
      await gladys
        .publishChangedStates(buildStates(gladys, snapshot, inventory), {
          heartbeat: STATE_HEARTBEAT_MS,
        })
        .catch((err) => logger.warn(`publishChangedStates failed: ${err.message}`));
      await fireEvents(monitor.update(reading, config));
      if (wasDown) {
        await setConnection(true);
        await publishTransports();
      }
      onChange();
      return snapshot;
    } catch (err) {
      const error =
        err instanceof SolarLogError
          ? err
          : new SolarLogError(ERROR_CODES.UNREACHABLE, err?.message ?? String(err));
      const wasUp = lastError === null;
      lastError = error;
      logger.warn(`Solar-Log read failed: ${error.message}`);
      await fireEvents(monitor.fail(error.code));
      await setConnection(false, error);
      if (wasUp) {
        await publishTransports();
        onChange();
      }
      throw error;
    }
  }

  return {
    /** Apply a (new) configuration: new client, fresh baseline. Call start() after. */
    async configure(nextConfig) {
      const hostChanged = config?.host !== nextConfig.host;
      config = nextConfig;
      client = makeClient(config);
      if (hostChanged) {
        monitor.reset();
        snapshot = null;
      }
      inventoryReadAt = 0; // re-read the inverters (the toggle may have changed)
      lastError = null;
      statusKey = null;
    },

    /** Read now. Concurrent callers share the same read. */
    refresh() {
      if (!running) {
        running = readOnce().finally(() => {
          running = null;
        });
      }
      return running;
    },

    /** Re-read the inventory and re-publish the discovery list. */
    async rediscover() {
      const { reading } = await this.refresh();
      await discover(reading);
      // Published even when nothing changed: the user asked for it.
      await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, inventory));
      return inventory;
    },

    /** Publish the discovery list as it stands (Gladys' Discovery tab). */
    async publishDevices() {
      await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, inventory));
    },

    /** Start (or restart) the read loop; reads once right away. */
    start() {
      this.stop();
      timer = setInterval(() => {
        this.refresh().catch(() => {});
      }, config.poll_frequency * 1000);
      this.refresh().catch(() => {});
    },

    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },

    get client() {
      return client;
    },
    get config() {
      return config;
    },
    get inventory() {
      return inventory;
    },
    get snapshot() {
      return snapshot;
    },
    get lastError() {
      return lastError;
    },
    get reachable() {
      return snapshot !== null && lastError === null;
    },
  };
}
