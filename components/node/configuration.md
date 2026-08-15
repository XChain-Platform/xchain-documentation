<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Node: Configuration

## Config File System

xchain-node uses a two-layer configuration system to generate environment variables for each managed service:

1. **Hardcoded defaults**: defined in `ConfigService.js` for each module type (40+ variables per coin-specific service)
2. **Config file overrides**: read from `config/{coin}-{network}` files in `KEY=VALUE` format

Config files are plain text with one variable per line. Values containing `=` (such as base64 tokens or passwords) are handled correctly; only the first `=` on each line is treated as the separator. Blank lines and lines without `=` are skipped.

Example `config/bitcoin-mainnet`:

```
NODE_EXPOSED_PORT=8333
DUST_AMOUNT=546
ENCODER_API_PORT=3003
```

When a config file is missing, xchain-node falls back to hardcoded defaults with a console warning.

## Environment Variables

### Coin-Specific Services

For each coin-specific service (encoder, decoder, utxo-tracker, indexer), xchain-node generates the following environment variables:

| Variable | Default | Description |
|---|---|---|
| `NETWORK` | `{network}` | Network identifier (`mainnet`, `testnet`, `regtest`) |
| `NODE_URL` | `node` | Coin node Docker hostname |
| `NODE_PORT` | 8332 / 18332 / 18444 | Coin node RPC port (varies by network) |
| `NODE_USER` | `rpc` | Coin node RPC username |
| `NODE_PASSWORD` | `rpc` | Coin node RPC password |
| `UTXO_TRACKER_URL` | `xchain-node-{coin}-{network}-xchain-utxo-tracker` | UTXO tracker Docker hostname |
| `UTXO_TRACKER_API_PORT` | `3001` | UTXO tracker API port |
| `UTXO_TRACKER_PORT` | `3001` | UTXO tracker internal port |
| `DECODER_DB_NAME` | `XChain_{TICKER}_{Network}_Decoder` | Decoder database name |
| `DECODER_DB_HOST` | `mariadb` | MariaDB Docker hostname |
| `DECODER_DB_PORT` | `3306` | MariaDB port |
| `DECODER_DB_USER` | `xchain_decoder_{coin}_{network}` | Decoder DB username |
| `DECODER_DB_PASS` | `xchain-password` | Decoder DB password |
| `DECODER_URL` | `xchain-node-{coin}-{network}-xchain-decoder` | Decoder Docker hostname |
| `DECODER_API_PORT` | `3002` | Decoder API port |
| `ENCODER_URL` | `xchain-node-{coin}-{network}-xchain-encoder` | Encoder Docker hostname |
| `ENCODER_API_PORT` | `3003` | Encoder API port |
| `INDEXER_URL` | `xchain-node-{coin}-{network}-xchain-indexer` | Indexer Docker hostname |
| `INDEXER_API_PORT` | `3004` | Indexer API port |
| `INDEXER_COIN` | `BTC` / `DOGE` / `LTC` | Coin ticker symbol |
| `INDEXER_NETWORK` | `{network}` | Network name |
| `INDEXER_DB_HOST` | `mariadb` | Indexer DB host |
| `INDEXER_DB_PORT` | `3306` | Indexer DB port |
| `INDEXER_DB_NAME` | `XChain_{TICKER}_{Network}_Indexer` | Indexer database name |
| `INDEXER_DB_USER` | `xchain_indexer_{coin}_{network}` | Indexer DB username |
| `INDEXER_DB_PASS` | `xchain-password` | Indexer DB password |
| `HUB_HOST` | `0.0.0.0` | Hub external host |
| `HUB_API_HOST` | `xchain-node-xchain-hub` | Hub Docker hostname |
| `HUB_PORT` | `10000` | Hub API port |

Regtest-only variables (added only when `network === 'regtest'`):

| Variable | Default | Description |
|---|---|---|
| `REGTEST_MINER_URL` | `xchain-node-{coin}-regtest-xchain-regtest-miner` | Regtest miner Docker hostname |
| `REGTEST_MINER_API_PORT` | `3005` | Regtest miner API port |

### Shared Services

For shared services (hub, explorer, sync), a separate set of variables is generated without coin/network-specific values:

| Variable | Default | Description |
|---|---|---|
| `HUB_HOST` | `0.0.0.0` | Hub external host |
| `HUB_API_HOST` | `xchain-node-xchain-hub` | Hub Docker hostname |
| `HUB_PORT` | `10000` | Hub API port |
| `EXPLORER_HOST` | `127.0.0.1` | Explorer external host |
| `EXPLORER_API_HOST` | `xchain-node-xchain-explorer` | Explorer Docker hostname |
| `EXPLORER_PORT_HTTP` | `18080` | Explorer HTTP port (external) |
| `EXPLORER_API_PORT_HTTP` | `8080` | Explorer API HTTP port (internal) |
| `EXPLORER_PORT_HTTPS` | `18081` | Explorer HTTPS port (external) |
| `EXPLORER_API_PORT_HTTPS` | `8081` | Explorer API HTTPS port (internal) |
| `SYNC_MODE` | `server` | Indexer-sync mode |
| `SYNC_API_PORT` | `3006` | Indexer-sync API port |

Two generated defaults worth knowing about:

- `EXPLORER_PORT_HTTP` / `EXPLORER_PORT_HTTPS` (and legacy `EXPLORER_PORT`) are honored from the host environment, so an operator can move the explorer's published ports without editing generated config.
- On **regtest**, fresh indexer installs default `INDEXER_ALLOW_UNAUTHENTICATED=true` when no `INDEXER_API_KEY` is configured: the indexer otherwise fails closed and every gated method 401s, which no local single-operator regtest stack can pass. A config-file value or host `INDEXER_API_KEY` still wins; mainnet and testnet stay fail-closed.

## Naming Conventions

| Entity | Pattern | Example |
|---|---|---|
| Docker image | `xchain-node-{coin}-{network}-{service}` | `xchain-node-bitcoin-mainnet-xchain-encoder` |
| Docker network | `xchain-node-{coin}-{network}` | `xchain-node-bitcoin-mainnet` |
| Database name | `XChain_{TICKER}_{Network}_{Service}` | `XChain_BTC_Mainnet_Decoder` |
| Database user | `xchain_{service}_{coin}_{network}` | `xchain_decoder_bitcoin_mainnet` |
| Module state key | `(module, coin, network)` in MariaDB | `(xchain-encoder, bitcoin, mainnet)` |
| Shared image | `xchain-node-{service}` | `xchain-node-database` |
| Base network | `xchain-node` | `xchain-node` |

## Operator / Runtime Environment Variables

These variables are read by xchain-node itself at startup. They control runtime behaviour such as module source overrides, telemetry, bootstrap integrity, and the Docker naming prefix. Set them in the invoking shell or a systemd unit before running any xchain-node command.

| Variable | Description |
|---|---|
| `NODE_PREFIX` | Override the Docker container/network name prefix (default: `xchain-node`). Must match `/^[a-z0-9][a-z0-9._-]*$/`; validated at load time. |
| `XCHAIN_NODE_MODULES_URLS_OVERRIDE` | JSON map of service names to local paths or alternative git URLs, e.g. `'{"xchain-indexer":"/path/to/local"}'`. Allows installing from a local clone instead of GitHub. Unknown keys are silently ignored; parse errors fall back to defaults with a warning. |
| `XCHAIN_NODE_EXTERNAL_DB` | Set to `1` to skip provisioning the bundled MariaDB container and instead use a host-native MariaDB. When set, all managed services have their DB connection env vars pointed at the external host. Supply `XCHAIN_NODE_EXTERNAL_DB_HOST`, `XCHAIN_NODE_EXTERNAL_DB_PORT`, and `XCHAIN_NODE_EXTERNAL_DB_ROOT_USER` alongside it. |
| `XCHAIN_NODE_EXTERNAL_DB_HOST` | Hostname or IP of the external MariaDB when `XCHAIN_NODE_EXTERNAL_DB=1` (default: `127.0.0.1`). Use the Docker bridge gateway IP (e.g. `172.18.0.1`) when MariaDB runs on the Docker host and services connect from inside containers. |
| `XCHAIN_NODE_EXTERNAL_DB_PORT` | Port of the external MariaDB when `XCHAIN_NODE_EXTERNAL_DB=1` (default: `3306`). |
| `XCHAIN_NODE_EXTERNAL_DB_ROOT_USER` | Root username for the external MariaDB when `XCHAIN_NODE_EXTERNAL_DB=1` (default: `root`). Used during database and user provisioning. |
| `XCHAIN_NODE_EXTERNAL_DB_ROOT_PASSWORD` | MariaDB root password for the host-native (non-Docker) database, used alongside `XCHAIN_NODE_EXTERNAL_DB=1`. Avoids an interactive password prompt in headless installs. Supply alongside `XCHAIN_NODE_EXTERNAL_DB_HOST`, `XCHAIN_NODE_EXTERNAL_DB_PORT`, and `XCHAIN_NODE_EXTERNAL_DB_ROOT_USER`. |
| `XCHAIN_NODE_NO_TELEMETRY` | Set to `1` to disable anonymous usage telemetry. Opt-out is also available via the `--no-telemetry` CLI flag or a persisted preference in `~/.xchain-node/telemetry.json`. |
| `XCHAIN_NODE_TELEMETRY_URL` | Override the telemetry collector endpoint (default: `https://hub.xchain.io/telemetry`). Useful for self-hosted collectors or test environments. |
| `HUB_API_KEY` | API key xchain-node sends as `x-api-key` when talking to the hub, and forwards into the generated service `.env` files. Required whenever the hub runs keyed. Treat as a credential. |
| `FEE_DESTINATION` | Native-coin fee destination forwarded into the generated service `.env` files. **Honoured on testnet and regtest only**, and only when the more specific `XCHAIN_FEE_DESTINATION_<COIN>_<NETWORK>` is unset; on mainnet the bundled coin registry always wins, because fee acceptance is consensus and must not depend on an operator's environment. |

### Telemetry collector

These configure a hub acting as the telemetry **collector**, and are forwarded into its generated `.env`. They are distinct from `XCHAIN_NODE_NO_TELEMETRY`, which controls whether *this* node reports.

| Variable | Description |
|---|---|
| `TELEMETRY_ENABLED` | Whether the collector accepts telemetry. Default `true`. |
| `TELEMETRY_RETENTION_DAYS` | Days of telemetry retained before pruning. Default `90`. |
| `TELEMETRY_IP_SALT` | Salt used to hash reporter IPs so they are aggregated without being stored. Empty by default; set it to a long random value on a real collector. Treat as a credential: changing it re-buckets historical data, and leaking it makes the hashes reversible by brute force. |
| `TELEMETRY_ADMIN_KEY` | Key gating the collector's admin endpoints. Empty by default. Treat as a credential. |
| `XCHAIN_NODE_BOOTSTRAP_SIGNING_KEY` | Path to an Ed25519 private key PEM file used to sign bootstrap archives when running `bootstrap create`. If unset the archive is created unsigned and consumers cannot verify provenance. |
| `XCHAIN_NODE_BOOTSTRAP_PUBKEY` | Path to the Ed25519 public key PEM file used to verify bootstrap archive signatures on restore (default: `src/config/bootstrap_signing_pubkey.pem` within the repo). Override when using a custom signing key. |
| `XCHAIN_NODE_REQUIRE_SIGNED_BOOTSTRAP` | Set to `0`, `false`, or `no` to allow restoring bootstrap archives that have no accompanying signature (e.g. for a self-hosted bootstrap source). Default behaviour is fail-closed: unsigned or unverifiable archives are refused. |
| `XCHAIN_NODE_REQUIRE_SIGNED_RELEASE` | Set to `0`, `false`, or `no` to install a pinned release without verifying its `SHA256SUMS.asc` against the release signing key shipped at `tools/release/release-signing-key.asc` (airgapped and development use). Default behaviour is fail-closed: a missing, tampered or wrongly-keyed signature refuses the install. The override announces itself on every run, and what it gives up is provenance: the install is still pinned to exact commits, but nothing proves who published those pins. |
| `XCHAIN_NODE_GPG_BIN` | Path to the `gpg` binary used for release signature verification (default: `gpg` on `PATH`). Set it where gnupg is installed outside the default path; an absent gpg refuses the install rather than skipping the check. |
| `XCHAIN_NODE_HUB_SIGNER_DIR` | Host directory holding an operator signer module for the hub's on-chain DOGE publishers (ANCHOR / oracle / attestation). Mounted read-only at `/XChainHub/operator-signer` and wired to the hub via `HUB_SIGNER_MODULE` (`<dir>/signer.js`; see `xchain-hub` `examples/doge-signer.example.js` for the module contract). |
| `XCHAIN_NODE_DB_BUFFER_POOL_SIZE` | Passes `--innodb-buffer-pool-size` to the shared MariaDB container (e.g. `16G`). Leave unset on laptops / single-chain nodes. |
| `XCHAIN_NODE_DB_MAX_CONNECTIONS` | Passes `--max-connections` to the shared MariaDB container. Unlike the other tuning flags, this one has an xchain-node default of `1000` when unset: the image default of 151 saturates on a shared multi-chain container and surfaces as misleading "Can't connect to MariaDB" errors. |
| `XCHAIN_NODE_DB_FLUSH_LOG_AT_TRX_COMMIT` | Passes `--innodb-flush-log-at-trx-commit` to the shared MariaDB container (e.g. `2` for faster, less durable flushing). |
| `ALLOW_NO_COLOCATED_HUB_DB` | Forwarded into the explorer's env: set to `1` to let a regtest/dev explorer start without a hub-mirror (checkpoint) schema configured for every serving coin. |
| `CORS_ORIGIN` | Forwarded into every managed service's generated `.env` as its CORS origin. Defaults to `*`, which is right for a local or regtest stack and too permissive for a public deployment; set it to your own origin there. |
| `XCHAIN_NODE_DB_ROOT_PASSWORD` | MariaDB root password for the **bundled** container (the external-DB equivalent is `XCHAIN_NODE_EXTERNAL_DB_ROOT_PASSWORD`). On a fresh install this becomes the password the container is created with; against an existing container it is verified before use. Same credential-handling caveat as the external-DB password below. |
| `XCHAIN_NODE_DB_DATA_DIR` | Pin the bundled MariaDB datadir to a host path (e.g. `/var/lib/mysql` on a fast NVMe mount) instead of the image's anonymous volume, which lands under Docker's data-root and is often a bulk HDD. Unset leaves behaviour unchanged. |
| `XCHAIN_NODE_CONTAINERD_ROOT` | Override the containerd root used for disk accounting (default `/var/lib/containerd`, the Debian/Ubuntu location). Set it for non-standard installs, or to silence a false positive when containerd was already relocated to a path xchain-node cannot infer. |
| `XCHAIN_NODE_LOCK_DIR` | Directory holding `command.lock`. Defaults to the same per-user directory as `credentials.json`. Test and ops override. |
| `XCHAIN_NODE_LOCK_WAIT_MS` | How long a non-mutating command waits for a lock-holding mutator before giving up. Bounded on purpose: a read-only command pauses and then errors clearly rather than provisioning concurrently and corrupting the stack. Default `15000`. |
| `XCHAIN_NODE_AUTOHEAL_STATE_DIR` | Directory holding autoheal state. Defaults to the same per-user directory as `credentials.json`. Test and ops override. |
| `GITHUB_TOKEN` / `GH_TOKEN` | Personal access token for GitHub downloads. Raises the anonymous API rate limit and is required to reach private module repositories. `GITHUB_TOKEN` is checked first. Treat as a credential: supply it from the environment, never a checked-in file. |
| `BTC_INDEXER_API_URL` | BTC indexer JSON-RPC URL used as the block-height anchor for the validator-mode price oracle (`hub.getlatestblock`). Read from the host environment so a hub that is **not** co-located with a BTC indexer (the master hub box, where the BTC stack lives elsewhere) can point at a reachable one. Empty by default, in which case the hub falls back to its local resolution. |

### Bootstrap

| Variable | Description |
|---|---|
| `XCHAIN_NODE_BOOTSTRAP_BASE_URL` | Base URL for published bootstrap archives (default `https://sync.xchain.io/bootstraps`). Layout is `<base>/<module>/<coin>/<network>/latest.tgz`. Auto-restore is on by default on a fresh install. |
| `XCHAIN_NODE_BOOTSTRAP_DIR` | Where bootstrap archives are written and read (default: the data directory). Bootstrap archives are the one artifact whose size is unbounded by the install (a mainnet tracker archive runs to tens of GB, and LTC mainnet alone is 45G of source data), so this exists to land them on a big volume **without** relocating live module data. |
| `XCHAIN_NODE_NO_BOOTSTRAP` | Set to `1` to skip the auto-download/restore and sync from scratch. Equivalent to the global `--no-bootstrap` flag, which sets this variable. |
| `XCHAIN_NODE_BOOTSTRAP_MAX_LAG_BLOCKS` | Maximum blocks a bootstrap source may trail the chain tip and still be accepted (default `100`). |
| `XCHAIN_NODE_BOOTSTRAP_SKIP_HEALTH_GATE` | Set to `1`/`true`/`yes` to skip the bootstrap source health gate entirely. The gate exists to stop a stale or unhealthy source becoming a published archive; skip it only deliberately. |

### Go-live gate

`xchain-node` runs a pre-flight check before deploying a **mainnet** write surface (and before the hub and sync shared services, which deploy with no coin/network). It refuses the deploy if the configuration is not launch-ready.

| Variable | Description |
|---|---|
| `XCHAIN_NODE_GO_LIVE` | Arm the go-live pre-flight. Until this is truthy, mainnet write surfaces are not treated as live. |
| `XCHAIN_NODE_SKIP_GO_LIVE_GATE` | Set truthy to skip the pre-flight checks entirely. Logs a loud warning; intended for controlled test venues, not production. |
| `XCHAIN_NODE_SKIP_MIGRATION_PRECONDITION` | Set to `1`/`true`/`yes` to install a module whose source asserts a database migration that has not been applied. The precondition exists because such an update starts a service against a schema it expects to have changed; skip it only when you are applying the migration yourself. |

> **Note on `XCHAIN_NODE_EXTERNAL_DB_ROOT_PASSWORD`:** this is a credential value. Pass it via your deployment environment or secrets manager; do not store it in config files checked into version control.

## Host Environment Variables (path overrides)

These env vars override where xchain-node stores its filesystem state on the host. Set them in the shell, systemd unit, or host-provisioning playbook **before** invoking `xchain-node install` or any other command. All five fall back to their in-repo defaults if unset, so existing installs are unaffected.

| Variable | Default | What goes here |
|---|---|---|
| `XCHAIN_NODE_DATA_DIR` | `<repo>/data` | Per-coin/network/module persistent state. Includes bootstrap output `.tar.gz` archives for utxo-tracker / decoder / indexer. **Tens to hundreds of GB at scale**: point at a large volume. |
| `XCHAIN_NODE_TMP_DIR` | `<repo>/tmp` | Bootstrap inner work archives (`data.tar.gz`, `data.sha256`) and module-update clones. **Tens of GB during bootstrap operations**: point at the same large volume as `XCHAIN_NODE_DATA_DIR`. |
| `XCHAIN_NODE_MODULES_DIR` | `<repo>/modules` | Git clones of every sibling xchain-* repo. 1–3 GB total. |
| `XCHAIN_NODE_CRYPTO_NODES_DIR` | `<repo>/crypto_nodes` | Downloaded Bitcoin/Doge/Litecoin tarballs + extracted binaries. 100–500 MB per coin. |
| `XCHAIN_NODE_CONFIG_DIR` | `<repo>/config` | Generated per-service `.env` files. Small. |
| `XCHAIN_NODE_BLOCKS_DIR` | (unset → inside data volume) | Optional host path for the coin node's `blocks/` directory. If set, mounted as `/blocks` into the docker container so chain data can live on a separate disk from the rest of the node state. |

> **⚠️ Testnet / regtest write to a network-prefixed subdirectory.** Dogecoind and litecoind place block data under a per-network subdirectory of the datadir on every network except mainnet:
>
> | Coin / network | Blocks land in |
> |---|---|
> | DOGE / LTC mainnet | `blocks/` |
> | DOGE testnet | `testnet3/blocks/` |
> | LTC testnet | `testnet4/blocks/` |
> | DOGE / LTC regtest | `regtest/blocks/` |
>
> This matters if you ever try to free up disk by hand-mounting *only* the bare `blocks/` path, e.g. `-v /misc/dogecoin/testnet/blocks:/root/.dogecoin/blocks`. On testnet/regtest the daemon writes to `testnet3/blocks/` (etc.), which that bind does **not** cover, so the mount silently catches nothing and blocks keep accumulating on the default disk. No error is raised.
>
> `XCHAIN_NODE_BLOCKS_DIR` avoids this trap entirely: xchain-node starts the daemon with `-blocksdir=/blocks`, which the daemon honours on every network, so all per-network subdirectories land inside the mounted path (`/blocks/testnet3/blocks/`, `/blocks/regtest/blocks/`, …). A single host bind therefore covers mainnet, testnet, and regtest uniformly. See [Disk Management](../../operations/disk-management.md) for the full disk-offload guide.

### Recommended setup for OVH RISE-3 chain-node boxes

On the RISE-3 archetype (small `/` partition, large `/misc` SATA mirror), set these before installing:

```bash
export XCHAIN_NODE_DATA_DIR=/misc/xchain-node-data
export XCHAIN_NODE_TMP_DIR=/misc/xchain-node-tmp
export XCHAIN_NODE_MODULES_DIR=/misc/xchain-node-modules
export XCHAIN_NODE_CRYPTO_NODES_DIR=/misc/xchain-node-crypto_nodes
```

Without these overrides the small `/` partition fills the moment a bootstrap is created (inner work archive + outer archive together can exceed 70 GB for BTC mainnet).

## Internal Constants

| Constant | Value | Location | Description |
|---|---|---|---|
| `NODE_PREFIX` | `xchain-node` | constants.js | Prefix for all Docker container and network names |
| `SEP` | `-` | constants.js | Separator for Docker naming (`xchain-node-bitcoin-mainnet`) |
| `DB_SEP` | `_` | constants.js | Separator for database naming (`xchain_decoder_bitcoin_mainnet`) |
| `DB_NAME` | `xchain_node` | CredentialsService.js | MariaDB database name used to store module state |

### NODE_PREFIX Validation

The `NODE_PREFIX` can be overridden via the `NODE_PREFIX` environment variable. It is validated against `/^[a-z0-9][a-z0-9._-]*$/` on load: shell metacharacters, spaces, uppercase letters, and dollar signs are rejected with a clear error.

### Port Validation

All port values are validated via `validatePort()` before reaching Docker command construction:

- Accepts integers 1–65535
- Accepts digit-only strings ("8332") that parse to valid integers
- Rejects floats, NaN, Infinity, negative numbers, zero, strings with non-digit characters

### Branch Name Validation

Branch names are validated against `/^[a-zA-Z0-9._\-\/]+$/` in `resolveArgs()`:

- Accepts: `master`, `develop`, `feature/my-branch_v1.0`
- Rejects: `master;rm -rf /`, `` master`whoami` ``, `$(whoami)`

### Container ID Validation

Container IDs returned by `docker run` are validated against `/^[a-f0-9]{64}$/`:

- Must be exactly 64 lowercase hex characters
- Rejects IDs with injection payloads, wrong lengths, or non-hex characters

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
