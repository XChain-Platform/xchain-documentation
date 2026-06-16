<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# The Double-Entry Ledger

Every token movement on the XChain Platform is recorded in a double-entry accounting ledger. No balance is ever simply set; it is always derived from a history of credits, debits, and escrows. This design makes token state auditable, rollback-friendly, and self-verifying.

## Three Entry Types

**Credits**: tokens added to an address's balance. Minting creates a credit. Receiving a transfer creates a credit. A fulfilled buy order creates a credit when the purchased tokens are delivered.

**Debits**: tokens removed from an address's balance. Sending tokens creates a debit. Destroying tokens creates a debit. Paying fees creates a debit.

**Escrows**: tokens locked in a pending operation. Placing an order escrows the tokens being sold. Opening a dispenser escrows the tokens for sale. Initiating a cross-chain swap escrows the offered tokens. Escrows are released (converted to debits or credits depending on outcome) when the operation completes or is cancelled.

## Balance Formula

An address's **total balance** for a token is:

```
total_balance = SUM(credits) - SUM(debits)
```

An address's **available balance** (usable for new operations) is:

```
available_balance = total_balance - SUM(active_escrows)
```

Available balance is what the validation layer checks before allowing any transfer or trade.

## Every Operation Creates Matching Entries

No operation touches a balance without a ledger entry. Examples:

**SEND**: sender gets a debit, receiver gets a credit. Both entries reference the same ACTION_INDEX. The two sides always sum to zero change in total supply.

**ORDER (sell side)**: the seller gets a debit and a corresponding escrow entry. The tokens are locked in escrow until the order is filled or cancelled. When filled, the buyer gets a credit and the seller's escrow is released. When cancelled, the escrow is released back to the seller as a credit.

**ORDER with native coin (two-phase settlement)**: when one side of a trade is native coin (BTC/LTC/DOGE), the indexer cannot settle both sides instantly. Token escrow occurs normally for the token-selling side, but no escrow occurs for the native coin side (the indexer can't hold native coin). On ORDER_MATCH, a COINPay obligation is created instead of instant credits. Tokens remain escrowed until the coin-offering party sends a COINPAY transaction, which triggers the escrow release and credit to the buyer. If the COINPAY obligation expires unfulfilled, the escrowed tokens are released back to the seller.

**MINT**: a new credit entry is created for the minting address. No corresponding debit; this is how new supply enters circulation.

**DESTROY**: a debit is created for the burning address. No corresponding credit. This is how supply is permanently removed.

**DIVIDEND**: one debit from the paying address, one credit for each holder, proportional to their balance. All entries reference the same action.

## Block-Level Sanity Checks

After every block is processed, the indexer runs a sanity check for every token that was active in that block:

```
token_supply == SUM(all credits) - SUM(all debits)
```

If this equation does not balance, there is a bug, tokens have been created or destroyed without a corresponding ledger entry. The indexer treats this as a fatal error, logs it, and halts processing. The block is rolled back. No inconsistent state is ever written to the database.

This check runs automatically and continuously. It is not a periodic audit; it is a hard invariant enforced on every block.

## Why Double-Entry

**Auditability**: Every balance can be derived from scratch by replaying ledger entries. There is no "trust the number in the balance column"; the number is always provable from its history.

**Rollback safety**: When a reorg occurs and blocks must be rolled back, deleting the ledger entries from those blocks is sufficient to restore previous state. The balance formula recalculates automatically. There is no need to track "what the balance was before."

**Consistency**: The two-sided nature of every entry makes accidental supply creation or destruction immediately detectable. The sanity check catches it in the same block it occurs.

**DEX integrity**: Escrows make order book accounting transparent. At any time, the sum of all active escrows plus all available balances equals the total supply. Nothing is hidden in a matching engine buffer.

## Contract Derived Addresses

Smart contracts participate in the ledger through **derived addresses** in the format `C:<CHAIN>:<action_index>` (e.g., `C:BTC:500`). These addresses are created in `index_addresses` when a contract is deployed and function identically to regular addresses in the ledger:

- **DEPOSIT** creates a debit on the depositor and a credit on the derived address
- **WITHDRAW** creates a debit on the derived address and a credit on the owner
- **Emitted actions** (from EXECUTE) use the derived address as SOURCE; a contract emitting `emit.send()` creates a debit on the derived address and a credit on the recipient, the same as any SEND
- The standard `balances` table tracks contract token holdings via the derived address. There is no separate custody table.
- Contract token movements appear in the **ledger hash** (via standard credits/debits), while contract-specific state and executions appear in the **contract hash**

This means contracts are first-class participants in the double-entry ledger. The sanity check (`token_supply == SUM(credits) - SUM(debits)`) covers contract movements automatically.

## Detailed Implementation

For schema definitions, table layouts, and query patterns used in the indexer's ledger implementation, see [`../components/indexer/LEDGER.md`](../components/indexer/LEDGER.md).

---

*See also: [Tokens](./TOKENS.md) | [Security Model](./Security_Model.md) | [Smart Contracts](./Smart_Contracts.md)*

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
