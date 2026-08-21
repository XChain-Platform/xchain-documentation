<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Key Terms

A reference glossary of XChain terminology, organized by category.

---

## Protocol

**ACTION**: A command embedded in a blockchain transaction that instructs the XChain indexer to perform an operation, such as issuing a token, sending a balance, or placing an order. All XChain operations are expressed as one of 36 named ACTIONs.

**ACTION_INDEX**: A unique sequential integer assigned to every valid XChain ACTION transaction, in the order it was confirmed on-chain. Many actions reference prior actions by their ACTION_INDEX (e.g., an ORDER references the action that created the token being sold).

**actionString**: The serialized pipe-delimited representation of an ACTION before it is encoded into a transaction. Format: `ACTION|VERSION|FIELD1|FIELD2|...`

**BATCH**: An ACTION that bundles multiple sub-actions into a single blockchain transaction, joined with semicolons. Reduces on-chain fees by combining operations.

**encoding type**: The method used to embed ACTION data in a transaction. The encoder accepts `OP_RETURN` (up to 80 bytes per output, 76 bytes user data + 4-byte XCHN prefix), `P2SH`, `P2WSH`, `MULTISIGN`, `TAPROOT`, and `AUTO`. `P2SH` and `P2WSH` carry larger payloads with a two-transaction funding-then-reveal pattern, up to the 8,192-byte compiled ceiling every legacy encoding shares. Payloads beyond that need the opt-in `TAPROOT` envelope, a commit/reveal transaction pair carrying up to 390,000 bytes, on chains and signers that support Taproot. `AUTO` is not a carrier: it asks the encoder to pick the smallest-footprint carrier the network and signer support, and can resolve to `TAPROOT`.

**magic prefix**: The 4-byte string `XCHN` that appears at the start of every decoded XChain payload, used to identify XChain transactions.

**MEMO**: An optional free-text annotation that can be attached to many actions. Always the last field in an action format string.

**metalayer**: A protocol that runs above an existing blockchain without modifying it. XChain is a metalayer on Bitcoin, Litecoin, and Dogecoin.

**obfuscation**: The process of scrambling XChain payload data using AES-128-CTR before embedding it in a transaction. The key and IV are derived from the first input's txid. Obfuscation prevents accidental filtering by blockchain infrastructure; it is not encryption; the data is fully readable by any XChain node.

**pipe-delimited**: The format used to serialize ACTION data, with fields separated by the `|` character.

**PSBT**: Partially Signed Bitcoin Transaction. The standard format for unsigned or partially signed transactions on Bitcoin-family chains. XChain's encoder produces PSBTs that the caller signs with their wallet and broadcasts.

**TICK**: A token ticker symbol, up to 250 characters. Cannot contain `|`, `;`, or `/`, and cannot begin with `^`. A period (`.`) is allowed and is reserved as the parent/child sub-token separator (e.g. `MYTOKEN.SILVER`), but a TICK cannot begin or end with one. Used to identify tokens throughout the protocol. When referencing a token by its numeric ID instead of its ticker, prefix with `^` (e.g., `^1234`).

**TICK_ID**: The numeric ACTION_INDEX of the ISSUE action that created a token. An alternative way to reference a token that is stable even if the ticker is changed.

**VERSION**: An integer suffix on each ACTION format that identifies which set of fields the action uses. Newer versions add fields; older versions remain valid so existing software continues to work.

---

## Components

**decoder**: The `xchain-decoder` service. Polls the coin node for new blocks, extracts XChain payloads from transactions, and writes raw decoded actions to the decoder MariaDB database. Does not validate ACTION logic.

**encoder**: The `xchain-encoder` service. Takes an ACTION string and wallet parameters (public key, UTXOs) and produces a PSBT ready for signing and broadcast.

**explorer**: The `xchain-explorer` service. Provides a web UI, 200+ REST endpoints, and JSON-RPC API for querying indexed XChain data (tokens, balances, orders, dispensers, etc.).

**hub**: The `xchain-hub` service. A decentralized config oracle, price oracle, and cross-chain coordinator backed by MariaDB. Validators form a P2P gossip network with PBFT consensus. Other services fetch their configuration from the hub on startup.

**indexer**: The `xchain-indexer` service. Reads the decoder database, validates each ACTION according to protocol rules, and writes the resulting state (balances, orders, dispensers, etc.) to the indexer MariaDB database. Maintains 100+ tables.

**xchain-node**: The CLI orchestrator tool. Installs, starts, stops, updates, and monitors all XChain services as Docker containers. The entry point for node operators.

**xchain-regtest-miner**: A service that automatically mines pending mempool transactions in regtest environments, producing instant block confirmations for development and testing.

**xchain-sdk**: The developer SDK for the XChain platform. Provides methods for all 31 developer-invocable actions, 100+ explorer query methods, a batch builder, PSBT generation, and typed error classes.

**xchain-utxo-tracker**: A service that indexes all UTXOs from the coin node into LevelDB. Used by the encoder to look up available UTXOs for a given address.

---

## Token Management

**AIRDROP**: An ACTION that distributes tokens to a list of recipients in a single transaction.

**BURN address**: A well-known address with no known private key (e.g., the all-zeros address). Sending tokens to a burn address permanently removes them from circulation.

**CALLBACK**: An ACTION that allows a token issuer to reclaim tokens from all holders at a specified price after a given block height. Used for structured financial instruments with redemption features.

**decimals**: The number of decimal places a token supports, from 0 (indivisible) to 18. Stored and computed as integers; the decimal point is implied.

**DESTROY**: An ACTION that permanently removes a specified amount of tokens from the broadcaster's balance, reducing the circulating supply.

**DIVIDEND**: An ACTION that distributes one token proportionally to all holders of another token, based on their share of the total supply.

**ISSUE**: The ACTION that creates a new token or updates an existing token's parameters. Defines the ticker, maximum supply, decimal places, mint supply, description, and many other parameters.

**LINK**: An ACTION that associates an address or token with an external URL or resource identifier.

**LIST**: An ACTION that creates a named list of addresses or tickers that can be referenced as an allow list or block list in other actions (e.g., restricting who can mint a token).

**allow list**: A LIST referenced by a token that restricts minting and transfers to only the addresses on the list. Both the sending and the receiving address of a transfer are checked, so an address that is not listed can neither send nor receive the token.

**block list**: A LIST referenced by a token that prevents the listed addresses from sending or receiving transfers, or participating in minting.

**maxSupply**: The maximum total supply of a token. Once this amount has been minted, no further MINT actions are valid for that token.

**MINT**: An ACTION that creates new token supply and credits it to the broadcasting address. The minter chooses the AMOUNT on each MINT; it is capped per transaction by maxMint, cumulatively per address by mintAddressMax, and overall by the token's maxSupply.

**mintSupply**: The amount of supply issued straight to the issuing address at ISSUE time (default 0), not the amount a public MINT produces.

**SLEEP**: An ACTION that suspends another action (such as a dispenser or order) from a start block until an end block, temporarily deactivating it without cancelling it.

**SWEEP**: An ACTION that transfers the entire token balance of the broadcasting address to a destination address in a single operation.

---

## Trading

**DEX**: Decentralized Exchange. XChain has a native DEX built into the protocol via the ORDER action. Trades settle on-chain without a central custodian.

**DISPENSER**: An ACTION that creates a vending-machine style sale: anyone who sends a specified amount of one token to the dispenser address automatically receives a defined amount of another token in return.

**escrow**: Tokens locked by the protocol to back an open order or dispenser. Escrowed tokens are unavailable to the holder until the order or dispenser is cancelled or filled.

**ORDER**: An ACTION that places a sell order on the built-in DEX. Specifies the token being sold, the price, and the quantity. Buyers fill orders by sending payment.

**SWAP**: An ACTION that enables atomic cross-chain token exchanges, trading a token on one blockchain for a token on another, without a bridge or custodian.

---

## Ledger

**balance**: The amount of a specific token held at an address, as maintained by the indexer.

**credit**: An addition to an address's token balance, recorded as a positive ledger entry. Produced by MINT, SEND (destination), AIRDROP, and similar actions.

**debit**: A reduction of an address's token balance, recorded as a negative ledger entry. Produced by SEND (source), DESTROY, SWEEP, and similar actions.

**ledger**: The indexer's record of all credits and debits for every address and token. The current balance is computed from the sum of all ledger entries.

**sanity check**: A validation step in the indexer that verifies an action is consistent with the current ledger state before applying it (e.g., confirming the sender has sufficient balance before processing a SEND).

---

## Addressing and Messaging

**ADDRESS**: An ACTION that sets per-address configuration preferences, such as requiring a memo on all incoming transfers or choosing what happens to an XCHAIN-balance protocol fee (destroyed, or donated to protocol development).

**BROADCAST**: An ACTION with multiple modes: plain messages, oracle data feeds, prediction market questions, and feed result publication. Used for on-chain data publication.

**FILE**: An ACTION that stores a larger data payload on-chain, referenced by hash. Supports token-gated cryptographic publishing via three optional fields appended to format 0 (see **gated FILE** below).

**gated FILE**: A `FILE` action whose `GATE_TICKER` field is non-empty. The raw file data is ciphertext (AES-256-GCM); only holders of `GATE_TICKER` receive the symmetric key (via ECIES `MESSAGE`) and can decrypt. Published only by the token's issuer. See [Token-Gated Content](../protocol/token-gated-content.md).

**KEY_HASH**: The hex `sha256` of a gated file's symmetric key. Stored on the `FILE` action so holders can verify the key they receive in a `MESSAGE` handoff matches the file they're decrypting. Also serves as the implicit pack identifier: two or more gated FILEs sharing the same `KEY_HASH` are pack members and unlock together.

**Key Handoff**: The act of delivering a gated file's symmetric key to a token holder via an ECIES-encrypted `MESSAGE`. Sent by the issuer at publish time (to themselves, for recoverability) and by the current holder to every new holder as part of every transfer (`BATCH(SEND, MESSAGE)`).

**MESSAGE**: An ACTION that stores a short arbitrary message permanently on the blockchain. Supports plaintext, ECDH session, AES pre-shared, and ECIES (encrypted to a recipient address's pubkey). ECIES MESSAGEs carry [token-gated content](../protocol/token-gated-content.md) key handoffs.

**Pack**: A group of token-gated files sharing the same `KEY_HASH` and `GATE_TICKER`. Pack membership is implicit in the shared key hash; the protocol does not have a separate "pack" ACTION or table. Holders unlock the entire pack atomically with one key. Optionally surfaced in TIS via `pack_id` on file entries and a top-level `packs` display map.

**Token Gating**: Restricting access to content or capability based on whether an address holds a specific token. XChain supports cryptographic token gating for files (see **gated FILE**) and access-control patterns for off-chain systems via signed-challenge verification.

---

## Validator and System Actions

These five ACTIONs are written by the validator federation or synthesized by the indexer. They are not user-broadcast and are not exposed in the SDK.

**ANCHOR**: A validator-broadcast ACTION that commits a quorum-signed state checkpoint (per-block ledger, actions, and contract hash triple) to the anchor chain (DOGE on all networks). Later versions also archive cross-chain match records and SPV light-client roots on-chain. ANCHOR is what allows light clients to verify indexer state against a threshold of validator signatures without trusting a single operator.

**ATTEST**: A lifecycle ACTION with three phases. Version 0 is VM-emitted when a smart contract calls `xchain.attestation.request(...)`, requesting an external data fetch (an HTTPS URL or an AI model prompt). Version 1 is validator-broadcast and carries the quorum-verified response plus validator signatures. Version 2 is system-synthesized by the indexer when the request deadline expires without a quorum response.

**NODEPROOF**: A validator-broadcast ACTION that records a quorum-signed verdict proving which validators correctly answered a periodic block-data possession challenge, confirming they operate a real coin full node rather than relying on mirrored databases. Valid on BTC only (with extension to other chains planned).

**SLASH**: A permissionless ACTION that burns an equivocating validator's entire capability bond. Anyone who catches a validator signing two conflicting values for the same consensus slot can submit the two signed messages as a SLASH proof. If the proof is valid, the offender's stake is burned in place; the submitter receives a governance-configured bounty from the burned amount.

**XCALL**: A VM-emitted ACTION that lets a smart contract on one chain call a method on a contract deployed on a different chain, then receive the result through a callback method. The cross-chain relay is performed by the validator federation with no extra on-chain transaction. Version 2 is system-synthesized when the call expires before a result arrives.

---

## Governance

**VOTE**: A user-submittable, on-chain ACTION that casts a token-weighted ballot on a governance poll. Distinct from the hub validator network's own off-chain PBFT voting (used to approve configuration changes); VOTE is how token holders themselves vote on-chain.

---

## Infrastructure

**coin**: The native currency of an underlying blockchain: BTC on Bitcoin, LTC on Litecoin, DOGE on Dogecoin. Coins pay miner fees and can pay XChain protocol fees; they are distinct from tokens, which are created and tracked by the XChain protocol itself.

**GAS address**: A designated address (per chain, defined in each indexer's configuration) that is authorized to issue the XCHAIN gas token. The GAS address is exempt from the reserved ticker restriction that would otherwise block `XCHAIN` issuance.

**XCHAIN**: The platform gas token. Actions that write to the indexer database charge fees in XCHAIN. The fee amount and GAS address are configurable per deployment.

**reorg (chain reorganization)**: A blockchain event where a previously confirmed block is replaced by a competing chain of greater proof-of-work. The XChain decoder and indexer detect reorgs and roll back their state to the reorg block before re-indexing from that point.

**bootstrap**: A pre-built database snapshot that allows a new node to start from a recent block height instead of parsing the entire blockchain from genesis. Dramatically reduces initial sync time.

---

## Databases

**decoder database**: A MariaDB database populated by the decoder service. Contains raw decoded XChain transactions as extracted from blocks, before validation. Named `XChain_{CHAIN}_{NETWORK}_Decoder` (e.g., `XChain_BTC_Mainnet_Decoder`).

**indexer database**: A MariaDB database populated by the indexer service. Contains validated, processed XChain state: token records, balances, orders, dispensers, etc. Named `XChain_{CHAIN}_{NETWORK}_Indexer` (e.g., `XChain_BTC_Mainnet_Indexer`).

**LevelDB**: A key-value store used by xchain-utxo-tracker for fast local storage. Does not require a separate database server.

**Token Information Standard (TIS)**: A JSON schema defined by XChain for associating rich metadata (images, descriptions, links) with tokens. Token projects publish a TIS-compliant JSON file at a well-known URL that the explorer can discover and display.

---

## Networks

**mainnet**: The live production blockchain network. Transactions cost real money. XChain tokens on mainnet have real value.

**testnet**: A public blockchain test network where coins have no real value. Suitable for testing with a realistic block confirmation time.

**regtest**: A local blockchain mode where the operator controls block production. Blocks are mined on demand, coins have no value, and the chain can be reset at will. The recommended environment for XChain development.

**OP_RETURN**: A Bitcoin script opcode that marks a transaction output as provably unspendable. XChain uses it to embed ACTION data in a transaction output (up to 80 bytes per output: 76 bytes of user data plus a 4-byte XCHN prefix) without creating a spendable UTXO.

**P2SH**: Pay-to-Script-Hash. A Bitcoin transaction type that XChain uses for larger ACTION payloads (over 76 bytes of user data) that don't fit in OP_RETURN. Uses a two-transaction pattern: a funding transaction, then a spend that reveals the data.

**P2WSH**: Pay-to-Witness-Script-Hash. The SegWit equivalent of P2SH. Used by XChain for large payloads on chains that support SegWit.

**multisig**: Multi-signature. A Bitcoin transaction type that XChain can use to embed ACTION data by encoding it in the public keys of a multisig output.

**UTXO**: Unspent Transaction Output. The fundamental unit of value on Bitcoin-family chains. Each UTXO represents a discrete amount of coin that can be spent as the input to a new transaction.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
