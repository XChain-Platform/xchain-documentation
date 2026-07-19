<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Controller-Bound Tokens

Controller-bound tokens are XChain's **programmable policy layer**. A token (`TICK`),
or an account (address), may bind itself to a deployed [VM](../concepts/Smart_Contracts.md)
contract, its **controller**. Once bound, the indexer runs the controller's `guard`
method **before** a guarded native action settles, inside the same atomic scope. The
guard is an ordinary contract method: it may read and write its own contract state, emit
token actions, return a royalty or fee split of a sale's proceeds, and `revert` to **deny**
the action outright.

Because the indexer is the only settlement path on XChain, a controller makes a token's
rules **unavoidable**. This is the enforced-royalty and enforced-compliance property that
marketplace-goodwill royalties on other chains never achieved: there is no second venue
where the rule can be sidestepped, because there is no second settlement path. The token
stays natively held and natively tradeable through the built-in DEX rails; the controller
only gates the actions that move, sell, mint, or burn it.

The feature is **opt-in and isolated**. A token or account with no binding behaves exactly
as it did before (one NULL check, zero VM work, zero added fee). Nothing about an
uncontrolled token changes. A binding is added, and dropped, by its owner.

---

## At a glance

- **Token controllers** gate actions on a bound `TICK`: transfers, trades, burns, mints,
  contract-targeted staking, and ownership deed-overs. Bound via [`ISSUE`](./actions/ISSUE.md) v6.
- **Address controllers** gate direct sends into or out of a bound account. Bound via
  [`ADDRESS`](./actions/ADDRESS.md) v1.
- **The guard is programmable.** It runs as a normal VM execution, so every validator
  reaches the identical decision and side effects.
- **A `trade` guard can set a proceeds split** (`payoutLegs`), the generic primitive behind
  royalties, marketplace fees, and revenue share. There is no royalty-specific code path.
- **A contract can declare its own blast radius** at deploy time: an emission allowlist and
  a tighter royalty cap (the [permissions manifest](#permissions-manifest)).
- **Everything fails closed.** A revert, an error, out-of-gas, or a missing `guard` denies
  the guarded action and rolls back everything the guard did.
- **Bindings are droppable**, subject to a per-binding drop-cooldown the owner commits at
  bind time.

Controllers are **gates, never agents**: a controller never holds or moves user funds on
its own initiative. It decides whether a native action the user already signed is allowed,
and may attach a declarative proceeds split to a sale the user is making.

---

## How it works: the settlement-time guard

The indexer processes each native action in two stages: it validates the action, then
settles it (moves balances, updates supply, closes orders). A controller inserts a guard
call **at the boundary between those two stages**, before any ledger change for the action
is committed:

1. The action is parsed and passes its normal validation.
2. If the action's [class](#action-classes) is bound to a controller, the indexer calls the
   controller's `guard` method with the action's details.
3. **Return normally** and the action settles; the guard's own state changes and emitted
   actions commit atomically alongside it.
4. **`revert`, error, or run out of gas** and the action is denied: it is recorded
   `invalid: controller (<reason>)`, and everything the guard did is rolled back.

Exactly one guard runs per action (there is no stacking). To layer several policies, put
them inside one controller's `guard`.

---

## Binding a controller (ISSUE v6)

A token binds, or unbinds, a controller for one **action class** at a time via
[`ISSUE`](./actions/ISSUE.md) **version 6**:

```
VERSION|TICK|CONTROLLER|ACTION_CLASS|COOLDOWN_BLOCKS|UNBIND|MEMO
```

| Field | Meaning |
|---|---|
| `CONTROLLER` | `ACTION_INDEX` of a deployed, active contract on the same chain (its `contracts.action_index`; derived address `C:<CHAIN>:<CONTROLLER>`). |
| `ACTION_CLASS` | Which [class](#action-classes) of action this binding gates. |
| `COOLDOWN_BLOCKS` | Drop-cooldown committed at bind time: the friction (in blocks) before a later `UNBIND` of this class takes effect. |
| `UNBIND` | `1` drops the live binding for `ACTION_CLASS` (gated by its cooldown); `0` binds. |

Rules:

- Only the token owner can bind or unbind (the standard `ISSUE` owner gate).
- At bind time the indexer verifies `CONTROLLER` resolves to an existing contract in `valid`
  (active) state, mirroring the contract check in [`EXECUTE`](./actions/EXECUTE.md).
- Bindings are **append-only** events in `token_controllers`. The effective controller for a
  `(token, class)` is the latest event at or below the current block: a `bind` gates; an
  `unbind` gates only until its cooldown elapses. There is no `LOCK_CONTROLLER` flag; the
  drop-cooldown is the only friction on changing a binding.
- A token with no binding for a class behaves exactly as before (one NULL check, zero overhead).

### Action classes

An action is always **routed** to exactly one of six concrete classes by a static map from
the action name. The class is never derived from user-supplied data, so a future action
cannot accidentally fall into a controlled class.

| Class | Gates | Guard `action_type` |
|---|---|---|
| `transfer` | `SEND` (and the balance leg of bulk moves) | `SEND` |
| `trade` | [`ORDER`](./actions/ORDER.md) / [`SWAP`](./actions/SWAP.md) / [`DISPENSER`](./actions/DISPENSER.md) create | `ORDER_CREATE` / `SWAP_CREATE` / `DISPENSER_CREATE` |
| `burn` | [`DESTROY`](./actions/DESTROY.md) | `DESTROY` |
| `mint` | [`MINT`](./actions/MINT.md) supply creation | `MINT` |
| `stake` | [`STAKE`](./actions/STAKE.md) v3 contract-targeted staking of the token | `STAKE` |
| `ownership` | [`SWEEP`](./actions/SWEEP.md) deed-over of the token's ownership record | `SWEEP_OWNERSHIP` |

A seventh value, `all`, is **bindable but never routable** (see below).

### Precedence and the `all` class

`all` is a class you may **bind** a controller to, but no action ever **routes** to it
directly. Instead, `all` is the **fallback** when an action's specific class has no binding.
Resolution is **most-specific-wins**, and **exactly one guard ever runs**:

1. Resolve the effective controller for the action's specific class (e.g. `transfer`).
2. If there is none, fall back to the effective `all` controller.
3. If neither gates, the action is ungated.

So binding `all` gates **every** class with one binding (a "freeze this token entirely" or
"compliance-gate everything" policy is one action, not six), and binding a specific class
**on top of** `all` overrides the catch-all for that class only; the specific binding fully
replaces `all` there. Binding a specific class while `all` is bound is allowed (it is the
override); a second `all` bind while one is live is rejected, exactly like any other class.

> ⚠️ **`all` means all classes, present AND future.** A token bound to `all` gates **every**
> routed class, including `mint` (supply creation), `stake` (v3 contract-targeted staking),
> and `ownership`, and will begin gating any class a future release makes routable. This is
> the intended "gate everything" behavior; bind `all` only if you want that.

Cooldown and unbind semantics are identical for `all` (it is just another `action_class`
value with its own append-only events). `all` participates in resolution only; routing is
unchanged.

---

## The guard ABI

The controller contract **must export a method named `guard`**. The indexer calls it with
positional, all-string input params (read via `xchain.getInputParam(i)`):

| i | Param | Notes |
|---|---|---|
| 0 | `action_type` | the guard invocation point (see the [class table](#action-classes)). For `SWEEP_OWNERSHIP` there is one run per swept ownership deed, `from` = owner/SOURCE, `to` = DESTINATION. No guard runs at match or dispense: see [Proceeds split](#proceeds-split-royalty--fee-payout_legs). |
| 1 | `from` | the address giving up / sending the token (`''` if n/a) |
| 2 | `to` | the address receiving the token (`''` if n/a) |
| 3 | `tick` | the controlled token |
| 4 | `amount` | token amount moving (or order/dispenser quantity) |
| 5 | `price` | proceeds amount for a sale (`''` for a plain `SEND`) |
| 6 | `proceeds_tick` | proceeds tick for a sale (`''` for a plain `SEND`) |

Decision semantics:

- **Return normally ⇒ ALLOW.** The guard's state changes and emitted actions are committed
  atomically with the native action.
- **A `trade`-class create guard may return `{ payoutLegs: [{ to, bps }, …] }`** to set a
  basis-point split of the sale's proceeds (see [Proceeds split](#proceeds-split-royalty--fee-payout_legs)).
- **`revert(reason)` / out-of-gas / runtime error / missing `guard` method ⇒ DENY**
  (fail-closed). The native action is marked `invalid: controller (<reason>)` and everything
  the guard did is rolled back.

The guard runs with full VM powers **except** the asynchronous frameworks:
`xchain.attestation.request(...)` and `xchain.emit.crossExecute(...)` throw in guard mode
(their results would arrive blocks later, after the guarded action already settled). This is
enforced at VM emit time (`isGuard`) and re-checked host-side. A guard also may not emit
`SLASH`, `ATTEST`, or `XCALL`.

Inside the guard, `xchain.getSourceAddress()` is the address that triggered the guarded
action, and `xchain.getContractAddress()` is the controller's own derived address (which
sources any actions the guard emits).

---

## Proceeds split (royalty / fee `payout_legs`)

A `trade`-class guard sets an optional **basis-point split of a sale's proceeds** by
returning `{ payoutLegs: [ { to: <address>, bps: <int> }, … ] }` from its `guard` at
**create** time. The split is declarative data carried on the order or swap row. **No guard
runs at match**, which keeps the system-triggered fill path deterministic and gas-free.

This one primitive is how XChain expresses royalties, marketplace fees, and revenue share.
There is no royalty-specific mechanism; "royalty" is simply the most common use of
`payoutLegs`.

1. **At create** (`ORDER_CREATE` / `SWAP_CREATE`): the indexer validates each leg (`to` a
   valid address, `bps` a non-negative integer, total `bps` ≤ the effective cap
   `min(CONTROLLER_MAX_TAKE_BPS, contract maxTakeBps)`; global default `10000`, optionally
   tightened by the contract's [permissions manifest](#permissions-manifest)) and stores the
   legs as JSON on `orders.payout_legs` / `swaps.payout_legs`. A malformed or over-cap set
   **denies** the listing (fail-closed). No `payoutLegs` ⇒ NULL (an ordinary order).
2. **At match**: `Utility.applyProceedsSplit(tick, proceeds, seller, legs, decimals, cap)`
   splits each filled order's proceeds, **seller-remainder first, then each leg**, crediting
   `floor(proceeds × bps / 10000)` (at token precision) to each `to` and the exact remainder
   to the seller. The split **conserves the proceeds exactly** (no dust created or lost), so
   DEX settlement math is unchanged; an order with no legs yields a single full credit to the
   seller, so the call is unconditional.

**Scope.** The split applies to **on-ledger** proceeds (the `GET_TICK` the seller receives).
Native-coin (COINPay) proceeds are off-ledger and out of scope for the split; a `trade` guard
can still `revert` to forbid such a listing. `GIVE_OWNERSHIP` sales transfer ownership rather
than a balance, so no proceeds split applies to that leg.

### Cross-chain sales (`CROSS_CHAIN_ROYALTY`)

A cross-chain listing (`GET_COIN` ≠ the token's chain) settles its proceeds on the
**counterparty chain**, which never runs the guard. What happens to a royalty-bearing
cross-chain listing is decided by the `CROSS_CHAIN_ROYALTY` flag-day, layered on the base
`CONTROLLER_GUARD` flag-day (no legs exist before that):

| `CONTROLLER_GUARD` | `CROSS_CHAIN_ROYALTY` | Cross-chain listing whose guard returns legs |
|---|---|---|
| off | (n/a) | no legs produced (unchanged) |
| on | **off** | **denied at create** (`royalty not enforceable cross-chain`, fail-closed) |
| on | **on** | accepted; legs travel in the validator-signed match and are applied at settlement |

When the flag is on:

1. **At create**, every leg `to` must re-encode to `GET_COIN`
   (`Utility.canReencodeAddress`); any non-portable leg (a contract address, or a segwit
   address when `GET_COIN` has no bech32, e.g. DOGE) denies the listing. This makes the
   settlement-time re-encode total: a trade that delivered can never hit an unpayable leg.
2. **In the match**, the hub copies each order's stored legs onto the `cross_chain_matches`
   row (`a_payout_legs` / `b_payout_legs`), and the legs are part of the **validator-signed
   XMATCH canonical** (2f+1 `cross_chain` signatures), so a colluding hub cannot strip a
   royalty: a stripped or rewritten legs field breaks the signatures and the match never
   settles.
3. **At settlement** (`cross_settle`), the proceeds chain applies the *counterparty's* legs
   to the escrow it releases, re-encoding each leg address to its own encoding before
   crediting (`applyProceedsSplit`, same remainder-first conservation as same-chain).

**Leg-address encoding convention (for guard authors).** Leg `to` addresses are expressed in
the **controlled token's own chain encoding** (the chain the guard runs on). P2PKH/P2SH
addresses share their `hash160` across BTC/LTC/DOGE, and segwit addresses share their witness
program across BTC/LTC, so the protocol re-encodes the address to the proceeds chain
deterministically at settlement (`Utility.crossChainReencodeAddress`): the same key controls
the funds on both chains. Regtest note: BTC/LTC/DOGE regtest share base58 prefixes, so
re-encoding is a no-op there; address-level tests must use mainnet parameters.

The canonical format flip is keyed on the BTC-anchored `snapshot_block`
(`cross_chain_royalty_activation.js`, a hub/indexer twin module), while the create-side
acceptance rule is keyed on the local block (`protocol_changes.js`). Operators must
coordinate the two: flip the canonical gate first or together with the create-side gate,
never create-side first. Both mainnet values are armed: the canonical flip is set to
`snapshot_block` height `961000` (BTC anchor ~2026-08-04; hub and every indexer must deploy
before that height), and the create-side acceptance gate is set to block time `1798761600`
(2027-01-01 00:00 UTC).

---

## Bulk distributions (AIRDROP / SWEEP / DIVIDEND)

Bulk moves of a controlled token route through the `transfer` class exactly like `SEND`, but
the guard gates the **aggregate outbound move, sender-side only**: one guard run per
controlled tick with `from = SOURCE`, `to = ''`, and `amount` = the total leaving the sender.
The guard is **never invoked per-recipient**. This is a deliberate protocol decision, not a
gap:

- **Deterministic, bounded VM work.** A drop can have thousands of recipients; one guard run
  per tick keeps guard gas independent of recipient count and keeps the ceiling reservation
  meaningful.
- **DoS-proof.** Per-recipient gating would let any single recipient's guard (or a crafted
  recipient list) deny or grief an entire distribution, and would multiply VM cost by the
  recipient count.
- **No consensus change needed.** Receiving a bulk drop is never guard-gated; there is nothing
  a recipient must sign or execute.

**Receive-side policy belongs in transfer restrictions, not the bulk guard.** If a token or
account needs to control who may *hold* or *receive* it, express that as a `transfer`
restriction that the recipient's balance is subject to on its next outbound move:

- **Token-level:** the token's `transfer` guard gates every subsequent `SEND` or listing of
  the token, so an unwanted airdropped balance is inert; it cannot move or trade without
  passing the guard. An allowlist or compliance guard therefore does not need per-recipient
  drop gating; unapproved holders simply cannot do anything with the drop.
- **Account-level:** an inbound `ADDRESS` `transfer` binding (see
  [Account controllers](#account-address-controllers)) lets an account refuse direct
  unsolicited `SEND`s. Bulk drops, like DEX and dispenser deliveries, are not gated inbound;
  the account's recourse is the same transfer-restriction model.

**Guidance for guard authors:** treat `AIRDROP` / `DIVIDEND` / `SWEEP` invocations as
sender-side aggregate checks (`from` is the distributor, `to` is empty, `amount` is the
total). Do not attempt per-recipient allowlisting inside the bulk guard; there is no
per-recipient invocation to hook. If your policy requires per-recipient control, either deny
the aggregate (forcing individual guarded `SEND`s) or enforce holder eligibility in the
`transfer` guard on subsequent moves.

**SWEEP has two legs, gated by two classes.** `SWEEP` *balance* moves are gated by the
`transfer` class as above. `SWEEP` **ownership** transfers are gated separately by the
`ownership` class: when a `SWEEP` deeds over a token whose `ownership` class is bound, the
guard runs once for that tick with `action_type = SWEEP_OWNERSHIP`, `from = SOURCE`,
`to = DESTINATION`, before the deed settles; any deny fails the whole `SWEEP` (fail-closed,
consistent with the balance path). This is a distinct capability from `transfer`: an issuer
can make ownership non-sweepable to an unapproved `DESTINATION` while balances stay freely
transferable, or the reverse. Ownership escrowed by an open `ORDER` / `SWAP` is delivered by
that offer's close path (a `trade` concern), not this class.

---

## Account (address) controllers

Controllers also bind to **accounts**, not just tokens; the same guard framework with the
address as the subject. An account self-gates one action class via the
[`ADDRESS`](./actions/ADDRESS.md) action, **version 1**:

```
VERSION|CONTROLLER|ACTION_CLASS|COOLDOWN_BLOCKS|UNBIND|MEMO
```

- The binding is **self-signed** (`SOURCE` is the account gating itself) and lives in the
  append-only `address_controllers` table, with the same per-class, cooldown/unbind,
  fail-closed semantics as token bindings.
- The guard runs with the same [ABI](#the-guard-abi), gas rules, and determinism guarantees;
  the subject is the account and `tick` is the token in motion.

**What it gates today:** both sides of a direct `SEND`. A `transfer` address binding is
**symmetric**: it runs whether the account is the **`SOURCE`** (an *outbound* self-gate:
self-imposed spending controls such as velocity limits, allowlists, or compliance) or the
**`DESTINATION`** (an *inbound* gate: refuse an unsolicited incoming transfer). The guard
distinguishes direction from its `from` / `to` (`from === subject` ⇒ outbound). The
enforcement order is: the token's own `transfer` guard, then the source's outbound `transfer`
guard, then the destination's inbound `transfer` guard. `SOURCE` pays the guard gas, and the
reservations are cumulative so `GAS` can never be driven negative. DEX and dispenser
deliveries are *solicited pulls*, not direct sends, so they are never gated this way.

Where a token controller makes the rules travel with the *asset*, an address controller makes
them travel with the *account*.

---

## Permissions manifest

A contract may **declare its own blast-radius bound** at deploy time by exporting a manifest
alongside its methods:

```js
module.exports = {
    permissions: ['SEND', 'ISSUE'],   // the ONLY action types this contract may emit
    maxTakeBps: 250,                  // a tighter royalty cap than the global default
    guard: function () { /* … */ }
};
```

Both fields are optional. The indexer reads them **deterministically at deploy** by
instantiating the contract's module top-level (no method runs), so the manifest is captured
even for a contract that exports no constructor. The values are **immutable** (contract code
is immutable) and persisted to the `contract_permissions` table; all enforcement reads that
persisted row.

- **`permissions` (emission allowlist).** Every action a contract emits, from **any** path
  (its constructor, an `EXECUTE`, or a `guard`), must be a member of this array, or the
  emission is rejected fail-closed (the host action is denied or reverted). This is the
  contract-wide analogue of the cross-chain `crossCallable` allowlist.
  - Absent ⇒ **unrestricted** (the backward-compatible default; most contracts).
  - `[]` ⇒ the contract may emit **nothing**.
  - This is in addition to the standing guard rule that no guard may emit `ATTEST` / `XCALL` /
    `SLASH`.
- **`maxTakeBps` (tighter royalty cap).** An integer in `[0, 10000]`. The effective
  proceeds-split cap for this contract's `trade` guard becomes
  `min(CONTROLLER_MAX_TAKE_BPS, maxTakeBps)`; a contract can voluntarily cap its own take
  below the global ceiling but can never exceed it. Absent ⇒ the global cap applies.

A **malformed manifest** (`permissions` not an array of action-type strings, or `maxTakeBps`
not an integer in range) **rejects the `DEPLOY`** (`invalid: CONTRACT_MANIFEST (…)`) rather
than silently degrading to unrestricted. The decision is deterministic and hashes into the
contract's status, so every validator agrees.

---

## Gas

Running the guard costs VM gas, billed to the action's `SOURCE` in `XCHAIN` at
`fee = gasBilled × GAS_PRICE`:

- The guard runs against a bounded ceiling, `GAS_SCHEDULE.VM_GUARD_GAS_CEILING`
  (default 200,000).
- `SOURCE` must hold the **full ceiling fee** as a reservation before the guard runs (this
  mirrors the cross-contract-call gas reservation); insufficient `XCHAIN` rejects the action
  before any VM work. The actual metered fee (≤ reservation) is what is charged.
- **v1 charges guard gas on ALLOW only.** A denied action records no ledger change (preserving
  the ledger/balance invariant). The denial-spam vector is bounded by the real on-chain
  transaction cost of each attempt; charge-on-deny is a possible later refinement.
- Uncontrolled tokens pay nothing; there is no guard call.

---

## Reentrancy and determinism

- The guard runs as an ordinary deterministic VM execution, so every validator produces the
  identical decision and side effects.
- A guard whose `emit.send` moves **another** controlled token triggers that token's guard one
  level deeper. Guard depth is capped by `VM_MAX_CALL_DEPTH` (4); exceeding it denies the
  originating action. This reuses the existing cross-contract call-depth machinery.
- Guard state changes and emissions are wrapped in a dedicated DB savepoint
  (`controller_guard_<actionIndex>_<controller>_<seq>`); any emission failure rolls the whole
  guard back and denies, the same atomicity model as [`EXECUTE`](./actions/EXECUTE.md).

Every net ledger mutation a guard performs (a burn, or a mint) is reconciled into token supply
in the same block, so the indexer's per-block ledger invariant (ledger == supply == balances)
holds; a balanced transfer or an escrow settlement is supply-neutral.

---

## Worked example: enforced NFT royalty

1. Creator deploys a controller whose `guard` returns a royalty split, issues the NFT, and
   binds the `trade` class to it: `ISSUE` v6 `NFT | <contract> | trade | <cooldown> | 0 |`.
2. The seller lists it: `ORDER` give NFT, get 1000 XCHAIN. At create the indexer runs
   `guard('ORDER_CREATE', seller, '', NFT, '1', '1000', 'XCHAIN')`; the guard returns
   `{ payoutLegs: [{ to: creator, bps: 500 }] }` (5%). The indexer validates the legs and
   stores them on the order's `payout_legs`. (The guard could instead `revert` to refuse the
   listing.)
3. A buyer fills the order. At match the indexer applies the stored split to the seller's
   1000 XCHAIN proceeds: **50 → creator, 950 → seller**, conserved exactly. No guard runs at
   match.
4. A plain `SEND` of the NFT (a gift, a wallet move) is in the `transfer` class, untouched
   unless the token also binds a `transfer` controller, which could gate or deny moves while
   sales stay separately controlled.

---

## Activation and availability

Controller-bound tokens ride the `CONTROLLER_GUARD` protocol flag-day. Below it, `ISSUE` v6
and `ADDRESS` v1 bindings are not accepted and no guard runs; a token or account is exactly as
it was before the feature existed. The cross-chain proceeds-split behavior additionally rides
the `CROSS_CHAIN_ROYALTY` flag-day described [above](#cross-chain-sales-cross_chain_royalty).

Because a guard's decision and side effects are consensus-relevant, the VM engine and the
indexer must deploy **atomically** across the fleet: every validator must run the same guard
code at the same height, or they would disagree on whether an action settled. Until a token or
account actually binds a controller, the feature is inert on mainnet: uncontrolled tokens take
the zero-overhead NULL path.

For the current protocol activation heights, see [Protocol Activation](./Protocol_Activation.md).

---

## Related

- [`ISSUE`](./actions/ISSUE.md) v6: token controller binding.
- [`ADDRESS`](./actions/ADDRESS.md) v1: address controller binding.
- [`MINT`](./actions/MINT.md), [`STAKE`](./actions/STAKE.md), [`SWEEP`](./actions/SWEEP.md),
  [`DESTROY`](./actions/DESTROY.md), [`ORDER`](./actions/ORDER.md), [`SWAP`](./actions/SWAP.md),
  [`DISPENSER`](./actions/DISPENSER.md): the guarded actions.
- [`DEPLOY`](./actions/DEPLOY.md) and [Contract ABI](./Contract_ABI.md): deploying a controller
  and declaring its manifest.
- [Smart Contracts](../concepts/Smart_Contracts.md): the VM the guard runs in.
- [NFT Standard](./NFT_Standard.md): the enforced-royalty use case.
- [Cross-Chain DEX](./Cross_Chain_DEX.md): how cross-chain proceeds settle.
