# Solar-Log

Follow your solar plant in Gladys with a **Solar-Log** data logger (Solar-Log 200, 250, 300,
500, 1000, 1200, 1900, 2000, Solar-Log Base…): production, consumption, surplus, yields,
inverters and battery. The integration reads the Solar-Log **on your local network** through its
open JSON interface: no cloud account, no data leaves your home.

## What you get

- A **Solar-Log** device: production power, DC power, AC and DC voltages, total yield (kWh
  meter), and — when a consumption meter is wired to the Solar-Log — consumption power, total
  consumption, surplus (production minus consumption) and self-consumption rate.
- One device **per inverter** with its live power (optional).
- A **battery** device (level, charge and discharge power) when the Solar-Log manages one.
- **Scene triggers**: production started / stopped, solar surplus available / ended, Solar-Log
  unreachable / reachable again.
- **Scene actions**: read the solar values, check the solar surplus, get the yield of a period.
- Two **dashboard widgets**: "Solar production" and "Solar yields".

The total yield is published as a meter index: Gladys energy monitoring computes the production
of any day, month or year from it.

## Before you start

1. Give the Solar-Log a **fixed IP address** in your router (DHCP reservation).
2. Open the Solar-Log web page in a browser (its IP address).
3. Go to **Configuration > System > Access control** and turn on **Open JSON interface**. Save.
   Without it, the Solar-Log answers nothing to the integration.
4. Optional: if the "user" access level is protected by a password, note it. It is needed only
   for the per-inverter and battery data.

## Configuration

In Gladys, open **Integrations > Solar-Log > Configuration**:

| Field                   | What to enter                                                              |
| ----------------------- | -------------------------------------------------------------------------- |
| Solar-Log address       | IP address or host name, e.g. `192.168.1.20` (`http://` is added for you). |
| User password           | Only if the "user" access level has a password. Stored as a secret.        |
| Refresh interval (s)    | How often the Solar-Log is read. 60 s by default, 30 s minimum.            |
| Production threshold    | Production (W) that fires "Solar production started". 50 W by default.     |
| Surplus threshold       | Surplus (W) that fires "Solar surplus available". 1000 W by default.       |
| Surplus margin          | "Surplus ended" fires at threshold minus this margin. 200 W by default.    |
| One device per inverter | Also create one device per inverter. On by default.                        |

Then click **Test the connection**: the answer shows the production right now and the yield of
the day. Open the **Discovery** tab and add the devices you want. **Search for inverters again**
re-reads the inverters and the battery after a change on the Solar-Log.

## Scene triggers

| Trigger                   | When                                                         | Variables                                    |
| ------------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| Solar production started  | Production goes above the production threshold (morning).    | `production_w`                               |
| Solar production stopped  | Production falls below half of the threshold (evening).      | `yield_today_kwh`                            |
| Solar surplus available   | Production minus consumption reaches the surplus threshold.  | `surplus_w`, `production_w`, `consumption_w` |
| Solar surplus ended       | The surplus falls below the threshold minus the margin.      | `surplus_w`, `production_w`, `consumption_w` |
| Solar-Log unreachable     | Three reads in a row failed. Filter on the reason if needed. | `reason`                                     |
| Solar-Log reachable again | The Solar-Log answers again.                                 |                                              |

Each trigger fires **once per change**, never at every read, and not when the integration
restarts. The surplus triggers need a consumption meter on the Solar-Log.

## Scene actions

- **Read the solar values**: reads the Solar-Log now. Outputs: `reachable`, `production_w`,
  `consumption_w`, `surplus_w`, `yield_today_kwh`, `self_consumption_percent`.
- **Check the solar surplus**: is the surplus at least the minimum you set? Outputs: `available`
  (never true when the Solar-Log does not answer), `surplus_w`.
- **Get the solar yield**: production and consumption in kWh for today, yesterday, this month,
  this year or since installation.

Example: "When the solar surplus is available, between 10:00 and 16:00, turn on the water
heater plug; when the surplus ends, turn it off."

## Dashboard widgets

- **Solar production**: live production, consumption and surplus, the share of the peak power,
  a 24-hour chart, the yield of the day, the link state and a **Refresh** button.
- **Solar yields**: production and consumption today, yesterday, this month, this year and in
  total, plus the current self-consumption.

## Troubleshooting

- **"The open JSON interface is disabled"**: turn it on (see "Before you start").
- **"The Solar-Log does not answer"**: check the address, that Gladys and the Solar-Log are on
  the same network, and that no firewall blocks port 80.
- **"The Solar-Log refused the password"**: check the password of the "user" access level. The
  plant summary still works without it; only the inverters and the battery need it.
- **Values at 0 right after a Solar-Log restart**: the integration ignores them on purpose until
  the Solar-Log has finished starting.
- **No inverter device**: the per-inverter data may require the password; click **Search for
  inverters again** after entering it.

## Privacy

Everything stays on your network: the integration only talks to your Solar-Log. The password is
stored as a Gladys secret and never written in the logs.
