<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Gas and Fees

XChain uses a unified gas-based fee system. All protocol fees are expressed in **gas units**, converted to XCHAIN via a single GAS_PRICE parameter, and paid in either native coin (BTC/LTC/DOGE) via oracle price conversion or XCHAIN balance deduction (BTC only).

## Fee Conversion Paths

**Native coin payment (all chains):**
```
gas cost → GAS_PRICE → XCHAIN amount → XCHAIN/USD oracle → USD → USD/coin oracle → native coin
```

**XCHAIN balance payment (BTC only):**
```
gas cost → GAS_PRICE → XCHAIN amount → debit from user's XCHAIN balance
```

On BTC, the indexer uses implicit detection: if the transaction includes a native coin output to the fee destination address, it's validated as native coin payment against the oracle. If there is no fee output, the indexer debits XCHAIN from the user's balance. On LTC/DOGE, native coin payment is the only option — a missing fee output means the action is rejected.

The fee destination address is the per-network `ADDRESS.FEE_DESTINATION` config value. It can be set at runtime with the `XCHAIN_FEE_DESTINATION_<COIN>_<NETWORK>` environment variable (e.g. `XCHAIN_FEE_DESTINATION_DOGE_MAINNET`). While it remains the unset placeholder, native-coin fee detection is disabled and the indexer falls back to XCHAIN-balance deduction on BTC (and rejects fee-bearing actions on LTC/DOGE).

## GAS_PRICE

| Parameter | Value | Notes |
|---|---|---|
| **GAS_PRICE** | 0.00001 XCHAIN/gas | Governance-adjustable. Single lever to scale all fees. |

**Anchor:** ISSUE = 100,000 gas = 1.0 XCHAIN at initial GAS_PRICE.

## Complete Fee Schedule

### Platform Action Fees

| Action | Gas Cost | XCHAIN (initial) | Notes |
|---|---|---|---|
| **ISSUE** | 100,000 | 1.0 | Same on all chains |
| **Sub-token ISSUE** | 50,000 | 0.5 | Half of ISSUE |
| **ORDER/DISPENSER/SWAP expiration** | 550/day | ~0.0055/day | 90-day free period |
| **AIRDROP** | 100/recipient | 0.001/recipient | 1,000 recipients = 1 XCHAIN |
| **DIVIDEND** | 100/recipient | 0.001/recipient | Same as AIRDROP |

### VM Fees

| Operation | Gas Cost | XCHAIN (initial) | Notes |
|---|---|---|---|
| **EXECUTE base fee** | 1,000 | 0.01 | Minimum to invoke any contract |
| **DEPLOY base fee** | 100,000 | 1.0 | Permanent state — on par with ISSUE |
| **DEPLOY per byte** | 10 | — | 10KB = 100,000 extra gas; 64KB max |
| **State read** | 100 | 0.001 | Single indexed DB lookup |
| **State write** | 200 | 0.002 | 2x read |
| **State delete** | 100 | 0.001 | Same as read |
| **Oracle read** | 100 | 0.001 | Same as state read |
| **Cross-chain read** | 100 | 0.001 | Cross-chain state read (same cost as local state read) |
| **Action emission** | 500 | 0.005 | Anti-spam for emitted actions |
| **Attestation request** | 5,000 | 0.05 | Covers off-chain data request overhead (`attestation.request`) |
| **Computation** | 1/instruction | — | Metered by isolated-vm; one charge per control-flow point |

> **Indexed `for` loops are charged twice per iteration.** The gas meter injects a control-flow charge at the top of the loop body and a second charge into the update expression, so a `for` loop of N iterations costs `2 × N` computation gas. `while`, `do-while`, `for-in`, and `for-of` loops have no update expression and cost 1 per iteration. Account for the doubled cost when budgeting a gas ceiling for contracts that use indexed `for` loops.

### Hard Caps (Primary Spam Deterrent)

- Max 50 emitted actions per execution
- Max 10,000 state keys per contract
- Max 64KB state value per key
- 30-second wall-clock safety-net timeout per execution (see [Execution Termination](#execution-termination) — the gas ceiling is the primary limit and halts normal contracts in well under 1 second)
- 8MB memory limit per isolate
- Max 64KB contract code size

### Execution Termination

Contract execution is bounded by two independent mechanisms operating at different tiers:

1. **Gas exhaustion (primary).** Every instruction and every host operation (state reads/writes, oracle reads, action emissions) consumes gas, metered by isolated-vm. When a contract's gas budget is depleted, execution halts immediately. This is the enforced limit that governs the common case: a normally-behaving contract terminates here, typically in well under 1 second of wall-clock time. Gas is the spam and resource-abuse deterrent — see the Hard Caps and fee schedule above.

2. **Wall-clock timeout (secondary safety net).** A 30-second wall-clock limit backstops gas metering. It only fires when the gas ceiling fails to terminate execution in real time — for example, a contract engineered to maximize wall-clock time per unit of gas (calling host operations that are cheap in gas terms but slow in wall-clock terms). Under normal operation this limit is never reached; it exists solely to guarantee an execution cannot run unbounded if gas accounting is somehow outpaced.

The 30-second value is deliberately generous so that legitimate contracts are never killed prematurely on slower hardware (e.g. regtest machines), leaving the gas ceiling to enforce the practical limit.

**Pathological case:** because the safety net is set to 30 seconds, a contract specially crafted to burn wall-clock time cheaply relative to gas can hold a single indexer worker process busy for up to 30 seconds per `EXECUTE`. The gas ceiling makes this expensive to attempt at scale, but operators should be aware that the wall-clock backstop — not 100ms — is the true upper bound on a single execution's duration.

### Expiration Free Period

The first 90 days of any ORDER/DISPENSER/SWAP are free. Fees only apply to days beyond 90:
- 90-day order (default): **0 gas** (free)
- 180-day order: 49,500 gas (0.495 XCHAIN)
- 365-day order: 151,250 gas (~1.51 XCHAIN)

### Example Costs (at GAS_PRICE = 0.00001, XCHAIN = $1)

| Scenario | Gas | XCHAIN | USD |
|---|---|---|---|
| ISSUE a token | 100,000 | 1.0 | $1.00 |
| 90-day ORDER (default) | 0 | 0 | $0 |
| 1-year ORDER | 151,250 | ~1.51 | $1.51 |
| AIRDROP to 1,000 recipients | 100,000 | 1.0 | $1.00 |
| Simple contract call | ~2,600 | 0.026 | $0.026 |
| Deploy 10KB contract | 200,000 | 2.0 | $2.00 |

## Fee Collection and Distribution

Fees can be paid two ways. **Native-coin fees** (BTC/LTC/DOGE) are collected at the per-chain **fee destination address**. **XCHAIN-balance fees** are routed by the ADDRESS action's `FEE_PREFERENCE` field:

| Bucket | `FEE_PREFERENCE` | Purpose |
|---|---|---|
| Destroy (burn) | `1` | Permanently removes XCHAIN from supply (deflationary) |
| Protocol Development | `2` (default) | Funds ongoing platform development |
| Community Development | `3` | Community grants, ecosystem growth |

## The XCHAIN Token

XCHAIN is a standard XChain token issued via ISSUE on the **BTC chain only**. It does not exist natively on LTC or DOGE. The XCHAIN ticker is reserved on all chains to prevent unauthorized issuance.

**Fixed supply.** The entire XCHAIN supply is minted once at genesis and the token is then locked (`LOCK_MINT` + `LOCK_MAX_SUPPLY`), so no further XCHAIN can ever be created — by anyone, including the issuing address. Supply only ever decreases, via the burn bucket above.

**Validator rewards** are paid from a dedicated, pre-funded **reward pool address** — never by minting. The pool is seeded at genesis and topped up manually over time. When the pool cannot cover a pending reward, the `COLLECT` is rejected and the reward stays claimable until the pool is replenished (see [COLLECT](../protocol/actions/COLLECT.md)).

XCHAIN's value is driven by:
- **Staking demand** — validators must stake XCHAIN (1,000 for oracle, 5,000 for cross-chain)
- **Fixed, capped supply** — no inflation; rewards are paid from a finite pool, and the burn bucket is deflationary

## Oracle Price Validation

When a user pays a fee in native coin, the indexer validates the payment against the decentralized oracle:

1. Calculate expected native coin amount: `gas × GAS_PRICE → XCHAIN → USD → native coin`
2. Check the transaction output to the fee destination address
3. Validate the paid amount is within the tolerance band (95%-110%)
4. Record the fee with the oracle round reference

The tolerance band accounts for price movement between transaction creation and confirmation.

### Native-coin fees are non-refundable

A native-coin fee is a real on-chain output paying the fee destination, settled in the same transaction
as the action. If the action then fails validation (e.g. the ticker is already taken, the parameters are
invalid, or the fee is underpaid), the indexer marks the action invalid but **cannot refund the
native coin** — it is already final on-chain and is forfeited to the fee destination. This differs from
XCHAIN-balance fees, which are only debited when the action succeeds. Clients (wallet/SDK) should
pre-validate an action and confirm the fee amount against the current oracle price **before** broadcasting
with a native-coin fee, so users never pay for an action that will fail.

For a large action that the encoder splits across a P2SH commit + reveal transaction pair, place the
native-coin fee output on the commit (first) transaction. The commit always confirms before the reveal
(the reveal spends it), so the fee is fully received before the action is processed; the decoder
attributes the commit's fee output to the reveal action.

### Client pre-validation (sizing the fee + refusing doomed transactions)

Because a native-coin fee is forfeited if the action fails, clients should never broadcast one
they can't price. The indexer exposes a read-only pre-flight that computes the fee against current
chain state + current oracle prices **without persisting anything**, surfaced publicly through the
explorer (the indexer itself is not internet-facing):

- **`GET /{COIN}/api/feequote`** — query params `action`, `params` (pipe-delimited wire params,
  without the ACTION name), `source`, and optional `feeOutputSats`. Returns:

  ```json
  {
    "supported": true, "valid": true, "error": null,
    "xchainFee": "1.00000000",
    "requiredFeeNative": "0.00002000", "requiredFeeSats": 2000,
    "minAcceptable": "0.00001900", "maxAcceptable": "0.00002200",
    "feeDestination": "<address>", "oracleRound": 42,
    "toleranceMin": "0.95000000", "toleranceMax": "1.10000000"
  }
  ```

  `supported: false` means the indexer can't price this action's fee yet (the client should pay in
  XCHAIN instead). `valid: false` means the oracle price is missing/stale, or a supplied
  `feeOutputSats` is below the acceptance floor. A client sizes its `FEE_DESTINATION` output to
  `requiredFeeSats`.

- **`GET /{COIN}/api/feeschedule`** — the gas schedule, GAS_PRICE, tolerance band, fee destination,
  and the latest XCHAIN/USD + COIN/USD oracle prices (with a freshness flag) for display / rough
  estimates.

The `xchain-sdk` wraps this: `sdk.quoteNativeFee(actionData, { source })` returns the quote, and
`sdk.estimateFees(actionData, { payFeeInNativeCoin: true, ... })` calls the quote, sizes the
`FEE_DESTINATION` output via the encoder's `customOutputs`, and **throws** rather than build a
transaction that can't be priced. The `xchain-wallet` enforces the same gate at its broadcast
chokepoint and warns the user that a native-coin fee is forfeited if the transaction is rejected.

> Phase-1 scope: the pre-flight prices fees for ISSUE (new token) and ORDER / SWAP / DISPENSER
> *create*. Other actions return `supported: false` (pay in XCHAIN); deeper coverage via a full
> action dry-run is planned.

## Governance

All fee parameters are governance-adjustable via the hub's PBFT voting mechanism:

| Parameter | Adjustment |
|---|---|
| **GAS_PRICE** | Scales all fees proportionally |
| **Individual gas costs** | Fine-tune specific action costs |
| **Tolerance band** | Adjust fee validation window |
| **Free period** | Adjust expiration fee free days |

---

*See also: [Tokens](./TOKENS.md) | [Ledger](./LEDGER.md) | [Smart Contracts](./Smart_Contracts.md) | [Cross-Chain](./CROSS_CHAIN.md)*

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
