<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-indexer/docs/DATA-RETENTION-POLICY.md (worktree) -->

# Indexer: Data Retention and Pruning

Several indexer tables grow without bound over time. This page documents the
platform's retention and pruning policy: which tables are unbounded, what the
indexer's built-in pruning scaffold does about the largest and most delicate
one (the light-client state store), and how the hub's own audit tables are
kept in check.

Guiding rule: retention is **default-off and additive**. Turning it on is an
operator decision per node. Nothing prunes data on an existing deployment
unless a retention environment variable is set, and no schema is ever dropped
or altered: pruning only issues `DELETE`s, never `DROP`/`ALTER`, and creates
no tables.

## The state commitment store

Two tables back the SPV light-client commitment (see
[Database](database.md) for their full schema):

- `state_tree_roots`: one row per block (`balances_root`, `stakes_root`,
  `state_root`, `block_merkle_root`). Grows one row per block forever.
- `state_tree_nodes`: the content-addressed, copy-on-write SMT internal-node
  store. Append-only during forward processing (identical subtrees dedupe by
  hash). A reorg leaves orphaned nodes behind: the rollback drops the
  `state_tree_roots` pointers for the orphaned blocks, but not the nodes
  themselves.

The indexer measures this growth (total nodes vs. reachable nodes) on an
ongoing basis, but does not delete anything by default. The reason is subtle:
a content-addressed node orphaned by a reorg is commonly **re-created** by the
new canonical chain (the insert no-ops and the row keeps its id). Deleting
such a node after it has been re-referenced would make the next incremental
state-tree read a missing row as an empty subtree, and fork the
`balances_root` across the network.

### Two phases, in a load-bearing order

**Phase 1: root retention.** Keep roots for blocks with
`block_index > (tip - STATE_ROOT_RETENTION_BLOCKS)`; drop older root rows.
This only drops block-to-root pointers. It never touches the node store, and
it never affects incremental forward processing (which reads only the
immediately-prior root). Its one real consequence: a block whose root row is
pruned can no longer be served as an SPV proof root by the explorer's proof
server. That is the whole point of a retention window, and it is why the
window is an operator choice.

**Phase 2: orphan-node reclaim.** After phase 1, delete `state_tree_nodes`
rows that are unreachable from every surviving root (the union of each
retained row's `balances_root` and `stakes_root`). This is the reclamation
step, and it is only safe under one condition: the mark-and-delete pass must
not interleave with forward block-root insertion. The indexer enforces this
by holding the same database transaction lock that block processing uses for
the whole mark-and-delete pass, so while a reclaim runs, no new node can be
inserted and no node the reclaim just marked unreachable can be
re-referenced underneath it. Phase 2 is a strict opt-in on top of phase 1
(`STATE_NODE_RECLAIM`), because it is the consensus-sensitive half; phase 1
alone (drop old roots, keep all nodes) is the conservative default once
retention is enabled at all.

Ordering matters: reclaim runs **after** the root prune in the same sweep, so
nodes freshly orphaned by narrowing the root set are actually collectable.

### Configuration

All of these are unset (off) by default; see [Configuration](configuration.md)
for the indexer's full environment variable reference.

| Variable | Default | Effect |
|---|---|---|
| `STATE_ROOT_RETENTION_BLOCKS` | unset | A positive integer turns retention on and sets the phase-1 window. Unset or `0` means off (keep everything, the historical default behavior). |
| `STATE_NODE_RECLAIM` | off | `1` or `true` additionally enables phase-2 orphan-node reclaim. Ignored unless retention is on. |
| `STATE_RETENTION_INTERVAL_MS` | `21600000` (6h) | Sweep cadence. |
| `STATE_TREE_METRIC_MAX_NODES` | `2000000` | Shared with the orphan-growth metric: above this node count, the in-memory mark (and thus phase-2 reclaim) is skipped to bound memory. Phase-1 root prune still runs. |

Operational guidance: a retention window must be wider than the deepest reorg
a chain will ever serve, and wide enough for the SPV proof horizon the
explorer advertises. Start with phase-1 only, watch the orphan metric fall as
roots age out, and only enable `STATE_NODE_RECLAIM` once the mutex-serialized
reclaim has been exercised on a regtest venue.

## Hub audit tables

The hub already prunes its two unbounded audit tables; recorded here for
completeness so the platform's retention policy lives in one place.

- `oracle_submissions`: diagnostic only (finalized values live in
  `price_snapshots`). Pruned keyed on `round_number`, keeping
  `ORACLE_SUBMISSIONS_RETENTION_ROUNDS` rounds (default 12,960).
- `telemetry_pings`: pruned daily, dropping rows older than
  `TELEMETRY_RETENTION_DAYS` (default 90), only when telemetry collection is
  enabled.

Both follow the same shape as the indexer's state-store pruning: best-effort,
keyed on an indexed column, and never allowed to crash the money-bearing
service. See [Hub Configuration](../hub/configuration.md) for these
variables.

## Sync transparency log

The sync service owns two tables that no other service prunes: `sync_meta`,
one row per block holding the three block hashes that form a Merkle leaf, and
`merkle_epochs`, one committed root per epoch. `sync_meta` grows one row per
block forever; `merkle_epochs` grows one row per `MERKLE_EPOCH_SIZE` blocks
and is small enough to keep indefinitely.

Retention here follows the same default-off shape. Setting
`SYNC_META_RETENTION_BLOCKS` to a positive value lets the sync service delete
`sync_meta` rows older than that window; unset or `0` keeps the full log,
which remains the shipped behavior.

| Variable | Default | Effect |
|---|---|---|
| `SYNC_META_RETENTION_BLOCKS` | unset (`0`) | A positive integer turns on `sync_meta` retention and sets the window in blocks. Unset or `0` means keep the whole log. |

Two properties make this safe to turn on:

- **Committed roots are never pruned.** Only the leaves go. The published
  root chain, and the `merkle_reorgs` audit trail that references it, survive
  for ranges whose leaves are gone.
- **The cut lands on a committed epoch boundary.** The delete boundary is the
  end block of a committed epoch that lies wholly outside the window, never an
  arbitrary height. A half-pruned epoch would let the proof endpoint rebuild
  that epoch's tree from the surviving subset and answer with a proof against
  a root that no longer matches the committed one, so the sweep refuses rather
  than cut through an epoch.

What is given up is exactly the inclusion proofs: a block whose `sync_meta`
row is pruned can no longer be served from
`/transparency/indexer/{chain}/{network}/proof/{block}`, which answers `404`
for it. Choose the window from the proof horizon the deployment intends to
honor, and leave retention off on any tier that advertises proofs over full
history.

## Decoder tables

The decoder retains full transaction history by design (it is the source the
indexer replays), so its core tables (`transactions`, `blocks`,
`transaction_outputs`) are **not** retention candidates. The one
bounded-by-policy table is `mempool_transactions`, which is already
reconciled against confirmed blocks. If a decoder deployment ever needs a
hard floor on decoded history below the indexer's start block, it should
follow the same default-off, indexed-column, best-effort deletion pattern
described above. No decoder pruning ships today.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
