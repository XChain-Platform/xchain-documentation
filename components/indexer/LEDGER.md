<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Indexer — Ledger System

The indexer maintains a double-entry ledger for all token movements.

## Credits

A credit is created whenever tokens are added to an address. This includes:

- Receiving a SEND
- Minting new tokens
- Receiving dividends
- Receiving an airdrop
- Receiving from a dispenser
- Receiving escrow releases

## Debits

A debit is created whenever tokens are removed from an address. This includes:

- Sending tokens
- Destroying tokens
- Paying fees
- Funding dispensers
- Placing DEX orders

## Escrows

An escrow is created when tokens are locked for pending operations. This includes:

- Placing DEX orders (tokens held until matched or expired)
- Funding dispensers (tokens held until dispensed or closed)
- Cross-chain swaps (tokens held until matched or expired)

## Balance Calculation

Address balances are computed from the ledger:

```
balance = SUM(credits) - SUM(debits)
```

Escrows are tracked separately and do not affect the balance formula but are subtracted from the available balance for new operations.

## Sanity Check

After every block, the indexer verifies that for every token:

```
token_supply = SUM(credits) - SUM(debits)
```

If this check fails, it indicates a bug in the indexer logic. The sanity check runs within the block's database transaction, so a failure rolls back the entire block.

## Contract Derived Addresses

Contracts hold tokens via **derived addresses** in the format `C:<CHAIN>:<action_index>` (e.g., `C:BTC:500`). These addresses are stored in `index_addresses` and tracked in the standard `balances` table — there is no separate `contract_balances` table.

- **DEPOSIT**: Debits the sender's address balance and credits the contract's derived address. Both entries appear in the standard `credits`/`debits` tables.
- **WITHDRAW**: Debits the contract's derived address and credits the owner. Standard ledger entries.
- **Emitted actions** (from EXECUTE): The contract's derived address is used as SOURCE. A contract emitting `emit.send()` creates standard credits/debits — the existing send handler sees the derived address as any other address.

This means contract token movements are covered by the standard sanity check (`token_supply == SUM(credits) - SUM(debits)`) and appear in the ledger hash. Rollback works identically to regular address balances — delete credits/debits at or after the reorg block, then recalculate.

## Gas Token (XCHAIN)

`XCHAIN` is the platform's gas token. It is used to pay fees for:

- **Token issuance**: Creating a new token costs `ISSUANCE_FEE_TOKEN` XCHAIN; creating a sub-token costs `ISSUANCE_FEE_SUBTOKEN` XCHAIN (pre-activation blocks)
- **DEX listings**: Orders, swaps, and dispensers with expiration periods beyond `EXPIRATION_FEE_FREE_DAYS` are charged `EXPIRATION_FEE_PER_DAY` XCHAIN per additional day (pre-activation blocks)
- **VM actions**: DEPLOY and EXECUTE charge gas via the unified gas schedule — `gas_cost × gas_price` XCHAIN per operation (post-activation blocks)
- **Staking actions**: STAKE, UNSTAKE, DELEGATE (rotate + revoke), and COLLECT are metered under the same unified gas schedule (post-activation blocks)

The GAS address (defined per-chain, per-network in `src/configs/<COIN>.js`) is the only address authorized to issue the `XCHAIN` token. It is exempt from the reserved ticker restriction that prevents other addresses from using protocol-reserved names.

## Fee Distribution

Fee payments are recorded in the `fees` table as debits from the source address with credits split between the `DONATE1` (protocol development) and `DONATE2` (community development) addresses.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
