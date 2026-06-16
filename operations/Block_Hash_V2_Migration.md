<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Migration: Block-Hash Scheme v2 (resolved-string consensus hashes)

This is a **consensus-breaking** change to how the per-block `ledger_hash`, `actions_hash`,
and `contract_hash` are computed. Every validator must upgrade together and re-baseline its
state checkpoints from an agreed height. Read this before deploying the release that ships
`BLOCK_HASH_VERSION = 2`.

---

## What changed

The three per-block hashes are now computed from the **resolved canonical strings**:
address, ticker, action type, and status, instead of the raw `index_*` lookup-table
AUTO_INCREMENT ids (`address_id`, `tick_id`, `action_id`, `source_id`, `caller_id`,
`status_id`).

A version marker (`hash_version = 2`) is folded into every hash preimage, so v1 and v2 hashes
can never be compared as equal.

## Why

The `index_addresses` / `index_tickers` / `index_statuses` / `index_actions` lookup tables are
populated on first reference (`INSERT IGNORE`) and are **never rolled back** on a reorg, and
InnoDB `AUTO_INCREMENT` counters never rewind. So a node that processed a later-orphaned block
containing a *first-seen* address (routine on 1-minute Dogecoin blocks) keeps that lookup row,
and every value first referenced afterward is assigned an id one higher than on a node that
never saw the orphan. When those ids fed the consensus hashes, two honest nodes on the **same
canonical chain** computed **different** hashes from that point on; a permanent, unrecoverable
checkpoint-quorum break (a full-parse recovery node, which never sees orphans, could likewise
never match checkpoints signed by any tip-following node that once saw a shallow reorg).

Hashing the resolved strings removes the id from the preimage entirely, so the hashes depend
only on the canonical chain. See `xchain-indexer/src/db.js getBlockHashes()` and its byte-for-byte
conformance pair `xchain-sync/src/BlockHasher.js computeBlockHashes()`.

## Scope of code change

- `xchain-indexer`: `getBlockHashes()` now LEFT JOINs the lookup tables and hashes the resolved
  strings; ORDER BY pins an explicit binary collation (`utf8_bin` / `utf8mb4_bin`) so the row
  order is independent of each node's default collation.
- `xchain-sync`: `BlockHasher.js` mirrors the indexer query-for-query (the independent-recompute
  conformance pair) and carries the same `BLOCK_HASH_VERSION`.
- The lookup tables remain append-only and are still not rolled back on reorg, now provably safe,
  because their ids no longer feed any consensus value.

## Operator migration steps

1. **Coordinate.** Agree on a re-baseline height `H` (a finalized, well-confirmed block) with the
   rest of the federation. All validators must cut over at the same height.
2. **Upgrade every validator** to the `BLOCK_HASH_VERSION = 2` release. A partial fleet upgrade
   will (correctly) fail checkpoint quorum between v1 and v2 nodes; that is the version marker
   doing its job, not a regression.
3. **Re-baseline checkpoints from `H`.** Re-sign the per-chain `ledger/actions/contract`
   checkpoints under the v2 scheme. **Do not** attempt to migrate or re-interpret historical v1
   checkpoint rows; they stay on the v1 scheme and are simply superseded from `H` forward.
4. **Already-anchored checkpoints stay on v1.** Any checkpoints already committed on-chain via
   `ANCHOR` encode v1 (id-dependent) hashes; they are not rewritten. Light-client verification of
   pre-`H` history must use the v1 verifier; post-`H` verification uses v2.
5. **Verify convergence.** After cutover, confirm that a reorg-exposed node, a never-exposed node,
   and a `recovery.js` full-parse node all recompute identical hashes for the same canonical
   blocks. The `xchain-e2e-test` consensus-hash conformance scenario is the live drift guard.

## Rollback

If the cutover must be aborted, revert the whole federation to the v1 release together. Mixed v1/v2
operation is not supported; the schemes are intentionally non-interoperable.
