<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Security Model

XChain's security properties come from several sources: the underlying blockchain, protocol-level rules enforced by the indexer, and implementation-level safeguards in the service code. Understanding which guarantees come from where helps set accurate expectations for what the platform can and cannot promise.

## Data Integrity

**Deterministic processing**: Every indexer that processes the same blockchain data produces identical state. There are no random elements, no timestamp-dependent branching, and no external inputs to ACTION processing beyond the blockchain itself. This means anyone can independently verify any claimed state by running their own node.

**Atomic block transactions**: All database writes for a single block are committed in a single database transaction. Either the entire block is applied, or none of it is. A crash mid-block leaves the database in its pre-block state, ready to re-process cleanly.

**Sanity checks after every block**: After processing each block, the indexer verifies that total supply equals net ledger credits minus debits for every active token. A mismatch is treated as a fatal invariant violation, processing halts and the block is rolled back. No inconsistent state is ever persisted.

**Reorg handling**: When the decoder detects a chain reorganization (the canonical chain tip has changed), it records the fork point and signals the indexer. The indexer rolls back all affected data across every relevant table atomically, recalculates state from the fork block, and re-indexes forward. The UTXO tracker maintains a per-chain undo window (BTC: 12 / LTC: 48 / DOGE: 120 blocks) for the same purpose.

## Protocol Safety

**Balance validation**: Every transfer validates that the sender's available balance (total balance minus escrows) is sufficient before any state change. There is no optimistic execution, validation and execution are atomic.

**Escrow accounting**: Tokens locked in orders, dispensers, or swap offers are tracked in escrow entries, not as floating balances. The available balance formula accounts for escrows explicitly. Double-spending an escrowed balance is not possible.

**COINPay security model**: When trading tokens for native coin (BTC/LTC/DOGE), the COINPAY action is an explicit ACTION; the payment is identified by referencing the ORDER_MATCH's ACTION_INDEX, not by scanning bare outputs. This eliminates ambiguity. Payment spoofing is not a concern: anyone can pay on behalf of the buyer (the tokens always go to the buyer's GET_ADDRESS). Late payment risk exists: if a COINPAY confirms after the obligation expires, the native coin reaches the seller but no tokens are released; the buyer loses their coin. This is an inherent risk of native UTXO-chain payments and is mitigated by prominent expiration warnings in the SDK and explorer. Reorg handling follows the standard pattern: COINPAY records are rolled back and re-indexed with all other tables.

**Permission enforcement**: Allow lists, block lists, SLEEP periods, mint restrictions, and callback conditions are all checked before execution. An ACTION that fails any check is recorded as failed but does not modify state.

**Replay protection**: Every valid ACTION is assigned a sequential `ACTION_INDEX`. Subsequent actions that reference prior actions by index can only reference actions that exist at a lower index, forward references are invalid. An ACTION cannot be replayed: it exists at exactly one position in the blockchain and is processed exactly once.

**Fee enforcement**: ACTIONs that require XCHAIN fees are rejected if the fee cannot be paid. Fee validation runs before any other state change in the ACTION.

## What Is and Is Not Decentralized

**Decentralized**: Anyone can run an XChain node (decoder + indexer + explorer) and independently compute the full state of the protocol. No permission is required. No central authority controls which tokens exist, who holds what, or whether a transfer is valid; those are all determined by the blockchain data and the protocol rules.

**Hub validator network**: The xchain-hub operates as a decentralized validator network. Validators form a P2P gossip mesh with PBFT consensus, Ed25519 identity, and Byzantine fault tolerance. Configuration writes, price oracle data, cross-chain attestations, and governance decisions all require a `max(2f+1, ceil((N+1)/2))` validator agreement (the majority term keeps a small federation from collapsing to a single signer). Users who run their own full stack (all services including their own hub validator) participate directly in the validator network and do not depend on any single hub instance. See [`../components/hub/`](../components/hub/) for full architecture details.

## Network Security

The service layer applies standard web security practices:

- **Helmet**: HTTP security headers on all REST endpoints
- **CORS**: Configurable origin restrictions
- **SSL/TLS**: Available for all inter-service and client-facing communication
- **Circuit breakers**: Prevent cascading failures when downstream services are unavailable
- **Rate limiting**: Configurable per endpoint to limit abusive request patterns

## SQL Injection Protection

The indexer and explorer use raw parameterized SQL (no ORM) with the `mariadb` Node.js package. All user-supplied values (addresses, tickers, amounts, action indices) are passed as query parameters, never interpolated into SQL strings.

Rollback operations (during reorg handling) use a hardcoded whitelist of table names. The table name in a rollback DELETE is never taken from external input; it is selected from a known-valid list. This prevents a class of second-order injection attacks targeting the rollback path.

## Obfuscation Is Not Encryption

The AES-128-CTR applied to ACTION payloads before embedding in transactions is **obfuscation only**. The key is derived from the spending transaction's first input txid, which is fully public once the transaction is broadcast. Any party who knows the XChain algorithm can decrypt any payload by looking up the txid.

The purpose is to prevent naive keyword scanning of the blockchain for XChain data, not to provide confidentiality. All XChain ACTION data should be treated as fully public. If confidential communication is needed, the `MESSAGE` ACTION supports ECDH key exchange and AES encryption at the application level, where keys are managed by the communicating parties; but even that provides message confidentiality, not metadata confidentiality.

## Trust Model Summary

| Property | Provided by |
|---|---|
| Transaction ordering and finality | Underlying blockchain (Bitcoin, Litecoin, Dogecoin) |
| Token state correctness | Deterministic protocol rules + sanity checks |
| Balance integrity | Double-entry ledger + block-level verification |
| Independent verification | Anyone can run a full node |
| Configuration trustworthiness | Hub validator network (PBFT consensus, `max(2f+1, ceil((N+1)/2))` agreement) |
| Cross-chain swap coordination | Hub validator network (PBFT consensus, cross-chain attestation) |
| Network transport security | TLS + Helmet + CORS |
| SQL safety | Parameterized queries + table whitelisting |

---

*See also: [Metalayer](./metalayer.md) | [Ledger](./ledger.md) | [Encoding](./encoding.md) | [Cross-Chain](./cross-chain.md)*

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
