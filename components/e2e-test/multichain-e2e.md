<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-e2e-test/docs/MULTICHAIN_E2E.md (worktree) -->

# E2E Test Suite: Running Against Multiple Chains

The full E2E suite is chain-parameterized and runs one chain per process. This
page covers running the same suite against every chain supported today (Bitcoin,
Litecoin, and Dogecoin) so
per-chain behavior is exercised (fee-payment mode, capability staking being
BTC-only, and chain-specific node quirks), using the `xchain-node` CLI as the
entry point rather than calling `npm test` directly.

See [Configuration](configuration.md) for the full environment variable
reference and [Operations](operations.md) for running the suite directly with
`npm test` and its Docker/CI details; this page is specifically about the
per-coin, `xchain-node`-driven workflow.

## How Chain Selection Works

The suite's bootstrap hook resolves the target chain from the environment in
one of two ways:

- `COIN` and `NETWORK` set explicitly (e.g. `COIN=litecoin NETWORK=regtest`), or
- `NETWORK` given in `<coin>-<network>` form (e.g. `NETWORK=litecoin-regtest`):
  when `COIN` is unset, this value is split into `COIN` and `NETWORK`.

`xchain-node` provisions each stack with `NETWORK=<coin>-regtest` and leaves
`COIN` unset, so the split path drives the suite for a normal `xchain-node`
managed run.

Do **not** also inject `COIN` when running under `xchain-node`: with `COIN`
set, the split is skipped and `NETWORK` stays in `<coin>-regtest` form, which
produces an invalid network lookup.

The per-coin regtest node configurations already carry the tuning the suite
needs: the Dogecoin regtest config works around a mempool priority quirk in
Dogecoin Core v1.14 (`minrelaytxfee`, `limitfreerelay`, `acceptnonstdtxn`),
and the Litecoin regtest config disables the MWEB BIP9 deployment.

## Running

Per chain (the stack must already be installed and running for that coin):

```bash
xchain-node e2etest bitcoin
xchain-node e2etest litecoin
xchain-node e2etest dogecoin
```

All three, with an aggregated pass/fail summary, using the bundled
multi-chain runner script:

```bash
xchain-node/scripts/run-multichain-e2e.sh                # all three
xchain-node/scripts/run-multichain-e2e.sh litecoin dogecoin
```

Per-coin logs are written to `xchain-node/data/e2e-logs/<coin>-regtest-<timestamp>.log`.

### Exit Code

`xchain-node e2etest` prints `E2E tests finished with exit code N`, and the
CLI process itself exits with that same code. CI and the runner script can
gate on the process exit status directly; there is no need to scrape the
printed line.

## CI Matrix

Run one job per coin. Each is an independent full-stack run, so coins should
not share a stack:

```yaml
# illustrative example
strategy:
  matrix:
    coin: [bitcoin, litecoin, dogecoin]
steps:
  - run: xchain-node install master node ${{ matrix.coin }} regtest   # bring up the stack
  - run: xchain-node e2etest ${{ matrix.coin }}
  # e2etest propagates the suite's real exit code, so a nonzero run fails the step
```

See [Operations](operations.md#ci-integration) for the suite's own
regression-tier CI pipeline, which this matrix complements rather than
replaces.

## Prerequisites (Local Regtest)

- Start the shared `xchain-node-database` container before the first install.
- Use a native filesystem data directory (set via `XCHAIN_NODE_DATA_DIR`) for
  the coin daemons. A shared folder mounted from a host VM is not safe for
  bitcoind/litecoind/dogecoind data files and can corrupt or silently stall
  chain state.
- Run `install` before `e2etest` for a given coin/network.
- Remove the old container (`docker rm -f`) before reinstalling, and remove
  any stale `modules/<repo>` clone to force a refresh of local source.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
