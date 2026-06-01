<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Disk Management — Moving Chain Data to a Larger Disk

Block data is by far the largest thing a chain node stores, and it grows without
bound. On a box with a small system partition and a larger secondary disk, the
chain datadir eventually fills `/` and the node stops making progress. This page
covers how to move a chain's block data — or its whole datadir — onto a bigger
disk on a running xchain-node deployment.

There are **two safe patterns** and **one anti-pattern that fails silently**.

## Background: where the daemon writes blocks

Dogecoind and litecoind write block data under a per-network subdirectory of the
datadir on every network **except** mainnet. This is upstream Bitcoin Core
behaviour, inherited by both forks:

| Coin / network | Blocks land in |
|---|---|
| DOGE / LTC mainnet | `blocks/` |
| DOGE testnet | `testnet3/blocks/` |
| LTC testnet | `testnet4/blocks/` |
| DOGE / LTC regtest | `regtest/blocks/` |

Any disk-offload approach has to account for the network subdirectory. The two
safe options below do; the anti-pattern does not.

## Option A (recommended): `XCHAIN_NODE_BLOCKS_DIR`

Set the `XCHAIN_NODE_BLOCKS_DIR` env var to a host path on the larger disk, then
restart the container:

```bash
export XCHAIN_NODE_BLOCKS_DIR=/misc/dogecoin/blocks
# (re)install / restart the affected node so the new bind takes effect
```

xchain-node bind-mounts that host path to `/blocks` inside the container and
starts the daemon with `-blocksdir=/blocks`. The daemon honours `-blocksdir` on
**every** network, so all per-network subdirectories land inside the mounted
path:

```
/blocks/blocks/            # mainnet
/blocks/testnet3/blocks/   # DOGE testnet
/blocks/testnet4/blocks/   # LTC testnet
/blocks/regtest/blocks/    # regtest
```

A single host bind therefore covers mainnet, testnet, and regtest uniformly,
with no per-network path to get wrong. This is the canonical answer — prefer it
for any new install or whenever you can set the env var.

See [`XCHAIN_NODE_BLOCKS_DIR`](../components/node/CONFIGURATION.md) in the node
configuration reference for the full list of host path-override env vars.

## Option B: symlink the whole datadir

When you cannot set the env var — for example on an existing deployment you do
not want to reinstall — symlink the entire per-network datadir to the larger
disk:

```bash
# stop the node, move the data, then symlink the per-network datadir
mv ~/xchain-node/data/node/dogecoin/testnet /misc/xchain-node-data/dogecoin/testnet
ln -s /misc/xchain-node-data/dogecoin/testnet ~/xchain-node/data/node/dogecoin/testnet
# start the node again
```

Because the symlink redirects the **entire** per-network datadir, it
transparently covers every subdirectory the daemon writes — including
`testnet3/blocks/`, `chainstate/`, and the rest — without you having to name any
network subdirectory by hand. This is the pattern that resolved a real disk-full
incident in the field.

## Anti-pattern (do NOT do this): bare `blocks/` bind mount

The instinct when `/` fills is to bind-mount just the `blocks/` subdirectory to
the larger disk:

```bash
# DO NOT DO THIS for testnet / regtest — it silently misses everything
docker run ... -v /misc/dogecoin/testnet/blocks:/root/.dogecoin/blocks ...
```

On **mainnet** this works, because mainnet blocks really do live in the bare
`blocks/`. On **testnet and regtest it catches nothing**: the daemon writes to
`testnet3/blocks/` (or `testnet4/blocks/`, or `regtest/blocks/`), which the bind
above does not cover. There is **no error** — the daemon starts normally, the
mount appears successful, and blocks quietly keep piling up on the default disk
until it fills again.

Network-subdir reference (the values the bare-blocks bind gets wrong):

| Coin / network | Blocks land in |
|---|---|
| DOGE testnet | `testnet3/blocks/` |
| DOGE regtest | `regtest/blocks/` |
| LTC testnet | `testnet4/blocks/` |
| LTC regtest | `regtest/blocks/` |

If you must bind only the blocks directory rather than use Option A, bind the
**network-subdir** path (`.../testnet3/blocks`, etc.) — never the bare
`blocks/`. But Option A (`XCHAIN_NODE_BLOCKS_DIR`) is strongly preferred: it is
network-agnostic and removes the chance of getting the `testnet3` / `testnet4`
magic number wrong.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
