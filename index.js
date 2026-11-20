// -----------------------------------------------------------------------------
// Entry point of the Solar-Log integration for Gladys Assistant.
//
// Wiring only: the SDK handlers are registered BEFORE connect(), and every
// surface (devices, scene actions, widgets, Configuration buttons) is served
// by the one read loop of src/service.js.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import { createService } from './src/service.js';
import { ACTIONS } from './src/capabilities/actions.js';
import { SCENE_ACTIONS } from './src/capabilities/scenes.js';
import { WIDGETS, refreshWidgets } from './src/capabilities/widgets.js';

const gladys = new GladysIntegration();
const service = createService(gladys, { onChange: () => refreshWidgets(gladys) });

// --- Discovery: Gladys asks for the list of devices --------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> publishing discovered devices');
  await service.publishDevices();
});

// --- Commands: every feature is a read-only measurement ----------------------
gladys.onSetValue(async (device) => {
  throw new Error(`${device.external_id} is read-only: the Solar-Log only reports values`);
});

// --- Created / updated devices: re-send their states -------------------------
// The SDK forgets the states of a device the user just created, so the next
// read publishes them all: read now instead of waiting a full period.
gladys.onDeviceCreated(() => service.refresh().catch(() => {}));

// --- Manifest actions: buttons in the Configuration screen -------------------
for (const [key, handler] of Object.entries(ACTIONS)) {
  gladys.onAction(key, (fields) => handler(service, { fields }));
}

// --- Scene actions -----------------------------------------------------------
// The triggers need no handler: the read loop fires them (src/solarlog/monitor.js).
for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
  gladys.onSceneAction(key, (fields) => handler(service, { fields }));
}

// --- Dashboard widgets -------------------------------------------------------
for (const [key, widget] of Object.entries(WIDGETS)) {
  gladys.onWidgetGet(key, (request) => widget.get(gladys, service, request));
  if (typeof widget.action === 'function') {
    gladys.onWidgetAction(key, (actionKey, params, { settings }) =>
      widget.action(gladys, service, { actionKey, params, settings }),
    );
  }
}

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  await service.configure(normalizeConfig(newConfig));
  service.start();
  refreshWidgets(gladys);
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  try {
    await service.configure(normalizeConfig(await gladys.getConfig()));
    await service.publishDevices();
    // Reads right away, then every poll_frequency seconds. The read reports
    // the connection status (Configuration screen) and the transport badges.
    service.start();
    // The nudges sent while the socket was down were dropped.
    refreshWidgets(gladys);
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys
      .setConnectionStatus(false, {
        en: 'Initialization failed, check the integration logs.',
        fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
        de: 'Die Initialisierung ist fehlgeschlagen, prüfe die Logs der Integration.',
        es: 'La inicialización falló, consulte los registros de la integración.',
      })
      .catch(() => {});
  }
});

gladys.on('disconnected', () => {
  service.stop();
});

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  service.stop();
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the Solar-Log integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
