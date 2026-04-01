# The XChain Metalayer

XChain is a **metalayer protocol** — a system that reads and writes structured data on existing blockchains without changing how those blockchains work. The underlying coin nodes (Bitcoin, Litecoin, Dogecoin) are completely standard, unmodified, and unaware that XChain exists. XChain reads their data and applies its own rules on top.

## What a Metalayer Is

A metalayer treats a blockchain as an immutable, ordered append-only log. Each block is a batch of entries; the order of transactions within a block determines the order of operations. The metalayer protocol defines how to embed its own messages in that log, and how to interpret them.

The coin network provides:
- A globally consistent, tamper-resistant record of which transactions happened and when
- A censorship-resistant broadcast mechanism (the mempool)
- Consensus — no XChain-specific validators or stakers required

XChain provides:
- A message format embedded in standard transactions
- Rules for how those messages change token state
- The indexing infrastructure to read and execute them

The two layers are completely independent. XChain transactions are valid Bitcoin (or Litecoin or Dogecoin) transactions in every sense — they move coins, pay miner fees, and appear in any standard block explorer. They just happen to carry extra data that XChain nodes know how to read.

## Comparison to Other Approaches

**Sidechains** create a separate blockchain with its own consensus, linked to the main chain via a bridge. Funds must be locked on the main chain to mint equivalent assets on the sidechain. Security depends on the bridge — a critical failure point. XChain has no bridge and no separate chain.

**Layer 2 rollups** batch off-chain transactions and periodically commit state roots to the main chain. State exists primarily off-chain; the main chain only sees summary commitments. XChain does the opposite — every action is on-chain, and the main chain is the only source of truth.

**Smart contract platforms** embed programmable logic directly in the chain's consensus layer. Code runs on the chain's VM. This is powerful but constrains you to chains that support it, introduces smart contract risk, and requires the chain to be upgraded to add new capabilities. XChain runs entirely outside the chain's VM.

**Other metalayer protocols**: XChain is in the same family as Counterparty (on Bitcoin) and Omni (on Bitcoin). Like those protocols, XChain embeds data in standard transactions and interprets it with an off-chain indexer. XChain extends this family with native multi-chain support, a broader action vocabulary, and modern infrastructure.

## How It Works

Every XChain operation follows this path:

1. **Construct**: A client (or the SDK) builds an ACTION string — a pipe-delimited command like `SEND|0|MYTOKEN|100|1ReceiverAddress`.
2. **Encode**: The ACTION string is obfuscated and embedded in a standard transaction. See [Encoding](./ENCODING.md) for the details.
3. **Broadcast**: The transaction is submitted to the coin network's mempool exactly like any other transaction.
4. **Mine**: Miners include it in a block. They see a normal transaction and process it normally.
5. **Decode**: XChain decoder nodes poll the coin node via JSON-RPC, scan every transaction in every block, and extract embedded payloads that match the XChain magic prefix.
6. **Index**: The indexer validates the decoded ACTION against current state (balances, permissions, locks) and, if valid, executes it — updating token balances, order books, escrows, and all related state.
7. **Query**: Clients read state from the explorer API, which reads from the indexer's database.

The coin node never executes step 5 or beyond. It simply stores the transaction. XChain nodes do all the interpretation themselves.

## Benefits of the Metalayer Approach

**Inherited security**: XChain transactions have the same finality and immutability guarantees as the underlying blockchain. A 6-confirmation XChain transfer is as final as a 6-confirmation BTC transfer. No XChain-specific consensus needs to be secured.

**No new validators**: There are no XChain miners, stakers, or block producers. The coin network's miners secure the ordering of XChain operations for free, as a side effect of securing the coin network itself.

**Chain-agnostic**: The same ACTION vocabulary works on Bitcoin, Litecoin, and Dogecoin today. Adding another Bitcoin-compatible chain is a configuration change, not a protocol change.

**Permissionless verification**: Anyone can run an XChain node, replay the entire blockchain from genesis, and arrive at exactly the same state as every other node. There is no privileged indexer, no trusted oracle for token balances, and no central authority for token operations.

**Familiar transactions**: XChain transactions are valid coin transactions. They work with standard wallets, standard block explorers, and standard coin infrastructure. No special tooling is required to broadcast or store them.

## Determinism and Independent Verification

XChain indexers are fully deterministic: given the same blockchain data, every indexer produces identical state. This is the platform's core trust property. It means:

- Any party can independently verify any token balance or transaction history
- Disputes are resolved by checking the blockchain, not by trusting any specific service
- Running your own node gives you first-party data, not a copy of someone else's

Determinism is enforced through strict processing rules: actions in the same block are processed in transaction order (and input order within a transaction), all arithmetic uses arbitrary-precision integers, and the indexer validates the same invariants after every block regardless of who is running it.

## Adding New Chains

Because XChain is a metalayer, adding support for a new Bitcoin-compatible chain requires only a configuration file defining:

- Network parameters (address format, BIP32 paths)
- Fee schedule (XCHAIN amounts for each action type)
- Special addresses (GAS, BURN, DONATE1, DONATE2)
- Activation block heights

No changes to the core protocol or any service code are required. The same decoder, indexer, and explorer logic runs on every chain.

## What the Coin Node Does and Does Not Know

A standard `bitcoind` (or `litecoind`, `dogecoind`) running alongside XChain services:

- **Sees**: Normal transactions with outputs spending to standard address types or containing `OP_RETURN` data
- **Does not see**: XChain token balances, ACTION semantics, or any XChain state
- **Provides**: Block data via JSON-RPC (`getblock`, `getrawtransaction`, etc.)
- **Does not provide**: Any XChain-specific API — all of that comes from the XChain services

The coin node requires no patches, plugins, or configuration changes. A fully synced mainnet node is all that is needed.

---

*Next: [Actions](./ACTIONS.md) — how the 19 ACTION commands drive every state change on the platform.*
