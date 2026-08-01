<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Privacy & Telemetry

`xchain-node` sends a small, anonymous usage ping to the XChain Platform so we can see
which versions and services people are actually running. It helps us decide what to
support, what to fix, and when an old version can be retired. This page explains exactly
what is sent, what is not, and every way to turn it off.

Telemetry is **on by default**. You can turn it off at any time, see
[How to turn it off](#how-to-turn-it-off).

## What is sent

Each ping contains:

- A random **install id**; a one-time anonymous identifier (a UUID). It is not derived
  from your name, hostname, keys, or anything else about you. It only lets us tell two
  pings from the same machine apart from two different machines.
- The **xchain-node version** you are running.
- The **versions** of the XChain services you have installed, and **which ones are
  running** (for example: encoder, decoder, indexer, explorer).
- Basic **operating system and Docker info**; OS name and release, CPU architecture, and
  the Docker engine version.
- A **coarse location and an anonymous network hash**, your IP address is **never stored**.
  When the ping arrives, the receiving server looks at the connection's IP only long enough to
  work out a rough **country and region** and to compute a **one-way keyed hash** (so we can
  count how many distinct networks use the platform), and then discards the IP. We do **not**
  keep your IP address, your city, or your coordinates, and the hash cannot be turned back into
  an IP. Your node never sends its IP; the server only ever sees the connection it arrives on.

## What is NOT sent

- **No IP address is stored**: and never a city, postal code, or coordinates.
- No secrets. Never any passwords, API keys, tokens, or database credentials.
- No wallet data, addresses, balances, or transactions.
- No configuration file contents.
- No file paths, environment variables, or command arguments.

## When it is sent

Telemetry is shallow and infrequent; it lives only in `xchain-node`, not inside the
individual services:

- On **install** and **update**.
- On routine commands (like `start` or `ps`), **at most once per day**. Day-to-day CLI use
  does not send repeated pings.

If your machine is offline or the endpoint is unreachable, the ping is simply skipped. It
never blocks, slows, or fails the command you ran.

## Stored preference

Your opt-out preference and the anonymous install id are stored in
`~/.xchain-node/telemetry.json`. Telemetry is enabled by default; this page documents
exactly what is collected and how to turn it off.

## How to turn it off

Any one of these disables telemetry. They are checked in this order:

1. **Per command / permanently**: pass `--no-telemetry` on any command:
   ```bash
   xchain-node --no-telemetry install master all
   ```
   Once you opt out this way, it stays off on future runs (the choice is remembered).
2. **Environment variable**: set `XCHAIN_NODE_NO_TELEMETRY=1` in your shell or service
   environment.
3. **Preference file**: set `"optOut": true` in `~/.xchain-node/telemetry.json`.

To turn it back on, set `"optOut": false` in `~/.xchain-node/telemetry.json` (and make sure
`XCHAIN_NODE_NO_TELEMETRY` is not set).

## Where it goes

Pings are sent to the platform's central hub at `https://hub.xchain.io/telemetry`. You can
point your node at a different collector (for example your own hub) with the
`XCHAIN_NODE_TELEMETRY_URL` environment variable. Data is retained for 90 days by default
and then deleted.

## Running your own collector

If you operate your own hub and want it to receive (or refuse) telemetry:

- `TELEMETRY_ENABLED`: `true` (default) to accept pings, `false` to reject them.
- `TELEMETRY_RETENTION_DAYS`: how many days to keep pings before pruning (default `90`).
- `TELEMETRY_IP_SALT`: a secret salt for the one-way IP hash. Set it (to a stable, secret
  value) to record the anonymous network hash; if left unset, the hash column is simply left
  empty and only country/region are recorded. The raw IP is never stored either way.
- `TELEMETRY_ADMIN_KEY`: a secret key that gates the per-operator detail endpoint
  (`GET /telemetry/operators`). Leave it unset and that endpoint is fail-closed (returns
  `401`); set it to a secret value and pass the same value in the `x-api-key` header to view
  per-install detail on your own dashboard. The public aggregate census
  (`GET /telemetry/summary`) needs no key.

The country/region lookup uses an offline geolocation database bundled with the hub
(via the `geoip-lite` package, based on MaxMind GeoLite2 data), there is no per-ping call
to any third party.

## Hub-side REST API

The hub exposes three REST endpoints that collect and report this telemetry:
`POST /telemetry` (ingest), `GET /telemetry/summary` (anonymous aggregate census), and
`GET /telemetry/operators` (admin-only per-install detail, gated by `TELEMETRY_ADMIN_KEY`).
Full request/response shapes, query parameters, and field references are documented in
[components/hub/TELEMETRY_API.md](../components/hub/telemetry-api.md).

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
