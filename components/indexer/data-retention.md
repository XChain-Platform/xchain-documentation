<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-indexer/docs/DATA-RETENTION-POLICY.md (worktree) -->

# Indexer: Data Retention and Pruning

Several indexer tables grow without bound over time. This page documents the
platform's retention and pruning policy: which tables are unbounded, what the
indexer's built-in pruning scaffold does about the largest and most delicate
one (the light-client state store), and how the hub's own audit and marker
tables, the indexer's hub push queue, and the UTXO tracker's reorg-undo
records are kept in check.

Retention comes in three kinds, and it matters which one you are looking at:

- **Default-off history retention.** The indexer's state commitment store and
  the sync service's `sync_meta` log keep everything unless an operator sets a
  retention variable. Turning these on is an operator decision per node,
  because pruning them gives up proofs over the pruned range.
- **Default-on operational sweeps.** The hub's audit and at-most-once marker
  tables and the indexer's failed hub-push rows are swept on a bounded window
  out of the box. Each window has an environment variable to resize it, and
  most also accept `0` to disable the sweep and keep every row (the tables
  below say which).
- **Always-on deterministic pruning.** The decoder's `dispensers` purge and the
  UTXO tracker's undo window are keyed to block height and have no switch.

In every case pruning removes rows (LevelDB keys in the UTXO tracker) and
never issues `DROP`/`ALTER` or creates tables.

## The state commitment store

Two tables back the SPV light-client commitment (see
[Database](database.md) for their full schema):

- `state_tree_roots`: one row per block (`balances_root`, `stakes_root`,
  `contract_state_root`, `state_root`, `block_merkle_root`). Grows one row
  per block forever. `contract_state_root` is `NULL` on every row where the
  contract-state slot is not armed.
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
state-tree read a missing row as an empty subtree, and fork the committed
sub-root it belongs to (and so `state_root`) across the network.

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
retained row's `balances_root`, `stakes_root` and `contract_state_root`;
rows where `contract_state_root` is `NULL` add nothing for it). Every armed
slot of the state root's sub-tree list (`merkle.STATE_SUBTREES`) must be in
that union: a sub-root missing from it lets reclaim delete nodes the tree
still references, and the next incremental read treats them as an empty
subtree and silently commits a forked root. Arming a new slot therefore means
adding its column to the union too. This is the reclamation
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

All of these are off by default (retention unset, reclaim off); see
[Configuration](configuration.md) for the indexer's full environment variable
reference.

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

## Hub audit and marker tables

The hub sweeps its unbounded audit tables and its at-most-once publish marker
tables by default; recorded here so the platform's retention policy lives in
one place. [Hub Configuration](../hub/configuration.md) is the authority for
each variable and its exact default.

| Table | Variable | Default window | What is pruned |
|---|---|---|---|
| `oracle_submissions` | `ORACLE_SUBMISSIONS_RETENTION_ROUNDS` | 12,960 rounds | Raw price submissions, keyed on `round_number`. Diagnostic only: finalized values live in `price_snapshots`. `0` disables. |
| `telemetry_pings` | `TELEMETRY_RETENTION_DAYS` | 90 days | Rows older than the window, swept daily, and only when telemetry collection is enabled. `0` does not disable it (it falls back to 90); turn telemetry collection off instead. |
| `oracle_published_rounds` | `ORACLE_PUBLISHED_ROUNDS_RETENTION_ROUNDS` | 12,960 rounds (about 90 days) | Confirmed publish markers only. A marker whose on-chain state is unknown is a quarantine record an operator reconciles by hand, and is kept regardless of age. `0` disables. |
| `attest_published_requests` | `ATTEST_PUBLISHED_REQUESTS_RETENTION_MS` | 7,776,000,000 ms (about 90 days) | Confirmed publish markers with no armed intent. Intent-only rows are quarantine records and are kept regardless of age. `0` disables. |
| `anchor_published_checkpoints`, `anchor_published_archives` | `ANCHOR_MARKER_RETENTION_MS` | 7,776,000,000 ms (about 90 days) | Confirmed anchor broadcast markers only, with the cutoff floored at a multiple of `ANCHOR_INTENT_TTL_MS`. An intent-only row is the ambiguous-send record (the only durable trace that DOGE may already have paid) and is kept regardless of age. `0` disables. |

All of them follow the same shape as the indexer's state-store pruning:
best-effort, and never allowed to crash the money-bearing service.

The hub's anchored, federation-signed tables are not on this list and are
never pruned: `state_checkpoints`, `anchor_reward_attestations`,
`policy_snapshots` and `list_snapshots` are append-only records: a newer row
supersedes an older one, and no sweep deletes them. See
[Hub Database](../hub/database.md) for their schema.

## Indexer hub push queue

The indexer queues every push to the hub in `pending_hub_pushes` and retries
failed rows with backoff. A row that exhausts its attempts becomes terminal
and leaves the retry loop, so the queue sweeps terminal `failed` rows older
than a window; without the sweep a long hub outage would grow the table with
no ceiling. See [Configuration](configuration.md).

| Variable | Default | Effect |
|---|---|---|
| `HUB_PUSH_FAILED_RETENTION_SECONDS` | `604800` (7 days) | How long a terminal row is kept. `0` keeps terminal rows forever. |
| `HUB_PUSH_PRUNE_INTERVAL_MS` | `3600000` (1 hour) | How often the sweep runs. |

## UTXO tracker undo window

The UTXO tracker keeps reorg-undo records in LevelDB: the archived copies of
spent outputs and their hints (`K`/`M` keys), the creation-block and
block-to-script reverse indexes (`W`/`Z` keys), and the stored-block list
(`N` keys). Once a block falls out of the undo window, those records for it
are deleted, because a reorg can never reach that deep. The window is per
chain and per network, overridable with `XCHAIN_UNDO_BLOCKS_<COIN>`; a reorg
deeper than the window needs a full re-index. The first-seen index (`S` keys)
is never pruned, because it backs a live query. See
[UTXO Tracker Architecture](../utxo-tracker/architecture.md) for the key
schema and the window sizes.

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

Three properties make this safe to turn on:

- **Committed roots are never pruned.** Only the leaves go. The published
  root chain, and the `merkle_reorgs` audit trail that references it, survive
  for ranges whose leaves are gone.
- **The cut lands on a committed epoch boundary.** The delete boundary is the
  end block of a committed epoch that lies wholly outside the window, never an
  arbitrary height. A half-pruned epoch would let the proof endpoint rebuild
  that epoch's tree from the surviving subset and answer with a proof against
  a root that no longer matches the committed one, so the sweep refuses rather
  than cut through an epoch.
- **The window never drops below the reorg reach.** A window smaller than the
  deepest reorg the sync server follows (256 blocks, or 5022 on Litecoin
  testnet) is raised to that depth, with a warning in the log, so a reorg never
  lands in an epoch whose leaves are gone. If an epoch is ever reorged after its
  leaves were pruned anyway, the server leaves it uncommitted rather than
  publish a root over the surviving subset.

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
described above.

One decoder table is already bounded, and it is bounded differently from
everything else on this page. `dispensers` is pruned in two stages: an expiring
dispenser is **soft-expired** (its `expired_block_index` is stamped with the
expiring height rather than the row being deleted, so a reorg can clear the mark
and restore it), and the soft-expired row is **hard-deleted** later, once that
height is reorg-safe-deep. The purge runs every block at
`nextBlockHeight - DISPENSER_EXPIRE_SAFE_DEPTH` and outside the block
transaction, so a transient failure there can never roll back committed block
data. See [decoder database](../decoder/database.md#dispensers) for the schema
and the current safe depth.

Read that as a different class of retention from the knobs above, not another
instance of them. It is always on rather than default-off, there is no env var
to size or disable it, and its cutoff is a canonical block height rather than
wall-clock time or a row count, so every node prunes exactly the same rows at
exactly the same block. That determinism is what makes it safe to run against a
replicated table. It is also why `dispensers` is replicated by full snapshot and
periodic reconcile rather than by the per-block stream: neither the soft-expire
`UPDATE` nor the hard purge rides that stream, so streamed inserts alone would
let a follower's row count drift.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
