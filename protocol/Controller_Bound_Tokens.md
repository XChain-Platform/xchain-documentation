# Controller-Bound Tokens

A token (`TICK`) may bind itself to a deployed VM contract — its **controller**.
Once bound, the indexer invokes the controller's `guard` method **before** a
guarded native action on that token settles, inside the same atomic scope. The
guard is a fully programmable contract method: it may read/write its own
contract state and emit token actions (e.g. split a royalty out of sale
proceeds), and it may `revert` to **deny** the action.

Because the indexer is the only settlement path on XChain, a controller makes a
token's rules **unavoidable** — the enforced-royalty property that
marketplace-goodwill royalties on other chains never achieved. The token stays
natively held and natively tradeable; the controller only gates the actions that
move or sell it.

The feature is **opt-in and isolated**: a token with no `CONTROLLER` behaves
exactly as before (one NULL check, zero overhead). Binding is via the
[`ISSUE`](actions/ISSUE.md) action.

## Binding (ISSUE)

| Field | Meaning |
|---|---|
| `CONTROLLER` | `ACTION_INDEX` of a deployed, active contract on the same chain. NULL/absent = uncontrolled. |
| `LOCK_CONTROLLER` | `1` makes the binding permanent — `CONTROLLER` can never be changed or cleared (holders can trust the rules are fixed). Follows the existing `LOCK_*` semantics: can only be set, never unset. |

- Only the token owner can set or change `CONTROLLER` (standard `ISSUE` owner gate).
- At bind time the indexer verifies `CONTROLLER` resolves to an existing contract
  in `valid` (active) state — mirroring the contract check in `EXECUTE`.
- `CONTROLLER` is a same-chain contract: it is identified by a local
  `contracts.action_index`, and its derived address is `C:<CHAIN>:<CONTROLLER>`.
- Edit a binding via `ISSUE` version `0` (full) or version `6`
  (`VERSION|TICK|CONTROLLER|LOCK_CONTROLLER|MEMO`). `LOCK_CONTROLLER` may also be
  set via the version `3` lock-params edit.

## The guard ABI

The controller contract **must export a method named `guard`**. The indexer calls
it with positional, all-string input params (read via `xchain.getInputParam(i)`):

| i | Param | Notes |
|---|---|---|
| 0 | `action_type` | `SEND`, `ORDER_CREATE`, `ORDER_MATCH`, `SWAP_CREATE`, `SWAP_MATCH`, `DISPENSER_CREATE`, `DISPENSE` |
| 1 | `from` | the address giving up / sending the token (`''` if n/a) |
| 2 | `to` | the address receiving the token (`''` if n/a) |
| 3 | `tick` | the controlled token |
| 4 | `amount` | token amount moving (or order/dispenser quantity) |
| 5 | `price` | proceeds amount for a sale (`''` for a plain `SEND`) |
| 6 | `proceeds_tick` | proceeds tick for a sale (`''` for a plain `SEND`) |

Decision semantics:

- **Return normally ⇒ ALLOW.** The guard's state changes and emitted actions are
  committed atomically with the native action.
- **`revert(reason)` / out-of-gas / runtime error / missing `guard` method ⇒ DENY**
  (fail-closed). The native action is marked `invalid: controller (<reason>)` and
  everything the guard did is rolled back.
- The guard runs with full VM powers **except** the asynchronous frameworks:
  `xchain.attestation.request(...)` and `xchain.emit.crossExecute(...)` throw in
  guard mode (their results would arrive blocks later, after the guarded action
  already settled). Enforced at VM emit time (`isGuard`) and re-checked
  host-side. A guard also may not emit `SLASH`.

`xchain.getSourceAddress()` inside the guard is the address that triggered the
guarded action; `xchain.getContractAddress()` is the controller's own derived
address (which sources any actions the guard emits).

## Gas

Running the guard costs VM gas, billed to the action's `SOURCE` in `XCHAIN` at
`fee = gasBilled × GAS_PRICE`:

- The guard runs against a bounded ceiling, `GAS_SCHEDULE.VM_GUARD_GAS_CEILING`
  (default 200,000).
- `SOURCE` must hold the **full ceiling fee** as a reservation before the guard
  runs (mirrors the cross-contract-call gas reservation); insufficient `XCHAIN`
  rejects the action before any VM work. The actual metered fee (≤ reservation)
  is what's charged.
- **v1 charges guard gas on ALLOW only.** A denied action records no ledger
  change (preserving the ledger/balance invariant). The denial-spam vector is
  bounded by the real on-chain transaction cost of each attempt; charge-on-deny
  is a possible later refinement.
- Uncontrolled tokens pay nothing — there is no guard call.

## Reentrancy & determinism

- The guard runs as an ordinary deterministic VM execution, so every validator
  produces the identical decision and side effects.
- A guard whose `emit.send` moves **another** controlled token triggers that
  token's guard one level deeper. Guard depth is capped by `VM_MAX_CALL_DEPTH`
  (4); exceeding it denies the originating action. This reuses the existing
  cross-contract call-depth machinery.
- Guard state changes + emissions are wrapped in a dedicated DB savepoint
  (`controller_guard_<actionIndex>_<controller>_<seq>`); any emission failure
  rolls the whole guard back and denies — the same atomicity model as `EXECUTE`.

## Worked example — enforced NFT royalty

A complete, runnable royalty controller lives at
[`xchain-vm/test/e2e/contracts/royalty_controller.js`](../../xchain-vm/test/e2e/contracts/royalty_controller.js).
It taxes **sales only** — a fixed basis-points cut out of the proceeds, creator
gets the cut, seller gets the rest — and lets gifts, wallet moves, and listings
through free. The full `guard` method:

```javascript
// guard(action_type, from, to, tick, amount, price, proceeds_tick)
guard: function(xchain) {
    var actionType   = xchain.getInputParam(0);
    var from         = xchain.getInputParam(1); // seller
    var price        = xchain.getInputParam(5); // proceeds amount ('' if not a sale)
    var proceedsTick = xchain.getInputParam(6); // proceeds tick ('' if not a sale)

    // Tax sales only; SEND + the create-side listing gates pass free.
    var isSale = actionType === 'ORDER_MATCH'
              || actionType === 'SWAP_MATCH'
              || actionType === 'DISPENSE';
    if (!isSale) return;                                   // ALLOW, untaxed

    // Native-coin (COINPay) proceeds carry no on-ledger amount to route.
    if (!proceedsTick || !price || xchain.math.lte(price, '0')) return;

    // Proceeds were credited to this controller; forward 100% back out.
    var self = xchain.getContractAddress();
    xchain.require(
        xchain.math.gte(xchain.getBalance(self, proceedsTick) || '0', price),
        'proceeds not routed');

    var bps = xchain.state.get('bps') || '0';

    // cut = floor(price * bps / 10000), exact via mod-remainder so that
    // cut + toSeller == price and the host conservation check passes.
    var scaled   = xchain.math.multiply(price, bps);
    var dust     = xchain.math.mod(scaled, '10000');
    var cut      = xchain.math.divide(xchain.math.subtract(scaled, dust), '10000');
    var toSeller = xchain.math.subtract(price, cut);

    if (xchain.math.gt(cut, '0'))
        xchain.emit.send({ destination: xchain.state.get('creator'),
                           tick: proceedsTick, quantity: cut });
    if (xchain.math.gt(toSeller, '0'))
        xchain.emit.send({ destination: from,
                           tick: proceedsTick, quantity: toSeller });
    // return => ALLOW
}
```

Lifecycle:

1. Creator **deploys** the contract, then **`EXECUTE`s** `initialize(creator, bps)`
   once (e.g. `bps = '1000'` for 10%). It stores `creator`, `bps`, and a
   `paidTotal` bookkeeping counter; a `getStats` view reads them back.
2. Creator **issues** the NFT with `CONTROLLER = <that contract's action_index>`
   and `LOCK_CONTROLLER = 1`, so holders can trust the royalty is permanent.
3. A buyer fills the seller's `ORDER` for the NFT at 100 XCHAIN. Before settling,
   the indexer credits the 100 XCHAIN proceeds to the controller's derived
   address and runs `guard('ORDER_MATCH', seller, buyer, NFT, '1', '100',
   'XCHAIN')`. The guard floors a 10% cut (`floor(100*1000/10000) = 10`),
   `emit.send`s 10 to the creator and 90 to the seller, and returns. The
   post-guard conservation check sees the controller's net XCHAIN balance back at
   its starting value and lets the match settle.
4. A plain `SEND` of the NFT (a gift, a wallet move) calls
   `guard('SEND', from, to, NFT, '1', '', '')`; `isSale` is false so the guard
   returns immediately — free transfer, no cut.

**Why mod-remainder, not plain division?** `divide(price, '10')` on a price like
`1` would yield a clean `0.1`, but a price like `1/3`-shaped value can produce a
non-terminating decimal that mathjs rounds — making `cut + toSeller ≠ price` and
tripping the conservation check (the controller would strand or over-forward
dust). Computing `cut` as `(scaled − (scaled mod 10000)) / 10000` keeps the
dividend an exact multiple of 10000, so the division terminates and the split is
penny-exact. The flip side is that sub-unit trades floor to a zero cut — a
deliberate, deterministic rounding-down in the creator's disfavour.

## Implementation status

| Piece | Status |
|---|---|
| `CONTROLLER` / `LOCK_CONTROLLER` binding (ISSUE, schema, db) | **Implemented** |
| VM guard mode (`isGuard`: ATTEST/XCALL disabled) | **Implemented** |
| Guard engine (`Execute.runControllerGuard`) — VM call, atomic state/emissions, depth cap, gas | **Implemented** |
| `SEND` guarded (veto + programmable side-effects + gas) | **Implemented** |
| `ORDER_CREATE` / `SWAP_CREATE` / `DISPENSER_CREATE` veto (listing gate, + gas) | **Implemented** |
| `ORDER_MATCH` / `SWAP_MATCH` / `DISPENSE` veto + royalty **proceeds routing** | **Pending** — see below |

### Pending: sale-path guard at match (veto + royalty proceeds routing)

The create-side gate above approves *listing* a controlled token. The match side
(actual fill) still needs the guard, in two escalating forms:

1. **Veto at match** (lower risk). Consult `guard(...,'<ACTION>_MATCH', ...)` as an
   extra skip-gate alongside the existing allow/block-list check
   (`order_match.js` ~L200, `swap_match.js` ~L67, `dispense.js` ~L153) — *before*
   any settlement mutation (remaining-amount updates, `createActionIndex`,
   `transferTokenOwnership`). Deny ⇒ `continue` (skip the match), exactly like a
   blocked match, so no partial state. Lets the controller enforce transfer
   policy and run programmable bookkeeping at fill time.

2. **Royalty proceeds routing** (the enforced cut). The royalty must come out of
   the **proceeds**. Intended design: credit the proceeds to the controller's
   derived address instead of the seller, run the guard (now funded), let it
   `emit.send` the split (cut → creator, remainder → seller), and apply a
   post-guard **conservation check** rejecting the match if the controller's net
   proceeds-tick balance increased (a buggy guard that failed to forward) —
   preventing stranded funds.

**Open design questions to resolve before building (must be done + tested on
Node 22 / test-host — these are consensus-critical money paths):**
- **Gas attribution at match.** A match is system-triggered (no single submitting
  SOURCE). Decide who funds the match-guard gas (matcher? both? a per-match
  protocol allowance?) or run the match guard fee-less (bounded by gas ceiling +
  the finite open-order set). The create-side already charges the lister.
- **Proceeds routing reshapes `order_match` batching.** Today credits/escrows are
  accumulated and applied once (`processTransactionLedgerChanges`, L338). Routing
  requires committing the proceeds credit to the controller *before* the guard
  runs (the guard's `emit.send` checks the DB ledger), interleaving a VM run with
  ledger writes mid-match — needs care to stay atomic/deterministic.
- **Native-coin (COINPay) proceeds.** When proceeds are native coin (off-ledger,
  settled later via COINPay), there is no on-ledger amount to route — royalty
  there is out of scope for v1 (veto only); document the limitation.
- **Ownership sales.** `GIVE_OWNERSHIP` fills transfer via `transferTokenOwnership`
  — decide whether/how a cut applies.

## Touched components

`xchain-indexer` (binding, schema + migration, guard engine, SEND wiring),
`xchain-vm` (guard-restricted emission mode). `xchain-encoder` and
`xchain-decoder` need no changes — the encoder is a generic payload builder and
the decoder stores the wire string verbatim.
