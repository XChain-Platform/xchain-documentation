<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Deployment

This guide covers deploying the XChain Platform from scratch, from a single-chain regtest setup to a full multi-chain mainnet installation.

---

## Prerequisites

### Software

- **Docker**: Engine 20.10 or later. Docker must be accessible to the current user (add user to `docker` group or run as root).
- **Node.js**: 22 (22.x LTS) exactly, required to run the xchain-node CLI. Node 18 and earlier fail on the ESM-only `mariadb` driver (`ERR_REQUIRE_ESM`); Node 24 cannot build the native `isolated-vm` module the indexer and explorer pull in.
- **Git**: to clone xchain-node.

Verify Docker is working before proceeding:

```bash
docker info
```

### Disk Space

Blockchain data can be substantial. Budget accordingly before starting a mainnet sync:

| Chain | Approx. blockchain size (mainnet, as of 2026) |
|---|---|
| Bitcoin (BTC) | ~700 GB |
| Litecoin (LTC) | ~100 GB |
| Dogecoin (DOGE) | ~100 GB |

Add headroom for the indexer and decoder databases. A full BTC + LTC + DOGE mainnet deployment should have at least 1.5 TB of free disk space. For regtest, a few gigabytes is sufficient.

### Network Ports

Each service exposes a JSON-RPC port. Make sure these are not blocked by firewall rules on the host if external access is needed. Default ports differ per coin and network. See [Configuration](./configuration.md) for a full port listing.

---

## Installing xchain-node

xchain-node is the CLI tool that installs, starts, stops, and monitors all other services as Docker containers.

```bash
git clone https://github.com/XChain-Platform/xchain-node
cd xchain-node
npm install
```

Optionally install the `xchain-node` symlink globally:

```bash
# Follow the steps in INSTALL.md inside the xchain-node directory
```

After installation, verify the CLI is working:

```bash
xchain-node --help
# or if installed globally:
xchain-node --help
```

---

## Running the Installer

The `install` command clones the target service from GitHub, builds its Docker image, and registers it with the hub. The `all` keyword installs every service for a given chain and network in the correct dependency order.

```bash
xchain-node install all bitcoin mainnet
```

Arguments: `install [ref] [service] [chain] [network]`

- `ref`: what to install. Omit it for the latest published release: that resolves the release manifest and pins every component to the exact commit that was tagged, signed and tested together, which is the only form that gives you a reproducible stack. A release tag such as `v0.15.2` installs that release instead. A branch name (`master`, `develop`) is also accepted and installs whatever that branch happens to point at right now, which is for development, not for running a node. Later, `xchain-node update all` moves the node (CLI included) to the newest release; see [Upgrading](./upgrading.md).
- `service`: `all`, or a specific service name such as `xchain-decoder`.
- `chain`: `bitcoin`, `litecoin`, `dogecoin`, or `all`.
- `network`: `mainnet`, `testnet`, or `regtest`.

The installer automatically ensures `xchain-hub` is installed first, since other services depend on it for configuration.

---

## Starting Services

Start all services for a chain:

```bash
xchain-node start all bitcoin mainnet
```

Start a single service:

```bash
xchain-node start xchain-decoder bitcoin mainnet
```

Check running container status:

```bash
xchain-node ps
```

---

## Deployment Configurations

### Full Multi-Chain Mainnet (BTC + LTC + DOGE)

A full mainnet deployment runs one coin node, decoder, indexer, encoder, and UTXO tracker per chain, plus one shared hub, explorer, and MariaDB instance.

Install each chain in sequence:

```bash
xchain-node install all bitcoin mainnet
xchain-node install all litecoin mainnet
xchain-node install all dogecoin mainnet
```

Minimum recommended resources for the full three-chain stack:

| Resource | Recommendation |
|---|---|
| CPU | 8+ cores |
| RAM | 32 GB |
| Disk | 2 TB+ NVMe SSD |
| Network | 100 Mbps sustained (during initial sync) |

### Single-Chain Deployment

If only one chain is needed, install only that chain:

```bash
xchain-node install all litecoin mainnet
```

This reduces resource requirements proportionally. A single-chain LTC or DOGE deployment can run comfortably on a 4-core, 8 GB RAM machine with 250 GB of disk.

### Memory on a multi-chain host

The utxo-tracker is the service that decides how much memory a chain costs. It sizes three allocations from the memory it may use: a LevelDB block cache (a quarter of its budget), a heap-flush threshold (an eighth) and, during the initial bulk sync, an external-sort budget (half). Inside a container that budget is the container's memory limit when one is set, and the whole host when none is.

`xchain-node` sets that limit for every tracker it creates: half the host RAM, divided by the number of trackers installed on the host, floored at 1024 MB and ceilinged at 16384 MB. On a 16 GB host running three chains each tracker gets 2730 MB, which derives a 682 MB cache, a 341 MB heap-flush threshold and a 1365 MB bulk-sync budget; the other half of the host is left for the chain daemons (a synced bitcoind alone holds 3 to 4 GB), MariaDB, the decoders, the indexers, the hub and the explorer.

Three things follow from the formula:

- **The limit is computed when the container is created.** Adding a chain to a host does not shrink the trackers that already exist; run `xchain-node recreate xchain-utxo-tracker all all` after installing a new chain so every tracker is re-sized for the new count.
- **A host that cannot afford the floor is told.** When half the host divided by the tracker count falls under 1024 MB, each tracker still gets 1024 MB and `install` prints a warning that the host is oversubscribed; run fewer chains there.
- **Only the tracker is limited by default.** The decoder, indexer and hub do not size themselves to a cgroup limit, so a limit on them turns a transient spike (a large mempool batch, a deep reorg) into an OOM kill and a restart loop. Cap one explicitly with `XCHAIN_NODE_MODULE_MEMORY_MB_<SERVICE>` only after measuring it.

To override the derivation for a tracker, either set the container limit (`XCHAIN_NODE_MODULE_MEMORY_MB_XCHAIN_UTXO_TRACKER=4096` before `recreate`; the tracker re-derives its slices from the new limit) or set the slices themselves in the tracker's environment (`LEVELDB_CACHE_BYTES`, `HEAP_FLUSH_THRESHOLD_MB`, `BULK_SYNC_RAM_BUDGET`), documented on the [utxo-tracker configuration](../components/utxo-tracker/configuration.md#memory-budget) page. Setting a slice larger than the container limit allows is the one combination to avoid: the kernel enforces the limit, not the tracker.

### Regtest Deployment (Development / Testing)

Regtest uses local blockchain simulation with no real network sync. This is the fastest way to bring up a fully working stack for development or testing.

```bash
xchain-node install all bitcoin regtest
xchain-node start all bitcoin regtest
```

Regtest also installs `xchain-regtest-miner`, which automatically mines blocks when transactions appear in the mempool.

To skip bootstrap archive downloads and force a full parse from block 0:

```bash
xchain-node --no-bootstrap install all bitcoin regtest
```

### Private Deployment (Regtest as Production)

Some operators run a private XChain instance on a permissioned regtest network. The setup is identical to a standard regtest deployment. Control block production via the regtest-miner or by calling `generatetoaddress` directly on the coin node.

---

## Initial Sync

After starting a mainnet coin node for the first time, it must download and verify the entire blockchain. This can take anywhere from several hours (LTC, DOGE) to multiple days (BTC) depending on disk I/O speed and network bandwidth.

The decoder and the UTXO tracker follow the coin node's tip. While the node reports `initialblockdownload: true` with its tip below the height a service already holds, the service waits instead of treating the lower tip as a reorg, and `xchain-node ps` shows it as `WAITING FOR NODE` with the two heights under the table. You can watch the wait and the node's progress in the service logs:

```bash
xchain-node logs xchain-decoder bitcoin mainnet
```

The service logs when it resumes after the node passes it.

### Bootstrap Archives (Optional)

On a fresh install, xchain-node downloads the published bootstrap archive for each of the decoder, the indexer and the UTXO tracker and restores it, so the service starts at the archive's height instead of parsing from its start block. The same restore can be run by hand:

```bash
xchain-node bootstrap restore xchain-utxo-tracker bitcoin mainnet
```

Use `--no-bootstrap` on install to skip this entirely and do a full parse.

**A bootstrap assumes a coin node at or past the archive's height.** On a mainnet host whose node is still syncing from zero, a restored service sits thousands of blocks above the node for hours or days. Each archive carries the height it ends at, and the install compares it with the node's tip before restoring:

- the node is at or past the archive: restored, nothing to do;
- the node is below the archive and the service waits out a catching-up node (decoder and tracker from v0.16.0, and the indexer, which follows the decoder): restored, reported as `WAITING FOR NODE` in the install summary and in `ps`, and the service continues on its own once the node passes the archive height;
- the node is below the archive and the service image predates that wait: the restore is refused and the service parses forward from its start block as the node catches up. The summary says so. To take the restore later, wait for the node to pass the archive height and re-run install with `XCHAIN_NODE_FORCE_BOOTSTRAP=1`, or install with `--no-bootstrap` to stop it trying;
- the archive carries no height (published before the member existed) or the node cannot be asked yet: restored as before, with a note saying the comparison was not possible.

`XCHAIN_NODE_SKIP_NODE_TIP_GUARD=1` skips the comparison; it is warned loudly, like the other skip gates.

Two orderings avoid the wait entirely on a slow host: let the coin node finish its initial sync before installing the services, or install with `--no-bootstrap` and let the services parse forward behind the node.

#### Bootstrap signatures

Each published bootstrap archive can carry a detached Ed25519 signature
(`<archive>.sig`). When the consumer machine has the publisher's public key
pinned (`src/config/bootstrap_signing_pubkey.pem` in the xchain-node checkout,
or a path in `XCHAIN_NODE_BOOTSTRAP_PUBKEY`), the signature is verified before
any restore; the checksum embedded inside the archive only detects transport
corruption, while the signature proves the archive is the one the publisher
built.

Signature enforcement is **on by default** (fail-closed): a restore is refused
when the public key or `.sig` is missing, or when the signature does not verify.
On a fresh install's automatic restore the refusal is caught and the node syncs
from scratch rather than restoring an unverified archive; a manual `bootstrap
restore` aborts. To opt out, e.g. for a self-hosted source that publishes no
signatures, set `XCHAIN_NODE_REQUIRE_SIGNED_BOOTSTRAP=0` (also accepts
`false`/`no`).

**Publishers**: generate a keypair once:

```bash
openssl genpkey -algorithm ed25519 -out bootstrap_signing_key.pem
openssl pkey -in bootstrap_signing_key.pem -pubout -out bootstrap_signing_pubkey.pem
```

Keep the private key on the publishing host(s) only (back it up offline; it is
the trust root for every consumer's restore), commit the public half as
`src/config/bootstrap_signing_pubkey.pem`, and set
`XCHAIN_NODE_BOOTSTRAP_SIGNING_KEY=/path/to/bootstrap_signing_key.pem` so
`bootstrap create` writes a `.sig` beside each archive. **Always upload the
`.sig` together with its archive**; a missing or mismatched signature makes
every consumer refuse the restore.

To automate creation + signing + upload + retention, use
`scripts/publish-bootstraps.sh`. It wraps `bootstrap create` for every served
combo, signs inline, transfers each archive + `.sig` to the bootstrap host, and
prunes to the newest few. It is cron-safe (single-instance `flock`) and makes
the downtime-bearing UTXO-tracker creates opt-in (a tracker create stops its
container for the snapshot):

```bash
# decoder + indexer only: online dump, no downtime (good for a weekly cron):
scripts/publish-bootstraps.sh --all
# include the UTXO trackers: stops each tracker for the snapshot, so schedule a window:
scripts/publish-bootstraps.sh --all --with-trackers
```

---

## Verifying the Pipeline

Once all services are running, verify data is flowing through the pipeline:

**1. Coin node is synced:**
Check decoder logs for active block processing (block numbers should be incrementing).

**2. Decoder is writing to its database:**
```bash
xchain-node exec xchain-decoder bitcoin mainnet \
  "mysql -u root XChain_BTC_Mainnet_Decoder -e 'SELECT MAX(block_index) FROM blocks;'"
```

**3. Indexer is processing decoder output:**
The indexer block height should be close to (or equal to) the decoder block height. Check indexer logs:
```bash
xchain-node logs xchain-indexer bitcoin mainnet
```

**4. Explorer is serving data:**
Hit the explorer's HTTP endpoint. By default the explorer runs on port 18080:
```bash
curl http://localhost:18080/btc/api/ping
```

---

## Log Locations

Logs are written to Docker container stdout/stderr. Access them via xchain-node:

```bash
xchain-node logs xchain-decoder bitcoin mainnet      # full logs
xchain-node tail xchain-decoder bitcoin mainnet      # follow (tail -f)
xchain-node monitor                                  # multi-pane live monitor (all services)
xchain-node tailmonitor                              # tail + monitor combined
```

Direct Docker access:
```bash
docker logs xchain-node-bitcoin-mainnet-xchain-decoder
docker logs -f xchain-node-bitcoin-mainnet-xchain-decoder
```

---

## Stopping and Restarting Services

Stop all services for a chain:
```bash
xchain-node stop all bitcoin mainnet
```

Stop a single service:
```bash
xchain-node stop xchain-indexer bitcoin mainnet
```

Restart a service:
```bash
xchain-node restart xchain-decoder bitcoin mainnet
```

Restarting a service does not affect its database. The decoder and indexer resume from where they left off.

---

## Upgrading a Deployed Fleet

On a single machine managed by one xchain-node install, `xchain-node update all` updates everything in the correct order; see [Upgrading](./upgrading.md). If you split services across multiple hosts, follow the strict hub-before-indexer ordering with a single-chain canary and a post-deploy smoke pass described in [Upgrading: Multi-Host Fleets](./upgrading.md#multi-host-fleets) before updating any multi-service release.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
