<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Gas and Fees

XChain uses its own fee token — **XCHAIN** — to pay for operations that write to the protocol's state. This gas mechanism funds infrastructure, prevents spam, and provides an economic layer independent of coin transaction fees.

## The XCHAIN Token

`XCHAIN` is a standard XChain token in every technical sense — it lives in the same ledger, transfers the same way, and appears in the same explorer. What makes it special is its designation as the platform fee token and the restrictions around who can issue it.

XCHAIN is **separate per chain**. The XCHAIN token on Bitcoin is a completely different asset from XCHAIN on Litecoin or Dogecoin. Holding BTC XCHAIN gives you no LTC XCHAIN, and vice versa. Fee payments on each chain require that chain's XCHAIN token.

## Who Can Issue XCHAIN

The `XCHAIN` ticker is a reserved ticker — no ordinary address can issue a token with that name. Only the designated **GAS address** for each chain and network can issue it. This address is configured per-chain (defined in the indexer's config for each coin and network) and is exempt from the reserved ticker restriction specifically to allow XCHAIN issuance.

This means XCHAIN supply is controlled by the platform deployer, not by any arbitrary address.

## Fee Schedule

Fees are charged in XCHAIN for operations that create or modify persistent state. The specific amounts are configurable per chain and network, but the general categories are:

- **Issuance fee**: Charged to create a new top-level token.
- **Sub-token fee**: A reduced fee for tokens issued under a parent token namespace.
- **DEX listing fees**: Charged for placing orders or opening dispensers.
- **Expiration fees**: Charged per-day for time-limited operations.

Operations that are read-only, or that operate on data already paid for, do not charge fees. Simple token transfers (SEND) between addresses do not require XCHAIN beyond the normal coin miner fee for the underlying blockchain transaction.

## Special Addresses

Each chain and network has four designated addresses with special roles:

| Address | Role |
|---|---|
| `GAS` | Issues the XCHAIN token; receives a portion of fee payments |
| `BURN` | Permanent destruction sink — tokens sent here cannot be recovered |
| `DONATE1` | Optional fee recipient 1 (infrastructure / development) |
| `DONATE2` | Optional fee recipient 2 (infrastructure / development) |

When a fee is collected, it is split and distributed to these addresses according to the fee schedule configuration. The split ratios and amounts are protocol parameters, adjustable per chain.

Sending tokens to the `BURN` address is the standard mechanism for intentional permanent destruction — it works for any token, not just XCHAIN.

## How Fees Are Recorded

Fee payments are full ledger entries. When an ISSUE ACTION charges an issuance fee, the indexer:

1. Validates that the issuer has sufficient available XCHAIN balance
2. Creates a debit entry on the issuer's XCHAIN balance
3. Creates credit entries on the GAS, DONATE1, and DONATE2 balances according to the distribution schedule

All three entries share the same ACTION_INDEX and are committed atomically. If fee validation fails (insufficient XCHAIN balance), the ACTION that triggered the fee is also rejected.

## VM Gas (Smart Contracts)

Smart contract execution introduces a fine-grained gas metering system. When an EXECUTE action runs a contract method, every operation inside the VM is individually metered:

| Operation | Gas Cost | Description |
|---|---|---|
| `VM_COMPUTATION` | 1 | Per control flow point (loop iteration, function call, branch) |
| `VM_STATE_READ` | 100 | `state.get()`, `state.has()`, `getBalance()`, `getTokenInfo()` |
| `VM_STATE_WRITE` | 200 | `state.set()` |
| `VM_STATE_DELETE` | 100 | `state.delete()` |
| `VM_ORACLE_READ` | 100 | `oracle.getPrice()`, `oracle.getPriceAtRound()` |
| `VM_CROSSCHAIN_READ` | 100 | `crossChain.getAttestation()`, `crossChain.isSettled()` |
| `VM_EMISSION` | 500 | Each emitted action (`emit.send()`, `emit.mint()`, etc.) |

The gas ceiling is **1,000,000** per execution. Gas metering is deterministic — based on code structure (AST injection), not wall-clock time.

### Deployment Gas

Deploying a contract charges: `VM_DEPLOY_BASE + (code_bytes * VM_DEPLOY_PER_BYTE)`. If the contract has a constructor, the constructor's metered gas is added to the deployment gas. The caller pays the total even if the constructor fails.

### Execution Gas

Executing a contract charges the actual gas consumed during the VM execution (minimum `VM_EXECUTE_BASE`). Failed executions (reverts, out of gas) still charge gas up to the failure point — this prevents free probing.

### Gas Fee Conversion

Gas is converted to XCHAIN fees via the gas price: `fee = gas_used * GAS_PRICE`. The gas price is a protocol parameter configured per chain.

## Acquiring XCHAIN

XCHAIN can be acquired the same way as any other XChain token — through transfers, dispensers, or the order book. The GAS address distributes initial XCHAIN supply, and the secondary market determines availability and price.

---

*See also: [Tokens](./TOKENS.md) | [Ledger](./LEDGER.md) | [Security Model](./SECURITY_MODEL.md) | [Smart Contracts](./SMART_CONTRACTS.md)*

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
