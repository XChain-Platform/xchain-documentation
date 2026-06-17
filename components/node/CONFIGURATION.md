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
ENCODER_API_PORT=4003
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
| `HUB_HOST` | `127.0.0.1` | Hub external host |
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
| `HUB_HOST` | `127.0.0.1` | Hub external host |
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

## Naming Conventions

| Entity | Pattern | Example |
|---|---|---|
| Docker image | `xchain-node-{coin}-{network}-{service}` | `xchain-node-bitcoin-mainnet-xchain-encoder` |
| Docker network | `xchain-node-{coin}-{network}` | `xchain-node-bitcoin-mainnet` |
| Database name | `XChain_{TICKER}_{Network}_{Service}` | `XChain_BTC_Mainnet_Decoder` |
| Database user | `xchain_{service}_{coin}_{network}` | `xchain_decoder_bitcoin_mainnet` |
| LevelDB key | `MC{module};{coin};{network}` | `MCxchain-encoder;bitcoin;mainnet` |
| Shared image | `xchain-node-{service}` | `xchain-node-database` |
| Base network | `xchain-node` | `xchain-node` |

## Operator / Runtime Environment Variables

These variables are read by xchain-node itself at startup. They control runtime behaviour such as module source overrides, telemetry, bootstrap integrity, and the Docker naming prefix. Set them in the invoking shell or a systemd unit before running any xchain-node command.

| Variable | Description |
|---|---|
| `NODE_PREFIX` | Override the Docker container/network name prefix (default: `xchain-node`). Must match `/^[a-z0-9][a-z0-9._-]*$/`; validated at load time. |
| `XCHAIN_NODE_MODULES_URLS_OVERRIDE` | JSON map of service names to local paths or alternative git URLs, e.g. `'{"xchain-indexer":"/path/to/local"}'`. Allows installing from a local clone instead of GitHub. Unknown keys are silently ignored; parse errors fall back to defaults with a warning. |
| `XCHAIN_NODE_EXTERNAL_DB_ROOT_PASSWORD` | MariaDB root password for the host-native (non-Docker) database, used alongside `XCHAIN_NODE_EXTERNAL_DB=1`. Avoids an interactive password prompt in headless installs. Supply alongside `XCHAIN_NODE_EXTERNAL_DB_HOST`, `XCHAIN_NODE_EXTERNAL_DB_PORT`, and `XCHAIN_NODE_EXTERNAL_DB_ROOT_USER`. |
| `XCHAIN_NODE_NO_TELEMETRY` | Set to `1` to disable anonymous usage telemetry. Opt-out is also available via the `--no-telemetry` CLI flag or a persisted preference in `~/.xchain-node/telemetry.json`. |
| `XCHAIN_NODE_TELEMETRY_URL` | Override the telemetry collector endpoint (default: `https://hub.xchain.io/telemetry`). Useful for self-hosted collectors or test environments. |
| `XCHAIN_NODE_BOOTSTRAP_SIGNING_KEY` | Path to an Ed25519 private key PEM file used to sign bootstrap archives when running `bootstrap create`. If unset the archive is created unsigned and consumers cannot verify provenance. |
| `XCHAIN_NODE_BOOTSTRAP_PUBKEY` | Path to the Ed25519 public key PEM file used to verify bootstrap archive signatures on restore (default: `src/config/bootstrap_signing_pubkey.pem` within the repo). Override when using a custom signing key. |
| `XCHAIN_NODE_REQUIRE_SIGNED_BOOTSTRAP` | Set to `0`, `false`, or `no` to allow restoring bootstrap archives that have no accompanying signature (e.g. for a self-hosted bootstrap source). Default behaviour is fail-closed: unsigned or unverifiable archives are refused. |

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
> `XCHAIN_NODE_BLOCKS_DIR` avoids this trap entirely: xchain-node starts the daemon with `-blocksdir=/blocks`, which the daemon honours on every network, so all per-network subdirectories land inside the mounted path (`/blocks/testnet3/blocks/`, `/blocks/regtest/blocks/`, …). A single host bind therefore covers mainnet, testnet, and regtest uniformly. See [Disk Management](../../operations/DISK_MANAGEMENT.md) for the full disk-offload guide.

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
| `DB_NAME` | `xchain_node` | constants.js | LevelDB database directory name |

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
