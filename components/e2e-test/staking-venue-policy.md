<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# E2E Test Suite: Staking Venue Policy

A fixture `STAKE` is not scratch state. It joins the **real** capability sets
the venue's hubs and indexers resolve quorum against, and it stays there until
something takes it back out.

Nothing did. On the shared BTC regtest venue the `oracle_publish` set grew from
18 members to 61 purely from fixture runs, one of them staked at 250000 XCHAIN,
and the operator hub's weight share fell from 69.9% to 9.1%. Checkpoint quorum
became permanently unreachable. No test ever failed while that happened: each
run passed, and the venue got a little more unusable.

## The policy

> **A fixture run leaves the capability set no larger than it found it.**

The one exception is a **dedicated staking venue**, which declares itself as
one (see below).

## How the suite carries it

Three mechanisms, all in `test/helpers/stakeTeardown.js`:

| Mechanism | What it does |
|---|---|
| Ledger | Every stake created through `test/helpers/stakeHelper` (`sendStakeV1`, `sendStakeV2`, `sendStakeV3`) is registered. Every **full** `UNSTAKE` deregisters it. A **partial** `UNSTAKE` does not: the residual is re-staked, so the pubkey is still a member. |
| Release | The root `afterAll` broadcasts one `UNSTAKE` per outstanding stake, from the source that owns it, then mines the settle blocks. Mining is part of the release: `UNSTAKE` only stamps `deactivation_block = block + ACTIVATION_DELAY_BLOCKS`, so a sweep that stops at broadcast changes nothing a capability read can see. |
| Check | The capability set is read at bootstrap and again after the release, through `getstakeweightsbycapability`, the same source-keyed view the epoch close resolves R(E) with. Any pubkey the run added and did not take back is named in the run's output. |

A stake that cannot be released is reported, not thrown: the sweep never masks
a suite's own results, and a transport hiccup never fails a run.

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `E2E_STAKE_TEARDOWN` | on | `off` / `0` / `false` / `no` turns off both the release and the check. This is how a **dedicated staking venue** declares itself. |
| `E2E_STAKE_TEARDOWN_STRICT` | unset | `1` makes a leak **fail the run**, after every test has reported. Use it in any lane that runs against a shared venue. |
| `E2E_STAKE_TEARDOWN_CAPABILITY` | `oracle_publish` | The capability whose set is measured. `oracle_publish` is the one that carries checkpoints and anchors, so it is the one that hurts first. |
| `E2E_STAKE_TEARDOWN_SETTLE_BLOCKS` | 14 | Blocks mined after the release: 6 activation delay + 6 canonical reorg buffer + 2 margin. |
| `E2E_STAKE_TEARDOWN_BUDGET_MS` | 600000 | Whole-sweep budget. A release that runs out says what it did not get to rather than hanging teardown. |

## Dedicated staking venues

A venue whose purpose is to **hold** a seeded federation must not have those
stakes swept at the end of the run that created them. Such a venue sets
`E2E_STAKE_TEARDOWN=off`, and the run says so in its output: off is a
declaration, not a default.

| Venue | Seeded by | Why it keeps its stakes |
|---|---|---|
| ROLLCALL acceptance federation (BTC regtest) | `npm run venue:seed-rollcall` | The four-source federation IS the venue. The acceptance suites drive it across many runs, and the sources' weights are the quorum arithmetic those suites assert. |

`npm run venue:seed-rollcall` sets `E2E_STAKE_TEARDOWN=off` itself. Note that
the acceptance suites run against that venue with teardown **on**: the ledger
only ever sweeps stakes the run itself created, so a run that re-stakes an
evicted validator gives that stake back and leaves the seeded federation
untouched.

## The gate

`npm run lint:stake-teardown` (`scripts/check-stake-teardown.js`, part of
`npm run ci`) fails on any hand-built `STAKE` payload under `test/` that
bypasses the ledger. Fix a site by staking through `stakeHelper`, by calling
`stakeTeardown.registerStake()` for the stake you broadcast, or, when the stake
can never become a capability member (an intentionally-rejected one), by saying
why:

```js
// stake-teardown-ok: rejected on the AMOUNT format guard.
let msg = 'STAKE|1|1000.123456789|' + freshPubkey()
```

The reason is a sentence rather than a pragma, because the distinction that
matters is a judgement: a rejected stake owes the venue nothing, while a valid
one that merely looks incidental is exactly the stake that accumulated 43
orphans.

## Related

- [Operations](operations.md): running the suite, CI integration, troubleshooting
- [Configuration](configuration.md): the full environment variable reference
- [Architecture](architecture.md): bootstrap sequence and root hooks

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**
