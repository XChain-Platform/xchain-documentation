<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - VOTE
Token-weighted governance polls in four version-discriminated phases: v0 (create a poll), v1 (cast a ballot), v2 (system-injected finalization), and v3 (set or clear a standing delegation). A poll is governed and decided by holders of one token (`TICK`), which is both the electorate and the weight basis. Weight is never read from the payload; it is always measured from on-chain holdings at the poll's effective close, so the result is a pure deterministic function of already-agreed state and needs no validator consensus round.

## PARAMS
| Name               | Type    | Description                                                                                          |
| ------------------ | ------- | ---------------------------------------------------------------------------------------------------- |
| `VERSION`          | Integer | Format version (0=create, 1=ballot, 2=finalize, 3=delegate)                                          |
| `TICK`             | String  | Governance token: the electorate and weight basis; v0 and v3                                         |
| `END_BLOCK`        | Integer | Last block at which ballots are accepted (must be a future block); v0 only                           |
| `OPTIONS`          | String  | Comma-delimited option labels, at least two; index-addressed by ballots; v0 only                    |
| `MAX_SELECTIONS`   | Integer | (optional, default 1) Max distinct options one ballot may list; v0 only                             |
| `TALLY_MODE`       | String  | (optional, default `approval`) `approval` or `split`; v0 only                                       |
| `WEIGHT_MODE`      | String  | (optional, default `balance`) `balance`, `flat`, `quadratic`, or `time_weighted`; v0 only           |
| `QUORUM`           | String  | (optional) Min fraction of close supply the counted weight must reach, `0 < q <= 1`; v0 only        |
| `MIN_VOTERS`       | Integer | (optional) Min distinct qualifying voters for the poll to pass; v0 only                              |
| `MIN_VOTE_BALANCE` | String  | (optional) Dust floor: a voter counts toward `MIN_VOTERS` only if close balance >= this; v0 only     |
| `DECIDE_THRESHOLD` | String  | (optional) Early-decide arm: fraction of supply an option must reach to close the poll early; v0 only |
| `QUESTION`         | String  | (optional) Inline question text or a FILE reference; v0 only                                         |
| `DEPOSIT`          | String  | (optional, default 0) GAS the creator escrows at creation; refunded or forfeited at finalize; v0 only |
| `CALLBACK_CONTRACT`| Integer | (optional) Contract (its deploy `action_index`) whose method finalization calls; v0 only             |
| `CALLBACK_METHOD`  | String  | (optional) Method on `CALLBACK_CONTRACT` to invoke at finalize; required when a callback contract is set; v0 only |
| `CALLBACK_PARAMS`  | String  | (optional) JSON array of extra positional args appended after the poll result; v0 only              |
| `CALLBACK_ON`      | String  | (optional, default `pass`) Fire the callback `pass` (only a finalized win) or `always`; v0 only      |
| `GAS_ESCROW`       | String  | (optional, default 0) GAS the creator escrows to fund the callback's execution; v0 only             |
| `CALLBACK_DELAY_BLOCKS` | Integer | (optional, default 0) Timelock: blocks between finalization and the callback firing; honored from the `VOTE_CALLBACK_TIMELOCK` flag-day; v0 only |
| `POLL_REF`         | Integer | The poll's id (the `action_index` of its creating v0); v1 and v2                                     |
| `BALLOT`           | String  | Comma-delimited `OPTION` or `OPTION:SHARE` entries; v1 only                                          |
| `MEMO`             | String  | (optional) Bounded free text; v1 and v3                                                              |
| `DELEGATE_TO`      | String  | Address to delegate `TICK` voting weight to; blank clears a standing delegation; v3 only             |

## Formats

### Version `0` - Create poll
- `VOTE|0|TICK|END_BLOCK|OPTIONS|MAX_SELECTIONS|TALLY_MODE|WEIGHT_MODE|QUORUM|MIN_VOTERS|MIN_VOTE_BALANCE|DECIDE_THRESHOLD|QUESTION|DEPOSIT|CALLBACK_CONTRACT|CALLBACK_METHOD|CALLBACK_PARAMS|CALLBACK_ON|GAS_ESCROW|CALLBACK_DELAY_BLOCKS`

Optional fields may be left empty. The poll's identity is its own `action_index`; there is no caller-supplied id, matching how every other protocol object is keyed by its source action. The six trailing fields make the poll *binding* (see Binding polls); leave them empty for an advisory poll.

### Version `1` - Cast ballot
- `VOTE|1|POLL_REF|BALLOT|MEMO`

A later valid ballot from the same voter replaces that voter's earlier one (last-write-wins). An invalid ballot is a no-op and leaves any prior valid ballot intact. Storage is append-only: each ballot is recorded as its own set of rows and the tally counts only each voter's latest set, so a chain reorganization that removes a replacing ballot automatically restores the voter's earlier one.

### Version `2` - Finalize (system-synthesized; never user-broadcast)
- `VOTE|2|POLL_REF`

### Version `3` - Set or clear delegation
- `VOTE|3|TICK|DELEGATE_TO|MEMO`

A blank `DELEGATE_TO` clears the standing delegation. Delegation cannot target the delegator itself.

## Examples
```
VOTE|0|GOVTOKEN|850000|YES,NO|1|approval|balance|0.2|10|100|||
Token-weighted poll, single-choice, balance weighting, 20% quorum, needs 10 voters
who each hold at least 100 GOVTOKEN, no early-decide, no question, no deposit
```

```
VOTE|0|GOVTOKEN|850000|ALICE,BOB,CAROL|2|split|quadratic|||50|0.5|Pick two council seats|100
Multi-select (2) split-weight quadratic poll with a 50-token dust floor, an early-decide
arm at 50% of supply, an inline question, and a 100 XCHAIN creation deposit
```

```
VOTE|0|GOVTOKEN|850000|YES,NO|1|approval|balance|0.2|10|100|||0|42|releaseFunds|[1000]|pass|5000
Binding poll: on a finalized YES/NO win, finalization calls contract 42's
releaseFunds method with the poll result plus an extra arg 1000; 5000 XCHAIN gas
escrow funds the callback, no creator deposit
```

```
VOTE|1|301|1|
Cast a single-choice ballot for option index 1 (NO) on poll 301
```

```
VOTE|1|307|0:60,2:40|funding split
Split ballot: 60% of weight to option 0, 40% to option 2, with a memo
```

```
VOTE|3|GOVTOKEN|mAlicesAddress...|
Delegate all GOVTOKEN voting weight to Alice across every GOVTOKEN poll
```

```
VOTE|3|GOVTOKEN||
Clear a standing GOVTOKEN delegation
```

## Rules

### Version 0 (create poll)
- `TICK` must be a real, issued token.
- The creator (`SOURCE`) must hold a non-zero balance of `TICK` at creation (anti-spam; an address with no stake cannot fake a governance poll).
- `END_BLOCK` must be greater than the creation block.
- `OPTIONS` must split into at least two non-empty labels.
- `MAX_SELECTIONS` must be a positive integer no larger than the option count.
- `TALLY_MODE` must be `approval` or `split`.
- `WEIGHT_MODE` must be `balance`, `flat`, `quadratic`, or `time_weighted` (`stake` is reserved for a later phase).
- `quadratic` weighting **requires** `MIN_VOTE_BALANCE > 0`; without a per-voter floor a holder could split across addresses to inflate total quadratic weight (`sqrt(a)+sqrt(b) > sqrt(a+b)`). This makes it sybil-resistant, not sybil-proof.
- `QUORUM`, when present, must be a fraction `0 < q <= 1`.
- `MIN_VOTERS`, when present, must be a non-negative integer.
- `MIN_VOTE_BALANCE`, when present, must be a non-negative amount.
- `DECIDE_THRESHOLD`, when present, must be a fraction `0 < d <= 1`.
- `QUESTION`, when present, is bounded by `MAX_MESSAGE_LENGTH`.

#### Deposit fields (v0, optional)
- `DEPOSIT` defaults to 0. When present it must be a non-negative amount and at least `POLL_DEPOSIT_MIN` (a deployment-level floor, 0 by default).
- `DEPOSIT > 0` requires `SOURCE` to hold that amount of the GAS tick (XCHAIN), read at the create action's `(block, action)` for cross-validator determinism; insufficient balance produces `invalid: insufficient funds (DEPOSIT)`.
- A valid `DEPOSIT > 0` debits `SOURCE` and writes an escrow row at the v0 `action_index`, released at finalization (see Deposit flow).

#### Callback fields (v0, optional; make the poll binding)
- Leaving `CALLBACK_CONTRACT` empty makes the poll advisory; the other four callback fields are then ignored.
- `CALLBACK_CONTRACT`, when set, must reference an existing deployed contract by its deploy `action_index`.
- `CALLBACK_METHOD` is required whenever `CALLBACK_CONTRACT` is set, and is bounded to 64 characters.
- At/after the `VOTE_BINDING_MINIMUMS` flag-day a binding poll must also set `QUORUM` and `MIN_VOTERS >= 1`; a v0 that omits either is invalid. Advisory polls are unaffected. The magnitudes remain the creator's policy call, but a callback that can move contract-held value can no longer finalize with no turnout floor at all (see Parameterizing binding polls).
- `CALLBACK_ON` must be `pass` or `always` (default `pass`). `pass` fires only when the poll reaches `finalized` with a winner; `always` fires on `finalized` and `failed_quorum` alike.
- `CALLBACK_PARAMS`, when set, must parse as a JSON array; its elements are appended as extra positional arguments after the standard poll-result arguments.
- `GAS_ESCROW` defaults to 0 and must be a non-negative amount. It and `DEPOSIT` are escrowed together (`DEPOSIT + GAS_ESCROW`), and the combined funding check requires `SOURCE` to hold the sum of the GAS tick at creation.
- `CALLBACK_DELAY_BLOCKS` (from the `VOTE_CALLBACK_TIMELOCK` flag-day) must be a non-negative integer when set. A value above 0 timelocks the callback: finalization freezes the tally and settles the deposit as always, but the callback EXECUTE fires `CALLBACK_DELAY_BLOCKS` blocks later (see Binding polls). Before the flag-day the field is ignored, matching nodes that predate it.

### Version 1 (cast ballot)
- `POLL_REF` must reference an existing poll.
- The ballot must arrive while `cast_block <= END_BLOCK`; a later ballot is `invalid: poll closed`.
- Hold-to-vote gate (cast time): the voter must hold `TICK` now, or the ballot is invalid.
- `BALLOT` must list between one and `MAX_SELECTIONS` entries, every option index in range and distinct.
- In `split` mode each entry needs a positive `SHARE`; in `approval` mode the share is ignored (stored as `1`).
- `MEMO`, when present, is bounded by `MAX_MESSAGE_LENGTH`.

### Version 2 (finalize)
- Never user-broadcast: `VALID_ACTION_NAMES` accepts `VOTE` for the decoder's v0/v1/v3 paths, but a v2 in a user transaction is rejected.
- The per-block sweep synthesizes one v2 per poll reaching its effective close. It is a no-op if the poll is not `open` (a poll finalized by an earlier trigger in the same block is skipped).
- A synthesized v2 is allocated a real `action_index` so its `poll_results` rows and mappings have a deterministic, rollback-correct source.

### Version 3 (set or clear delegation)
- `TICK` must be a real, issued token.
- `DELEGATE_TO` blank clears a standing delegation; when set it cannot equal `SOURCE`.
- `MEMO`, when present, is bounded by `MAX_MESSAGE_LENGTH`.
- The latest valid v3 per `(TICK, delegator)` wins (last-write-wins); rows are an append-only event log.

## Tally modes
- **approval:** each listed option receives the voter's full weight.
- **split:** the voter's weight is divided across listed options in proportion to their `SHARE` values (relative, not absolute; `60,40` and `3,2` are identical).

## Weight modes
- **balance:** weight = the voter's `TICK` balance at the effective close block.
- **flat:** one address, one vote (weight 1 per qualifying voter), regardless of holdings.
- **quadratic:** weight = `sqrt(close_balance)`, truncated to 18 decimal places. Truncation (not rounding) is consensus-critical because the square root is irrational. Flattens large holders (a 100x balance becomes 10x weight). Requires `MIN_VOTE_BALANCE` (see Rules).
- **time_weighted:** weight = the voter's average `TICK` balance over `[creation_block, close]`, computed from a credits/debits ledger integral (not a per-block scan). Same-block ledger events are zero-length segments, so intra-block order never affects the result. Resists flash-acquisition (buy-at-close) voting.

## Vote delegation (v3)
A standing, per-token delegation of voting weight to another address, resolved independently at each poll's close:
- **One hop only.** A delegates to B, B delegates to C does not flow A's weight to C.
- **A direct vote overrides delegation.** If the delegator casts their own ballot, their weight stays with that ballot.
- **The delegate must vote** for the delegated weight to count; an idle delegate carries nothing.
- **Hold-to-count** applies to the delegator's close balance, same as a direct ballot.
- Delegators add weight but not headcount: `MIN_VOTERS` counts direct voters only.

## Gates and outcome
At the effective close the poll is frozen with one of:
- **finalized:** a winner is the option with the highest counted weight (lowest option index breaks ties), provided the participation gates pass.
- **failed_quorum:** the poll terminates with no winner because `QUORUM` (counted weight / close supply) and/or `MIN_VOTERS` (distinct qualifying voters, each meeting `MIN_VOTE_BALANCE`) were not met. `fail_reason` records `quorum`, `min_voters`, or `both`.

A poll closes at the earlier of two triggers:
- **time:** `END_BLOCK` is reached.
- **early-decide:** an option's weight crosses `DECIDE_THRESHOLD` of supply before `END_BLOCK`, subject to the same validity gates. The finalized row carries `decided_early=1` and an `effective_close_block` below `END_BLOCK`.

## Binding polls
A poll is *binding* when its v0 sets `CALLBACK_CONTRACT`: finalization then calls a contract method with the result, turning a decided poll into an on-chain effect (treasury release, parameter change, contract state update). An advisory poll just freezes its tally.

- **When it fires.** At v2, after the tally is frozen and the deposit settled, the callback fires if `CALLBACK_ON` permits the outcome: `pass` only on a `finalized` win, `always` on `finalized` or `failed_quorum`. A poll that does not meet its gate under `pass` never calls the contract.
- **Timelock.** A poll created with `CALLBACK_DELAY_BLOCKS > 0` defers the firing: the v2 stamps a due block (`finalize block + delay`) and the per-block sweep injects the callback EXECUTE there, reconstructing the frozen result from the terminal poll row. Everything else about finalization (tally freeze, deposit settlement, escrow release) still happens at the v2. The delay is the holders' and guardians' reaction window between a hostile pass and value moving; a callback contract can use it to honor a veto armed in the interim.
- **How it runs.** The callback is a system-synthesized EXECUTE injected in the same block as the v2, mirroring ATTEST's callback. Its `SOURCE` is the callback contract itself (`C:<chain>:<contract_action_index>`), it is marked as an emission, and gas is bounded by `GAS_CEILING`. The injected EXECUTE's `action_index` is recorded on the poll (`callback_execute_action_index`).
- **What the method receives.** The poll result is delivered as positional arguments the contract reads with `xchain.getInputParam`: poll id, status, winning option, total counted weight, total voters, quorum-met flag, min-voters-met flag, then any `CALLBACK_PARAMS` elements. The result is passed in rather than read via `xchain.getPollResult` because the callback runs in the poll's own finalization block, before the poll is visible to the result accessor (which only exposes polls resolved in an earlier block).
- **Isolation.** The callback runs inside a savepoint. If it throws, only the callback is rolled back; the poll stays terminal with its frozen tally and settled deposit. A binding callback never un-decides a poll.
- **Funding.** `GAS_ESCROW` funds the callback's execution and is escrowed alongside `DEPOSIT` at creation; both are released at finalize (see Deposit and callback flow).

### Parameterizing binding polls
The 2026-07 BonkDAO drain is the canonical failure: an attacker bought ~1% of supply for $4.4M, proposed a $20M treasury transfer, and passed it with 7 voters out of 18,000+ holders because quorum was reachable for far less than the value at stake. Nothing was exploited; the governance executed exactly as parameterized. When a poll's callback can move value:

- **Cost of capture must exceed value at stake.** Set `QUORUM` so that acquiring decisive weight costs more than the callback can move, and keep it true through the voting window.
- Protocol floor: from the `VOTE_BINDING_MINIMUMS` flag-day, `QUORUM` and `MIN_VOTERS >= 1` are mandatory on binding polls. Treat them as the floor, not the target.
- Prefer `WEIGHT_MODE=time_weighted` for treasury votes (windowed holdings defeat buy-then-vote), or `quadratic` with a meaningful `MIN_VOTE_BALANCE` to blunt single-whale capture.
- Set `CALLBACK_DELAY_BLOCKS` (from the `VOTE_CALLBACK_TIMELOCK` flag-day) so the callback fires N blocks after finalization instead of in the same block, giving holders a reaction window. Pair it with a guardian veto in the callback contract for defense in depth: the delay creates the window, the contract decides what a veto means.
- Without the protocol timelock, prefer a timelocked executor: have the callback arm a pending action that a second step executes after N blocks, with a guardian veto, rather than moving value in the finalization block itself.

## Contracts as poll actors
A deployed contract can take part in governance as itself, not just react to it, by emitting VOTE from contract code:

- `xchain.emit.vote({ version: 0, tick, endBlock, options, ... })` creates a poll whose `SOURCE` is the contract.
- `xchain.emit.vote({ version: 1, pollRef, ballot })` casts a ballot as the contract.
- Only v0 (create) and v1 (ballot) are contract-emittable; v2 (finalize) is system-only and v3 (delegation) is not exposed to contracts. The emit choke point rejects any other version.
- Because the contract is the `SOURCE`, every stake gate applies to the contract's own custody balance: hold-to-create for v0, hold-to-vote for v1, and any `DEPOSIT` / `GAS_ESCROW` are drawn from the contract. Fund the contract (for example via `DEPOSIT` into its custody) before it creates or votes.
- Emitted ballots are ordinary v1 actions: last-write-wins, hold-to-count at close, and fully tallied like any holder's ballot.

## Lifecycle
1. A holder broadcasts VOTE v0; the indexer stores the poll definition in `polls` keyed by the v0 `action_index`, escrowing any `DEPOSIT` and `GAS_ESCROW`.
2. Holders broadcast VOTE v1 ballots while `cast_block <= END_BLOCK`; each valid ballot is stored in `votes` as an append-only set (the voter's latest set is their standing ballot; earlier sets stay recorded for reorg safety). Optional VOTE v3 delegations are recorded in `vote_delegations`.
3. The per-block sweep detects polls at their effective close (time trigger, or an early-decide crossing) and synthesizes VOTE v2.
4. v2 computes the tally from the `votes` ledger and on-chain holdings at the close block (weight mode, delegation, and gates all applied at read time), writes one `poll_results` row per option, freezes the summary on the `polls` row, releases any deposit, and (for a binding poll whose `CALLBACK_ON` gate is met) injects the callback EXECUTE.

## Effects on v0 (create)
- Inserts a `polls` row (idempotent on the v0 `action_index`): options, close, tally/weight modes, gates, question, deposit, and callback fields. Finalization columns (and `callback_execute_action_index`) stay null until v2.
- An invalid create writes no `polls` row; the action itself is still recorded in `actions` with its status.

## Effects on v1 (ballot)
- Records the voter's new standing ballot in `votes` (choice plus, in split mode, relative shares); earlier ballots stay recorded and simply stop being the latest.

## Effects on v2 (finalize)
- Allocates a new `action_index` (the synthetic event is replay-deterministic and rollback-correct).
- Writes one `poll_results` row per option (`total_weight`, `voter_count`) and freezes the `polls` summary (`poll_status`, `winning_option`, `total_weight`, `total_voters`, `quorum_met`, `min_voters_met`, `fail_reason`, `decided_early`, `effective_close_block`, `finalized_action_index`, `resolved_block`).
- Releases any creation deposit and gas escrow (see Deposit and callback flow).
- For a binding poll whose `CALLBACK_ON` gate is met, injects the callback EXECUTE and records its `action_index` in `callback_execute_action_index`.

## Effects on v3 (delegate)
- Appends a `vote_delegations` event row (a null delegate marks a clear). Nothing is mutated in place; resolution happens at each poll's close.

## Deposit and callback flow
When a v0 carries `DEPOSIT > 0` and/or `GAS_ESCROW > 0`, the combined GAS is escrowed from the creator at creation and disposed of when the poll finalizes. All movements are GAS-denominated (XCHAIN). The `DEPOSIT` is refunded or forfeited by outcome; the `GAS_ESCROW` always returns to the creator (it funds the callback's execution, which is gas-metered separately).

| Event | Movement |
| ----- | -------- |
| v0 valid, `DEPOSIT + GAS_ESCROW > 0` | Debit creator and write one combined escrow row (at the v0 `action_index`). |
| v2 to `finalized` | Release escrow; refund `DEPOSIT` and `GAS_ESCROW` to the creator. `polls.deposit_resolved='refunded'`. |
| v2 to `failed_quorum` | Release escrow; credit `DEPOSIT` to the `DONATE1` treasury and refund `GAS_ESCROW` to the creator. `polls.deposit_resolved='forfeited'`. |

`deposit_resolved` guards against a double-release if the v2 is reprocessed. A reorg that rolls back a finalization deletes the release ledger rows generically (credits/escrows by `action_index`) and re-opens the poll, which also re-nulls `deposit_resolved` and `callback_execute_action_index`, so the re-synthesized v2 re-releases and re-fires correctly. The original v0 escrow row survives the reorg.

## Determinism notes
- All amount and weight math uses fixed-precision bignumber arithmetic. Quadratic weight truncates `sqrt` to 18 dp; the `time_weighted` integral treats same-block events as zero-length segments. Both choices make the tally identical across every node with no dependence on intra-block ordering.
- Weight, electorate, gates, and delegation are all evaluated at the effective close from already-agreed on-chain state, so finalization carries no validator signatures and needs no consensus round (contrast ATTEST v1).

## Notes
- `POLL_REF` is the cross-version foreign key: every v1 and v2 references an existing v0 by its `action_index`.
- Storage: `polls` (definitions plus the frozen finalization summary and callback fields), `votes` (append-only ballot sets; the voter's latest set is their standing ballot), `poll_results` (per-option frozen tallies), `vote_delegations` (append-only delegation events).
- Binding polls deliver the result to the callback by value (positional `getInputParam` args), so the callback is independent of the `getPollResult` visibility rule that hides a poll until a later block.
- `stake` weighting is reserved for a later phase and is not part of the current wire format.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
