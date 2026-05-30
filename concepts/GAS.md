<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

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
| **Action emission** | 500 | 0.005 | Anti-spam for emitted actions |
| **Computation** | 1/instruction | — | Metered by isolated-vm |

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

Native coin fees are collected at **fee destination addresses** on each chain. The ADDRESS action's `FEE_PREFERENCE` field routes collected fees:

| Bucket | Purpose |
|---|---|
| Protocol Development | Fund ongoing platform development |
| Community Development | Community grants, ecosystem growth |
| **XCHAIN Buyback Program** | Buy XCHAIN on the DEX (ORDER + COINPAY) to replenish validator reward pool |
| Destroy (burn) | Deflationary |

The buyback program creates constant buy-side pressure for XCHAIN on the DEX, funding validator rewards sustainably.

## The XCHAIN Token

XCHAIN is a standard XChain token issued via ISSUE on the **BTC chain only**. It does not exist natively on LTC or DOGE. The XCHAIN ticker is reserved on all chains to prevent unauthorized issuance.

XCHAIN's value is driven by:
- **Staking demand** — validators must stake XCHAIN (1,000 for oracle, 5,000 for cross-chain)
- **Buyback program** — native coin fees are used to buy XCHAIN on the DEX

## Oracle Price Validation

When a user pays a fee in native coin, the indexer validates the payment against the decentralized oracle:

1. Calculate expected native coin amount: `gas × GAS_PRICE → XCHAIN → USD → native coin`
2. Check the transaction output to the fee destination address
3. Validate the paid amount is within the tolerance band (95%-110%)
4. Record the fee with the oracle round reference

The tolerance band accounts for price movement between transaction creation and confirmation.

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

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
