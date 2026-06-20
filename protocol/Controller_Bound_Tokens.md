# Controller-Bound Tokens

A token (`TICK`) may bind itself to a deployed VM contract; its **controller**.
Once bound, the indexer invokes the controller's `guard` method **before** a
guarded native action on that token settles, inside the same atomic scope. The
guard is a fully programmable contract method: it may read/write its own
contract state, emit token actions, and return a royalty/fee split of the sale
proceeds (`payoutLegs`); it may `revert` to **deny** the action.

Because the indexer is the only settlement path on XChain, a controller makes a
token's rules **unavoidable**; the enforced-royalty property that
marketplace-goodwill royalties on other chains never achieved. The token stays
natively held and natively tradeable; the controller only gates the actions that
move or sell it.

The feature is **opt-in and isolated**: a token with no `CONTROLLER` behaves
exactly as before (one NULL check, zero overhead). Binding is via the
[`ISSUE`](actions/ISSUE.md) action.

## Binding (ISSUE)

A token binds (or unbinds) a controller for one **action class** at a time via `ISSUE`
**version 6**: `VERSION|TICK|CONTROLLER|ACTION_CLASS|COOLDOWN_BLOCKS|UNBIND|MEMO`.

| Field | Meaning |
|---|---|
| `CONTROLLER` | `ACTION_INDEX` of a deployed, active contract on the same chain (its `contracts.action_index`; derived address `C:<CHAIN>:<CONTROLLER>`). |
| `ACTION_CLASS` | Which class of action this binding gates: `transfer` (SEND), `trade` (ORDER / SWAP / DISPENSER create), `burn` (DESTROY), `mint` (MINT supply creation), `stake` (STAKE v3 contract-targeted staking of the token): or the catch-all `all` (see [Precedence & the `all` class](#precedence--the-all-class)). |
| `COOLDOWN_BLOCKS` | Drop-cooldown committed at bind time: the friction (in blocks) before a later `UNBIND` of this class takes effect. |
| `UNBIND` | `1` drops the live binding for `ACTION_CLASS` (gated by its cooldown); `0` binds. |

- Only the token owner can bind/unbind (standard `ISSUE` owner gate).
- At bind time the indexer verifies `CONTROLLER` resolves to an existing contract
  in `valid` (active) state, mirroring the contract check in `EXECUTE`.
- Bindings are **append-only** events in `token_controllers`. The effective controller
  for a `(token, class)` is the latest event at/below the current block: a `bind` gates,
  an `unbind` gates only until its cooldown elapses. There is no `LOCK_CONTROLLER` flag;
  the drop-cooldown is the only friction on changing a binding.
- A token with no binding for a class behaves exactly as before (one NULL check, zero overhead).

### Precedence & the `all` class

An action is always **routed** to exactly one of the five concrete classes (`transfer`, `trade`,
`burn`, `mint`, `stake`) by a static map from the action name; the class is never derived from
user-supplied data, so a future action can't accidentally fall into a controlled class.

`all` is a sixth class that is **bindable but never routable**: you may bind a controller to `all`,
but no action ever routes to it directly. Instead, `all` is the **fallback** when an action's
specific class has no binding. Resolution is **most-specific-wins**, and **exactly one guard ever
runs** (there is no stacking; layer multiple policies inside one controller's `guard` instead):

1. Resolve the effective controller for the action's specific class (e.g. `transfer`).
2. If there is none, fall back to the effective `all` controller.
3. If neither gates, the action is ungated.

So binding `all` gates **every** class with one binding (a "freeze / compliance-gate this token
entirely" policy is one action, not five), and binding a specific class **on top of** `all`
overrides the catch-all for that class only; the specific binding fully replaces `all` there.
Binding a specific class while `all` is bound is allowed (it is the override); a second `all` bind
while one is live is rejected, exactly like any other class.

> ⚠️ **`all` means all classes, present AND future.** A token bound to `all` gates **every** routed
> class, including `mint` (supply creation) and `stake` (v3 contract-targeted staking) and will
> begin gating any class a future release makes routable. This is the intended "gate everything"
> behavior; bind `all` only if you want that.

Cooldown/unbind semantics are identical for `all` (it is just another `action_class` value with its
own append-only events). `all` participates in resolution only; routing is unchanged.

## The guard ABI

The controller contract **must export a method named `guard`**. The indexer calls
it with positional, all-string input params (read via `xchain.getInputParam(i)`):

| i | Param | Notes |
|---|---|---|
| 0 | `action_type` | the guard invocation point: `SEND` (transfer), `ORDER_CREATE` / `SWAP_CREATE` / `DISPENSER_CREATE` (trade), `DESTROY` (burn), `MINT` (mint), `STAKE` (stake, v3 contract-targeted only). No guard runs at match/dispense: see [Proceeds split](#proceeds-split-royalty--fee-payout_legs). |
| 1 | `from` | the address giving up / sending the token (`''` if n/a) |
| 2 | `to` | the address receiving the token (`''` if n/a) |
| 3 | `tick` | the controlled token |
| 4 | `amount` | token amount moving (or order/dispenser quantity) |
| 5 | `price` | proceeds amount for a sale (`''` for a plain `SEND`) |
| 6 | `proceeds_tick` | proceeds tick for a sale (`''` for a plain `SEND`) |

Decision semantics:

- **Return normally ⇒ ALLOW.** The guard's state changes and emitted actions are
  committed atomically with the native action.
- **A `trade`-class create guard may return `{ payoutLegs: [{ to, bps }, …] }`** to set a
  basis-point split of the sale's proceeds (see [Proceeds split](#proceeds-split-royalty--fee-payout_legs).
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
- Uncontrolled tokens pay nothing; there is no guard call.

## Reentrancy & determinism

- The guard runs as an ordinary deterministic VM execution, so every validator
  produces the identical decision and side effects.
- A guard whose `emit.send` moves **another** controlled token triggers that
  token's guard one level deeper. Guard depth is capped by `VM_MAX_CALL_DEPTH`
  (4); exceeding it denies the originating action. This reuses the existing
  cross-contract call-depth machinery.
- Guard state changes + emissions are wrapped in a dedicated DB savepoint
  (`controller_guard_<actionIndex>_<controller>_<seq>`); any emission failure
  rolls the whole guard back and denies; the same atomicity model as `EXECUTE`.

## Permissions manifest

A contract may **declare its own blast-radius bound** at deploy time by exporting a
manifest alongside its methods:

```js
module.exports = {
    permissions: ['SEND', 'ISSUE'],   // the ONLY action types this contract may emit
    maxTakeBps: 250,                  // a tighter royalty cap than the global default
    guard: function () { /* … */ }
};
```

Both fields are optional. The indexer reads them **deterministically at deploy** by
instantiating the contract's module top-level (no method runs), so the manifest is
captured even for a contract that exports no constructor. The values are **immutable**
(contract code is immutable) and persisted to the `contract_permissions` table; all
enforcement reads that persisted row.

- **`permissions` (emission allowlist).** Every action a contract emits, from **any**
  path (its constructor, an `EXECUTE`, or a `guard`), must be a member of this array,
  or the emission is rejected fail-closed (the host action is denied / reverted). This
  is the contract-wide analogue of the cross-chain `crossCallable` allowlist.
  - Absent ⇒ **unrestricted** (the backward-compatible default; most contracts).
  - `[]` ⇒ the contract may emit **nothing**.
  - This is in addition to the standing guard rule that no guard may emit
    `ATTEST` / `XCALL` / `SLASH`.
- **`maxTakeBps` (tighter royalty cap).** An integer in `[0, 10000]`. The effective
  proceeds-split cap for this contract's `trade` guard becomes
  `min(CONTROLLER_MAX_TAKE_BPS, maxTakeBps)`; a contract can voluntarily cap its own
  take below the global ceiling but can never exceed it. Absent ⇒ the global cap applies.

A **malformed manifest** (`permissions` not an array of action-type strings, or `maxTakeBps` not an integer in range) **rejects the `DEPLOY`** (`invalid:
CONTRACT_MANIFEST (…)`) rather than silently degrading to unrestricted. The decision is
deterministic and hashes into the contract's status, so every validator agrees.

## Account (address) controllers

Controllers also bind to **accounts**, not just tokens; the same guard framework with the
address as the subject. An account self-gates one action class via the
[`ADDRESS`](actions/ADDRESS.md) action, **version 1**:
`VERSION|CONTROLLER|ACTION_CLASS|COOLDOWN_BLOCKS|UNBIND|MEMO`.

- The binding is **self-signed** (`SOURCE` is the account gating itself) and lives in the
  append-only `address_controllers` table with the same per-class, cooldown/unbind, fail-closed
  semantics as token bindings.
- The guard runs with the same [ABI](#the-guard-abi), gas rules, and determinism guarantees;
  the subject is the account and `tick` is the token in motion.

**What it gates today:** both sides of a direct `SEND`. A `transfer` address binding is
**symmetric**: it runs whether the account is the **`SOURCE`** (an *outbound* self-gate:
self-imposed spending controls: velocity, allowlists, compliance) or the **`DESTINATION`** (an
*inbound* gate: refuse an unsolicited incoming transfer). The guard distinguishes direction from
its `from`/`to` (`from === subject` ⇒ outbound). The enforcement order is: the token's own
`transfer` guard → the source's outbound `transfer` guard → the destination's inbound `transfer`
guard. `SOURCE` pays the guard gas, and the reservations are cumulative so `GAS` can't be driven
negative. DEX and dispenser deliveries are *solicited pulls*, not direct sends, so they are never
gated this way.

Where a token controller makes the rules travel with the *asset*, an address controller makes
them travel with the *account*.

## Worked example: enforced NFT royalty

1. Creator deploys a controller whose `guard` returns a royalty split, issues the NFT,
   and binds the `trade` class to it: `ISSUE` v6 `NFT | <contract> | trade | <cooldown> | 0 |`.
2. The seller lists it: `ORDER` give NFT, get 1000 XCHAIN. At create the indexer runs
   `guard('ORDER_CREATE', seller, '', NFT, '1', '1000', 'XCHAIN')`; the guard returns
   `{ payoutLegs: [{ to: creator, bps: 500 }] }` (5%). The indexer validates the legs and
   stores them on the order's `payout_legs`. (The guard could instead `revert` to refuse the listing.)
3. A buyer fills the order. At match the indexer applies the stored split to the seller's
   1000 XCHAIN proceeds: **50 → creator, 950 → seller**, conserved exactly. No guard runs at match.
4. A plain `SEND` of the NFT (a gift, a wallet move) is in the `transfer` class, untouched
   unless the token also binds a `transfer` controller, which could gate or deny moves while
   sales stay separately controlled.

## Implementation status

| Piece | Status |
|---|---|
| Per-class binding via ISSUE v6 (append-only `token_controllers`, cooldown/unbind) | **Implemented** |
| VM guard mode (`isGuard`: ATTEST/XCALL disabled) | **Implemented** |
| Guard engine (`Execute.runControllerGuard`): VM call, atomic state/emissions, depth cap, gas | **Implemented** |
| `SEND` guarded (transfer class: veto + programmable side-effects + gas) | **Implemented** |
| `ORDER_CREATE` / `SWAP_CREATE` / `DISPENSER_CREATE` guard (listing gate + `payoutLegs`, + gas) | **Implemented** |
| Sale-path proceeds split: `payout_legs` stored at create, `applyProceedsSplit` at match | **Implemented** |
| `MINT` guarded (mint class: gate supply creation, + gas) | **Implemented** |
| `STAKE` v3 guarded (stake class: gate contract-targeted staking by the staked token, + gas; v1/v2 GAS capability stakes ungated) | **Implemented** |
| Account (address) controllers (ADDRESS v1 bind, **symmetric** `transfer` `SEND` gate) both source-outbound + recipient-inbound (`address_controllers`) | **Implemented** |
| Permissions manifest: deploy-time `permissions` allowlist (all emission paths) + per-contract `maxTakeBps` (`contract_permissions`) | **Implemented** |

## Proceeds split (royalty / fee `payout_legs`)

A `trade`-class guard sets an optional **basis-point split of the sale proceeds** by
returning `{ payoutLegs: [ { to: <address>, bps: <int> }, … ] }` from its `guard` at
**create** time. The split is declarative data carried on the order/swap row (**no guard
runs at match**, which keeps the system-triggered fill path deterministic and gas-free.

1. **At create** (`ORDER_CREATE` / `SWAP_CREATE`): the indexer validates each leg (`to` a
   valid address, `bps` a non-negative integer, total `bps` ≤ the effective cap
   `min(CONTROLLER_MAX_TAKE_BPS, contract maxTakeBps)`: global default `10000`, optionally
   tightened by the contract's [permissions manifest](#permissions-manifest)) and stores the
   legs as JSON on `orders.payout_legs` /
   `swaps.payout_legs`. A malformed or over-cap set **denies** the listing (fail-closed).
   No `payoutLegs` ⇒ NULL (an ordinary order).
2. **At match**: `Utility.applyProceedsSplit(tick, proceeds, seller, legs, decimals, cap)`
   splits each filled order's proceeds: **seller-remainder first, then each leg**,
   crediting `floor(proceeds × bps / 10000)` (at token precision) to each `to` and the
   exact remainder to the seller. The split **conserves the proceeds exactly** (no dust
   created or lost), so DEX settlement math is unchanged; an order with no legs yields a
   single full credit to the seller, so the call is unconditional.

**Scope.** The split applies to **on-ledger** proceeds (the `GET_TICK` the seller
receives). Native-coin (COINPay) proceeds are off-ledger and out of scope for the split;
a `trade` guard can still `revert` to forbid such a listing. `GIVE_OWNERSHIP` sales
transfer ownership rather than a balance, so no proceeds split applies to that leg.

## Touched components

`xchain-indexer` (ISSUE v6 + `token_controllers`, ADDRESS v1 + `address_controllers`, guard
engine, create-side `payout_legs` + match-side `applyProceedsSplit`, SEND/transfer wiring,
deploy-time manifest capture + `contract_permissions` + `processEmission` allowlist enforcement),
`xchain-vm` (guard-restricted emission mode, `readManifest` deploy-time introspection).
`xchain-encoder` and `xchain-decoder` need no changes; the encoder is a generic payload builder
and the decoder stores the wire string verbatim.
