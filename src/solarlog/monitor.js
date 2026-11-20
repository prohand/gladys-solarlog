// -----------------------------------------------------------------------------
// Turn successive readings into scene events.
//
// A scene trigger says "this just happened": one event per TRANSITION, never
// one per reading. The monitor remembers the last known situation and returns
// the events a new reading (or a failed read) causes. It is pure — no timer,
// no I/O — so every edge case is a plain unit test.
//
// Two rules keep scenes calm:
//   - the first reading after a (re)start only sets the baseline: restarting
//     the integration at noon must not fire "production started";
//   - thresholds have a hysteresis, and the link is declared lost only after
//     several failed reads in a row: a passing cloud or one dropped packet is
//     not an event.
// -----------------------------------------------------------------------------

/** Keys of the manifest `scene_triggers`, stored by users: never rename. */
export const TRIGGERS = {
  PRODUCTION_STARTED: 'production_started',
  PRODUCTION_STOPPED: 'production_stopped',
  SURPLUS_STARTED: 'surplus_started',
  SURPLUS_ENDED: 'surplus_ended',
  CONNECTION_LOST: 'connection_lost',
  CONNECTION_RESTORED: 'connection_restored',
};

/** Failed reads in a row before the link is declared lost. */
export const FAILURES_BEFORE_LOST = 3;

export function createMonitor() {
  let producing = null; // null: unknown yet (baseline not set)
  let surplus = null;
  let reachable = null;
  let failures = 0;

  return {
    /**
     * @param {object} reading see parse.js
     * @param {object} config normalized config (thresholds)
     * @returns {{ key: string, data: object }[]}
     */
    update(reading, config) {
      const events = [];
      failures = 0;
      if (reachable === false) {
        events.push({ key: TRIGGERS.CONNECTION_RESTORED, data: {} });
      }
      reachable = true;

      // Production: on at the threshold, off below half of it.
      const threshold = config.production_threshold;
      const nowProducing =
        producing === true
          ? reading.production_w >= threshold / 2 && reading.production_w > 0
          : reading.production_w >= threshold && reading.production_w > 0;
      if (producing !== null && nowProducing !== producing) {
        events.push(
          nowProducing
            ? {
                key: TRIGGERS.PRODUCTION_STARTED,
                data: { production_w: reading.production_w },
              }
            : {
                key: TRIGGERS.PRODUCTION_STOPPED,
                data: { yield_today_kwh: reading.yield_today_kwh },
              },
        );
      }
      producing = nowProducing;

      // Surplus: needs a consumption meter, otherwise it cannot be told.
      if (reading.surplus_w === null) {
        surplus = null;
      } else {
        const on = config.surplus_threshold;
        const off = Math.max(0, on - config.surplus_hysteresis);
        const nowSurplus = surplus === true ? reading.surplus_w >= off : reading.surplus_w >= on;
        if (surplus !== null && nowSurplus !== surplus) {
          events.push({
            key: nowSurplus ? TRIGGERS.SURPLUS_STARTED : TRIGGERS.SURPLUS_ENDED,
            data: {
              surplus_w: reading.surplus_w,
              production_w: reading.production_w,
              consumption_w: reading.consumption_w,
            },
          });
        }
        surplus = nowSurplus;
      }
      return events;
    },

    /**
     * A read failed.
     * @param {string} reason error code (see errors.js)
     */
    fail(reason) {
      failures += 1;
      if (reachable === true && failures >= FAILURES_BEFORE_LOST) {
        reachable = false;
        return [{ key: TRIGGERS.CONNECTION_LOST, data: { reason } }];
      }
      // Never reached since the start: no baseline yet, nothing to fire (and
      // the first success will not fire "restored" either).
      return [];
    },

    /** Forget everything (new Solar-Log address): the next reading is a baseline. */
    reset() {
      producing = null;
      surplus = null;
      reachable = null;
      failures = 0;
    },

    get state() {
      return { producing, surplus, reachable, failures };
    },
  };
}
