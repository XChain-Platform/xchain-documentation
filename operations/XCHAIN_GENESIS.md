<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XCHAIN Genesis & Reward-Pool Funding

This runbook describes the **one-time** creation of the XCHAIN gas token as a fixed,
hard-capped, never-again-mintable supply, and how to seed and maintain the validator
**reward pool**. XCHAIN exists on the **BTC chain only**.

> **Irreversible.** The lock flags below can never be undone (`db.js` retains any lock once
> set). Mint the full supply and verify on testnet/regtest before doing this on mainnet.

## Monetary model (why)

- **Fixed supply.** The entire XCHAIN supply is minted once, at genesis, then locked. No further
  XCHAIN can ever be created. Not even by the issuing address. Supply only decreases (via the
  fee **burn** bucket).
- **Rewards are paid, not minted.** Validator rewards are paid by **debiting a pre-funded reward
  pool address** (`config['ADDRESS']['REWARD']`) and crediting the validator. See
  [COLLECT](../protocol/actions/COLLECT.md) and [GAS](../concepts/GAS.md).
- **Manual top-ups.** The pool is a finite balance; the operator refills it with ordinary XCHAIN
  `SEND`s. If it runs dry, `COLLECT` returns `invalid: insufficient reward pool` and validators
  retry after a top-up. No rewards are lost.

## Prerequisites

1. **GAS address private key.** The genesis `ISSUE` must be broadcast from
   `config['ADDRESS']['GAS']`; the indexer only allows the GAS address to issue the XCHAIN tick
   (`xchain-indexer/src/actions/issue.js`). Guard this key like a treasury key.
2. **REWARD pool address** generated and set in `config['ADDRESS']['REWARD']` (BTC, all networks).
3. **Decide three numbers** ahead of time:
   - `MAX_SUPPLY`: the total, permanent XCHAIN supply.
   - the **reward-pool allocation**, how much of that supply seeds validator rewards.
   - the **market/treasury allocation**; the remainder.

## Step 1: Genesis ISSUE (locked, fixed supply)

Broadcast a single `ISSUE` **from the GAS address** with the full supply minted and the mint/cap
locks set. Version `0` wire layout:

```
ISSUE|0|XCHAIN|<MAX_SUPPLY>|0|<DECIMALS>|<DESCRIPTION>|<MAX_SUPPLY>|<TRANSFER>|<DIST_ADDRESS>|1|0|0|0|0|||||||||1|0|
```

Field-by-field (only the genesis-relevant fields shown):

| Field | Value | Why |
|---|---|---|
| `TICK` | `XCHAIN` | The reserved gas tick |
| `MAX_SUPPLY` | total supply | Permanent cap |
| `MINT_SUPPLY` | **= `MAX_SUPPLY`** | Mint the entire supply now (nothing left to mint later) |
| `DECIMALS` | e.g. `8` | Fixed at issuance; cannot change after supply exists |
| `TRANSFER` | owner address (optional) | Who owns the XCHAIN token record afterward |
| `TRANSFER_SUPPLY` | distribution address | Where the minted supply lands |
| `LOCK_MAX_SUPPLY` | `1` | Cap can never be raised |
| `LOCK_MINT` | `1` | The `MINT` command is permanently disabled |

`MAX_MINT` is `0`/irrelevant because `LOCK_MINT=1` disables minting entirely. `LOCK_MINT_SUPPLY=1`
is optional belt-and-suspenders (blocks topping up supply via a future `ISSUE`).

After this confirms and indexes, XCHAIN is immutable: any later `MINT` fails `invalid: LOCK_MINT`,
and any `ISSUE` raising `MAX_SUPPLY` fails `invalid: MAX_SUPPLY (locked)`.

## Step 2: Distribute supply & seed the reward pool

The genesis `ISSUE` placed the entire supply at the distribution address. From there, allocate it
with ordinary `SEND`s:

1. **Seed the reward pool:** `SEND` the reward-pool allocation of XCHAIN to
   `config['ADDRESS']['REWARD']`.
2. **Market / treasury:** distribute the remainder per your launch plan (exchange/market-making,
   treasury, etc.).

The reward-pool address is keyed (operator-controlled), but its key is **not** needed for normal
operation: `COLLECT` drains it purely through protocol ledger accounting. The key only matters if
you ever need to move funds *out* of the pool manually.

## Step 3: Ongoing top-ups

Refill the pool at any time by sending XCHAIN to the reward-pool address (treasury → pool). No
special action type; a plain `SEND`. The next `COLLECT` immediately sees the higher balance.

## Verification

1. **Locks set**: query the indexer `tokens` table for `tick='XCHAIN'`: expect
   `lock_mint=1`, `lock_max_supply=1`, and `supply = max_supply`.
2. **No further minting**: attempt a `MINT` of XCHAIN → `invalid: LOCK_MINT`; attempt an `ISSUE`
   raising `MAX_SUPPLY` → `invalid: MAX_SUPPLY (locked)`.
3. **Pool funded**; the reward-pool address balance equals the seed allocation.
4. **Reward lifecycle** (regtest e2e): stake → accrue a reward → `COLLECT` (pool drops by the
   reward, validator rises by the same, total supply unchanged) → drain pool → `COLLECT`
   (`invalid: insufficient reward pool`) → top up → `COLLECT` (succeeds).

## Monitoring

The reward pool is finite between top-ups. Its drain rate is governed by the hub reward schedule
(`ORACLE_REWARD_PER_ROUND` and the per-capability reward types in
`xchain-indexer/src/api.js:pushvalidatorrewards`). **Watch the reward-pool balance** and top up
before it depletes; otherwise validators see `COLLECT` rejections (they retry later, but rewards
stall). A balance threshold alert/monitor is recommended.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.
