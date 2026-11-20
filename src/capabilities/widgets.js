// -----------------------------------------------------------------------------
// Dashboard widgets (manifest `widgets`, Gladys 5.1+).
//
//   solar_overview  live tiles (production, consumption, surplus), the share
//                   of the peak power, a 24 h chart, the link state and a
//                   "Refresh" button;
//   solar_yields    production and consumption per period (today, yesterday,
//                   month, year, total) and the self-consumption.
//
// Live tiles and the chart are bound to device features: they follow the
// published states on their own. The computed parts are served from the
// core cache until `ttl_seconds`, and the service nudges the widgets
// (requestWidgetRefresh) after every read.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS, createLogger } from '@gladysassistant/integration-sdk';
import { formatNumber, localize, pick } from '../i18n.js';
import { userMessageOf } from '../solarlog/errors.js';
import { FEATURES, solarLog } from '../devices/solarLog.js';

const logger = createLogger({ name: 'widgets' });

export const WIDGET_KEYS = { OVERVIEW: 'solar_overview', YIELDS: 'solar_yields' };
export const WIDGET_ACTIONS = { REFRESH: 'refresh' };

const T = {
  production: { en: 'Production', fr: 'Production', de: 'Erzeugung', es: 'Producción' },
  consumption: { en: 'Consumption', fr: 'Consommation', de: 'Verbrauch', es: 'Consumo' },
  surplus: { en: 'Surplus', fr: 'Surplus', de: 'Überschuss', es: 'Excedente' },
  peak: {
    en: 'Of peak power',
    fr: 'De la puissance crête',
    de: 'Der Spitzenleistung',
    es: 'De la potencia pico',
  },
  chart: {
    en: 'Last 24 hours',
    fr: 'Dernières 24 heures',
    de: 'Letzte 24 Stunden',
    es: 'Últimas 24 horas',
  },
  link: { en: 'Solar-Log', fr: 'Solar-Log', de: 'Solar-Log', es: 'Solar-Log' },
  online: { en: 'Connected', fr: 'Connecté', de: 'Verbunden', es: 'Conectado' },
  offline: { en: 'Unreachable', fr: 'Injoignable', de: 'Nicht erreichbar', es: 'Inaccesible' },
  today: { en: 'Today', fr: "Aujourd'hui", de: 'Heute', es: 'Hoy' },
  yesterday: { en: 'Yesterday', fr: 'Hier', de: 'Gestern', es: 'Ayer' },
  month: { en: 'This month', fr: 'Ce mois-ci', de: 'Diesen Monat', es: 'Este mes' },
  year: { en: 'This year', fr: 'Cette année', de: 'Dieses Jahr', es: 'Este año' },
  total: { en: 'Total', fr: 'Total', de: 'Gesamt', es: 'Total' },
  lastUpdate: {
    en: 'Last update',
    fr: 'Dernière mise à jour',
    de: 'Letzte Aktualisierung',
    es: 'Última actualización',
  },
  selfConsumption: {
    en: 'Self-consumption now',
    fr: 'Autoconsommation actuelle',
    de: 'Eigenverbrauch aktuell',
    es: 'Autoconsumo actual',
  },
  refresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  waiting: {
    en: 'Waiting for the first reading of the Solar-Log.',
    fr: 'En attente de la première lecture du Solar-Log.',
    de: 'Warte auf die erste Messung des Solar-Log.',
    es: 'Esperando la primera lectura del Solar-Log.',
  },
};

const kwhText = (language, value) => `${formatNumber(language, value, 1)} kWh`;

function linkStatus(service, language) {
  return service.reachable
    ? {
        label: pick(language, T.link),
        value: pick(language, T.online),
        icon: 'wifi',
        color: WIDGET_COLORS.SUCCESS,
      }
    : {
        label: pick(language, T.link),
        value: pick(language, T.offline),
        icon: 'wifi-off',
        color: WIDGET_COLORS.DANGER,
      };
}

/** Body text when there is nothing to show yet: why, in the reader's language. */
function emptyContent(service, language) {
  const message = service.lastError ? userMessageOf(service.lastError) : T.waiting;
  return {
    ttl_seconds: 60,
    components: [
      { type: 'text', variant: 'body', text: pick(language, message) },
      { type: 'status', items: [linkStatus(service, language)] },
    ],
  };
}

function overview(gladys, service, language) {
  const snapshot = service.snapshot;
  if (!snapshot) {
    return emptyContent(service, language);
  }
  const { reading } = snapshot;
  const feature = (key) => solarLog.featureExternalId(gladys, key);
  const hasMeter = service.inventory.hasConsumptionMeter;

  const components = [
    {
      type: 'value',
      label: T.production,
      icon: 'sun',
      color: WIDGET_COLORS.WARNING,
      device_feature: feature(FEATURES.PRODUCTION_POWER),
    },
  ];
  if (hasMeter) {
    components.push(
      {
        type: 'value',
        label: T.consumption,
        icon: 'home',
        device_feature: feature(FEATURES.CONSUMPTION_POWER),
      },
      {
        type: 'value',
        label: T.surplus,
        icon: 'trending-up',
        color: WIDGET_COLORS.SUCCESS,
        device_feature: feature(FEATURES.SURPLUS_POWER),
      },
    );
  }
  if (reading.capacity_percent !== null) {
    components.push({
      type: 'gauge',
      label: T.peak,
      value: reading.capacity_percent,
      min: 0,
      max: 100,
      unit: '%',
      color: WIDGET_COLORS.PRIMARY,
    });
  }
  components.push(
    {
      type: 'chart',
      chart_type: 'area',
      title: T.chart,
      interval: 'last-day',
      device_features: hasMeter
        ? [feature(FEATURES.PRODUCTION_POWER), feature(FEATURES.CONSUMPTION_POWER)]
        : [feature(FEATURES.PRODUCTION_POWER)],
    },
    {
      type: 'status',
      items: [
        linkStatus(service, language),
        {
          label: pick(language, T.today),
          value: kwhText(language, reading.yield_today_kwh),
          icon: 'sun',
          color: WIDGET_COLORS.NEUTRAL,
        },
        ...(reading.last_update
          ? [
              {
                label: pick(language, T.lastUpdate),
                value: reading.last_update,
                icon: 'clock',
                color: WIDGET_COLORS.NEUTRAL,
              },
            ]
          : []),
      ],
    },
    {
      type: 'button',
      label: T.refresh,
      icon: 'refresh-cw',
      style: 'secondary',
      action: { key: WIDGET_ACTIONS.REFRESH },
    },
  );
  return { ttl_seconds: 300, components };
}

function yields(service, language) {
  const snapshot = service.snapshot;
  if (!snapshot) {
    return emptyContent(service, language);
  }
  const { reading } = snapshot;
  const row = (label, value, icon) => ({
    label: pick(language, label),
    value: kwhText(language, value),
    icon,
    color: WIDGET_COLORS.NEUTRAL,
  });
  const items = [
    row(T.today, reading.yield_today_kwh, 'sun'),
    row(T.yesterday, reading.yield_yesterday_kwh, 'sun'),
    row(T.month, reading.yield_month_kwh, 'calendar'),
    row(T.year, reading.yield_year_kwh, 'calendar'),
    row(T.total, reading.yield_total_kwh, 'award'),
  ];
  if (service.inventory.hasConsumptionMeter) {
    const label = (period) =>
      localize((lang) => `${pick(lang, T.consumption)} – ${pick(lang, period).toLowerCase()}`);
    items.push(
      row(label(T.today), reading.consumption_today_kwh, 'home'),
      row(label(T.month), reading.consumption_month_kwh, 'home'),
      row(label(T.year), reading.consumption_year_kwh, 'home'),
    );
    if (reading.self_consumption_percent !== null) {
      items.push({
        label: pick(language, T.selfConsumption),
        value: `${reading.self_consumption_percent} %`,
        icon: 'repeat',
        color: WIDGET_COLORS.INFO,
      });
    }
  }
  return {
    ttl_seconds: 300,
    components: [
      { type: 'text', variant: 'heading', text: T.production },
      { type: 'status', items },
    ],
  };
}

/**
 * The widget handlers, keyed by the manifest `widgets` keys.
 * `get(gladys, service, request)` / `action(gladys, service, request)`.
 */
export const WIDGETS = {
  [WIDGET_KEYS.OVERVIEW]: {
    async get(gladys, service, { language }) {
      logger.debug(`onWidgetGet <- ${WIDGET_KEYS.OVERVIEW}`);
      return overview(gladys, service, language);
    },
    async action(gladys, service, { actionKey }) {
      logger.info(`onWidgetAction <- ${WIDGET_KEYS.OVERVIEW}.${actionKey}`);
      if (actionKey !== WIDGET_ACTIONS.REFRESH) {
        throw new Error(`Unknown widget action: ${actionKey}`);
      }
      let reading;
      try {
        ({ reading } = await service.refresh());
      } catch (err) {
        // Throwing acks the action as failed: the message is the toast.
        throw new Error(userMessageOf(err).en, { cause: err });
      }
      // French puts a space before the colon.
      return localize(
        (language) =>
          `${pick(language, T.production)}${language === 'fr' ? ' :' : ':'} ${formatNumber(language, reading.production_w)} W`,
      );
    },
  },
  [WIDGET_KEYS.YIELDS]: {
    async get(gladys, service, { language }) {
      logger.debug(`onWidgetGet <- ${WIDGET_KEYS.YIELDS}`);
      return yields(service, language);
    },
  },
};

/** Ask the core to re-pull every widget (rate-limited core-side). */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}
