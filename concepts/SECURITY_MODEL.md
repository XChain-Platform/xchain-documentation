# Security Model

XChain's security properties come from several sources: the underlying blockchain, protocol-level rules enforced by the indexer, and implementation-level safeguards in the service code. Understanding which guarantees come from where helps set accurate expectations for what the platform can and cannot promise.

## Data Integrity

**Deterministic processing**: Every indexer that processes the same blockchain data produces identical state. There are no random elements, no timestamp-dependent branching, and no external inputs to ACTION processing beyond the blockchain itself. This means anyone can independently verify any claimed state by running their own node.

**Atomic block transactions**: All database writes for a single block are committed in a single database transaction. Either the entire block is applied, or none of it is. A crash mid-block leaves the database in its pre-block state, ready to re-process cleanly.

**Sanity checks after every block**: After processing each block, the indexer verifies that total supply equals net ledger credits minus debits for every active token. A mismatch is treated as a fatal invariant violation — processing halts and the block is rolled back. No inconsistent state is ever persisted.

**Reorg handling**: When the decoder detects a chain reorganization (the canonical chain tip has changed), it records the fork point and signals the indexer. The indexer rolls back all affected data across every relevant table atomically, recalculates state from the fork block, and re-indexes forward. The UTXO tracker maintains 10 blocks of undo history for the same purpose.

## Protocol Safety

**Balance validation**: Every transfer validates that the sender's available balance (total balance minus escrows) is sufficient before any state change. There is no optimistic execution — validation and execution are atomic.

**Escrow accounting**: Tokens locked in orders, dispensers, or swap offers are tracked in escrow entries, not as floating balances. The available balance formula accounts for escrows explicitly. Double-spending an escrowed balance is not possible.

**Permission enforcement**: Allow lists, block lists, SLEEP periods, mint restrictions, and callback conditions are all checked before execution. An ACTION that fails any check is recorded as failed but does not modify state.

**Replay protection**: Every valid ACTION is assigned a sequential `ACTION_INDEX`. Subsequent actions that reference prior actions by index can only reference actions that exist at a lower index — forward references are invalid. An ACTION cannot be replayed: it exists at exactly one position in the blockchain and is processed exactly once.

**Fee enforcement**: ACTIONs that require XCHAIN fees are rejected if the fee cannot be paid. Fee validation runs before any other state change in the ACTION.

## What Is and Is Not Decentralized

**Decentralized**: Anyone can run an XChain node (decoder + indexer + explorer) and independently compute the full state of the protocol. No permission is required. No central authority controls which tokens exist, who holds what, or whether a transfer is valid — those are all determined by the blockchain data and the protocol rules.

**Currently centralized**: The xchain-hub provides configuration data (fee schedules, special addresses, protocol parameters) to services. It also coordinates cross-chain swaps. These functions depend on hub availability and, in the current implementation, hub trustworthiness for configuration accuracy. Plans for decentralizing hub functions — including on-chain configuration and multi-party swap coordination — are documented in [`../architecture/`](../architecture/).

Users who run their own full stack (all services including their own hub) are not dependent on any central hub instance.

## Network Security

The service layer applies standard web security practices:

- **Helmet**: HTTP security headers on all REST endpoints
- **CORS**: Configurable origin restrictions
- **SSL/TLS**: Available for all inter-service and client-facing communication
- **Circuit breakers**: Prevent cascading failures when downstream services are unavailable
- **Rate limiting**: Configurable per endpoint to limit abusive request patterns

## SQL Injection Protection

The indexer and explorer use raw parameterized SQL (no ORM) with the `mariadb` Node.js package. All user-supplied values — addresses, tickers, amounts, action indices — are passed as query parameters, never interpolated into SQL strings.

Rollback operations (during reorg handling) use a hardcoded whitelist of table names. The table name in a rollback DELETE is never taken from external input — it is selected from a known-valid list. This prevents a class of second-order injection attacks targeting the rollback path.

## Obfuscation Is Not Encryption

The AES-128-CTR applied to ACTION payloads before embedding in transactions is **obfuscation only**. The key is derived from the spending transaction's first input txid — which is fully public once the transaction is broadcast. Any party who knows the XChain algorithm can decrypt any payload by looking up the txid.

The purpose is to prevent naive keyword scanning of the blockchain for XChain data, not to provide confidentiality. All XChain ACTION data should be treated as fully public. If confidential communication is needed, the `MESSAGE` ACTION supports ECDH key exchange and AES encryption at the application level, where keys are managed by the communicating parties — but even that provides message confidentiality, not metadata confidentiality.

## Trust Model Summary

| Property | Provided by |
|---|---|
| Transaction ordering and finality | Underlying blockchain (Bitcoin, Litecoin, Dogecoin) |
| Token state correctness | Deterministic protocol rules + sanity checks |
| Balance integrity | Double-entry ledger + block-level verification |
| Independent verification | Anyone can run a full node |
| Configuration trustworthiness | Hub (currently centralized — see architecture docs) |
| Cross-chain swap coordination | Hub (currently centralized — see architecture docs) |
| Network transport security | TLS + Helmet + CORS |
| SQL safety | Parameterized queries + table whitelisting |

---

*See also: [Metalayer](./METALAYER.md) | [Ledger](./LEDGER.md) | [Encoding](./ENCODING.md) | [Cross-Chain](./CROSS_CHAIN.md)*
