<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

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

## Contract Balances

`contract_balances` is a materialized view of each contract's token holdings. It follows the same derivation pattern as the `balances` table:

```
contract_balance = SUM(deposits for contract+token) - SUM(withdrawals for contract+token)
```

- **DEPOSIT**: Debits the sender's address balance and credits the contract's balance. Recorded in the `deposits` table.
- **WITHDRAW**: Debits the contract's balance and credits the recipient (sender) address balance. Recorded in the `withdrawals` table.

`contract_balances` is never updated in place during normal processing — it is recomputed by the rollback handler from the remaining `deposits` and `withdrawals` rows after any records at or after the reorg block are deleted.

## Gas Token (XCHAIN)

`XCHAIN` is the platform's gas token. It is used to pay fees for:

- **Token issuance**: Creating a new token costs `ISSUANCE_FEE_TOKEN` XCHAIN; creating a sub-token costs `ISSUANCE_FEE_SUBTOKEN` XCHAIN (pre-activation blocks)
- **DEX listings**: Orders, swaps, and dispensers with expiration periods beyond `EXPIRATION_FEE_FREE_DAYS` are charged `EXPIRATION_FEE_PER_DAY` XCHAIN per additional day (pre-activation blocks)
- **VM actions**: DEPLOY and EXECUTE charge gas via the unified gas schedule — `gas_cost × gas_price` XCHAIN per operation (post-activation blocks)
- **Staking actions**: STAKE, UNSTAKE, DELEGATE, REVOKE_DELEGATION, and CLAIM_REWARDS are metered under the same unified gas schedule (post-activation blocks)

The GAS address (defined per-chain, per-network in `src/configs/<COIN>.js`) is the only address authorized to issue the `XCHAIN` token. It is exempt from the reserved ticker restriction that prevents other addresses from using protocol-reserved names.

## Fee Distribution

Fee payments are recorded in the `fees` table as debits from the source address with credits split between the `DONATE1` (protocol development) and `DONATE2` (community development) addresses.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
