<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Use Cases

XChain is a general-purpose token protocol. It does not prescribe what tokens are for; that is up to you. This guide explores the kinds of things people and organizations are building with it today, along with the kinds of things that become possible once you have programmable tokens living permanently on Bitcoin, Litecoin, or Dogecoin.

---

## Digital Assets and Collectibles

### Limited-Edition Collectible Tokens

Create a token with a fixed, locked supply (say, exactly 100 units) and distribute them to collectors. Because the max supply is locked on-chain, no one (including you) can ever create more. Buyers can verify the scarcity themselves without trusting your promises.

XChain actions involved: ISSUE (to create and lock the supply), SEND (to distribute to collectors).

### Community and Fan Club Tokens

Issue a token to represent membership in a community, fan club, or organization. Members who hold the token can be granted access to events, content, or voting rights. You can update who qualifies at any time by adjusting the allow list, or lock the membership rules permanently for a more formal structure.

XChain actions involved: ISSUE, LIST (to define eligible members), SEND (to distribute memberships).

### Digital Art and Media Tokens

Attach a piece of digital art or media to a token using on-chain file storage and linking. The FILE action stores content directly on the blockchain. The LINK action connects it to a token permanently. Together, they create an unalterable on-chain record of the artwork's existence at a specific point in time.

XChain actions involved: ISSUE, FILE (to store the content), LINK (to associate it with the token).

### Token-Gated Encrypted Content and Packs

Beyond public on-chain files, XChain supports **cryptographically secure token-gated publishing**. Encrypt a file (or a whole pack of files) and publish the ciphertext on-chain via the FILE action. Only holders of the gating token can decrypt; the symmetric key is delivered to each holder via an ECIES MESSAGE that the sender batches with a direct SEND. Anyone can see that the ciphertext exists; only holders who have been given the key can read it.

**What this enables:**

- **Sealed drops.** A creator can guarantee that no one. Not the indexer operators, not block explorers, not even early holders' nodes, has read the content until a holder unlocks. Useful for time-locked reveals, surprise releases, and "first-access" mechanics.
- **Packs.** Multiple files encrypted with the same key form a pack that unlocks atomically. An album of FLAC stems plus liner notes plus high-res cover art can all be published as one pack; owning the token unlocks every file at once.
- **Permanent, server-free distribution.** No download server, no key escrow, no DRM service. The creator publishes once and walks away; the blockchain stores the ciphertext, and the key handoff rides in the same transaction as a direct SEND, which the indexer requires whenever that transfer would leave the recipient able to unlock the content.
- **DEX-native paid downloads.** Sell the token via DISPENSER or ORDER. The key handoff is enforced on direct SENDs only, so a buyer who receives the token through a dispenser, an order or swap settlement, an AIRDROP, or a DIVIDEND gets the token *without* the key and needs it sent afterwards in a direct SEND. Plan a delivery step for any sale that does not go through a SEND.
- **Sell the whole pack, not just access.** Pair this with [Token Ownership Trading](#token-ownership-trading) below to sell the *entire issuance* of a gated pack to a single buyer, useful for selling a finished album to a label, transferring a research archive to a successor, or auctioning a complete sealed bundle.

Unlock is purely client-side; holders decrypt with their address private key, no on-chain transaction required. Trust model: this is a first-access lock, not DRM (a holder who decrypts has the bytes forever), and loss of the address key means loss of access.

XChain actions involved: ISSUE, FILE (with gating fields: GATE_TICKER, ENCRYPTION_METHOD, KEY_HASH), MESSAGE (v2 ECIES for the key handoff), SEND + MESSAGE in a BATCH for transfers. See [Token-Gated Content](../protocol/token-gated-content.md).

---

## Financial Instruments

### Loyalty Points and Rewards Programs

Issue loyalty points as tokens. Customers earn points (via SEND or AIRDROP), spend them in your store (via SEND back to your address), and accumulate them over time. Because balances live on the blockchain, they cannot be silently deleted or manipulated; customers own their points in the same way they own their coins.

XChain actions involved: ISSUE, SEND, AIRDROP.

### Gift Cards and Store Credit

Create a token representing store credit or a gift card. Issue it to a customer and they can spend it (transfer it to your payment address) at any time. You can optionally restrict the token to your own addresses using an allow list, so it cannot be sold or transferred elsewhere.

XChain actions involved: ISSUE, LIST, SEND.

### Revenue Sharing and Dividends

If your token has multiple holders and you want to pay them proportionally (like distributing profits to shareholders) the DIVIDEND action does this automatically. You specify the token representing shares, the payment token (which could be XCHAIN or any other token), and the amount per unit. Every holder receives their proportional cut in a single transaction.

XChain actions involved: ISSUE (to create the share token), DIVIDEND (to make distributions), SEND (for ongoing transfers).

### Public Distribution Tokens with Minting Windows

Set up a token with a defined minting window (a start block and a stop block) during which the public can mint the token themselves. Each minter chooses how much to mint in a given transaction, bounded by the caps you set on the token: an optional per-transaction cap (`MAX_MINT`), an optional per-address cap (`MINT_ADDRESS_MAX`), and the token's overall `MAX_SUPPLY`. This is a permissionless, on-chain distribution mechanism: anyone can mint directly from the blockchain during the window, with no intermediary and no allocation list. MINT carries no payment field and moves no funds to the issuer; it only creates the new supply and credits it to the minter. After the window closes or `MAX_SUPPLY` is reached, no more tokens can be created.

XChain actions involved: ISSUE (with mint window configuration), MINT (by the public during the window).

---

## Business Operations

### Supply Chain Tracking

Issue a token to represent a batch of goods. As the goods move through your supply chain (from manufacturer to warehouse to retailer) send the token to the address representing each stage. Every transfer is timestamped and permanently recorded on the blockchain. Disputes about "where were these goods and when" can be resolved by reading the ledger.

XChain actions involved: ISSUE (to create the batch token), SEND (to track movement between parties).

### Certificates and Credentials

Issue credential tokens to individuals: employees, students, licensed contractors. The blockchain record proves the credential was issued at a specific time by a specific issuing address. If a credential needs to be revoked, the CALLBACK action can recall all outstanding tokens, optionally paying a settlement token to each holder. Verifying a credential is as simple as checking whether the address holds the token.

XChain actions involved: ISSUE, SEND, CALLBACK (for revocation).

### Voting and Governance

Issue a governance token, distribute it to eligible participants, and run decisions with the VOTE action. A holder opens a poll by naming the governance token (which is both the electorate and the weight basis), the options, the block the poll closes on, and optional gates such as a quorum and a minimum number of voters. Holders then cast ballots. When the poll closes, the protocol measures each voter's weight from their on-chain holdings and tallies and finalizes the poll automatically, so nobody has to be trusted to count.

How weight is measured is your choice at poll creation: one vote per token held, one vote per address regardless of holdings, quadratic weighting to flatten large holders, or time-weighted holdings so a balance bought the day before the close does not carry a full vote. A holder can also delegate their voting weight to another address with a standing delegation. A poll can be made *binding*, meaning finalization calls a smart contract method with the result and the decision takes effect on-chain rather than needing someone to act on it. The token can be set up so that it cannot be sold or transferred to unregistered addresses, ensuring only eligible voters participate. See the [VOTE action spec](../protocol/actions/vote.md) for the full parameter set.

XChain actions involved: ISSUE (to create the governance token), LIST (for eligible voters), AIRDROP or SEND (to distribute it), VOTE (to create the poll, cast ballots, and delegate weight).

### Access Control and Token-Gated Systems

Build a system where access to a service, platform, or physical location requires holding a specific token. The user proves they own the token by signing a challenge message with their wallet; this cryptographically verifies they control the private key for the address holding the token. Once ownership is proven, your application checks their on-chain balance and grants or denies access.

**Examples of what you can gate:**

- **Music and audio**: listeners hold an artist's token to stream an album or access exclusive tracks
- **Written content**: readers hold a publisher's token to read e-books, articles, or research papers
- **Video and courses**: viewers hold a token to watch a film, access a course library, or join live streams
- **Software features**: a SaaS product checks for a token before unlocking premium tiers
- **Physical access**: a venue scanner verifies token ownership via QR code + signature at the door
- **Community spaces**: a Discord bot or forum checks token holdings before granting channel access

You control who can hold the token via allow lists, and you can revoke access across all holders at once by recalling the token using CALLBACK. For tokens that should never be resold or transferred (pure access credentials), use an ALLOW_LIST restricted to approved addresses so the protocol rejects transfers to unauthorized recipients. The rules are enforced by the blockchain, not by your server configuration.

XChain actions involved: ISSUE, LIST, SEND, CALLBACK.

For implementation details, including wallet ownership verification, session management, and code examples (see [Token-Gated Access](../developer-guide/integration-patterns.md#pattern-3-token-gated-access) in the Integration Patterns guide.

---

## Communication and Data

### On-Chain Messaging

Send messages to specific addresses that are permanently recorded on the blockchain. Messages can be plaintext (visible to anyone) or encrypted so only the recipient can read them. Unlike email or messaging apps, on-chain messages cannot be deleted, censored, or claimed to have never been sent.

XChain actions involved: MESSAGE.

### Document Notarization

Upload a document's content or cryptographic fingerprint on-chain using the FILE action. The blockchain timestamp proves the document existed in its current form at a specific point in time. This creates tamper-proof records of contracts, agreements, or any document where the time of existence matters.

XChain actions involved: FILE.

### Broadcast Oracles and Public Announcements

Use the BROADCAST action to publish data on-chain: price feeds, event results, announcements, or any information that needs a permanent, immutable record. Applications and services can read broadcasts from the explorer API and trust that the data has not been altered since it was published.

XChain actions involved: BROADCAST.

---

## DEX Applications

### Token Marketplaces

Create a token representing anything of value (event tickets, in-game items, real-world assets) and list it on the XChain DEX. Buyers and sellers find each other through the order book. The exchange is automatic, transparent, and available to anyone on the supported blockchains.

XChain actions involved: ISSUE, ORDER.

### Automated Sales via Dispensers

Set up a dispenser to sell your tokens 24 hours a day, without any manual involvement, at a fixed coin rate or at a fiat or token price. Buyers send the right amount and receive tokens automatically. This is ideal for token sales, fundraisers, or any scenario where you want continuous, reliable availability without running a backend server.

XChain actions involved: ISSUE, DISPENSER.

### Cross-Chain Arbitrage and Exchange

Trade tokens between the chains XChain runs on, today Bitcoin, Litecoin, and Dogecoin, using the SWAP action. This enables arbitrage between the same token type on different chains, or the exchange of value across chains for users who want to move their holdings from one blockchain ecosystem to another.

XChain actions involved: SWAP.

### Token Ownership Trading

A token has two separate things attached to it: the *balances* (who holds how much) and the *ownership* (who can update the token's settings, mint new supply, change the description, etc.). Until recently, only balances could be traded. Now you can sell ownership of an entire token on the DEX, atomically, with no off-chain trust.

**What this enables:**

- **Selling a finished project.** A creator who built a token, distributed it to holders, and now wants to step away can sell the issuer role outright. The buyer takes over future updates, the seller cashes out.
- **Selling a gated content archive.** Combined with [token-gated publishing](#token-gated-encrypted-content-and-packs), the issuer can sell the entire archive (keys, future republish rights, and everything) to a buyer in a single trade.
- **Brand or sub-token portfolios.** Sell a parent token together with the right to issue its sub-tokens, transferring an entire token namespace as one asset.
- **Auctioning a launched token.** Set up a dispenser that hands out the ownership role at a fixed price. The first buyer to send the asking amount becomes the new issuer.

Ownership transfer is atomic with the trade; there is no moment where the seller has the payment but the buyer doesn't yet have ownership.

XChain actions involved: ORDER, SWAP, or DISPENSER (each with the `GIVE_OWNERSHIP` / `GET_OWNERSHIP` flag).

---

## Prediction Markets and Betting

### Running a Market as an Oracle

Anyone can open a betting market on any question, with no permission, licence, or relationship with anybody. You set the question, a fixed list of between 2 and 16 outcomes, the token wagers are made in, your fee as a percentage of the pot (0% to 10%), the deadline when betting closes, and the resolve window you have after the deadline to publish the result (14 days by default). You can optionally set a minimum stake and restrict who may bet with membership lists.

The protocol charges you to create the market, priced by how long it lives; the first 90 days are free, so anything short-term costs nothing. After the deadline you publish the winning outcome and the protocol works out every payout, takes your fee, and credits everyone. You never distribute anything by hand, and resolving is free however many bets are on the book.

**What this enables:**

- **Event and sports markets.** Open a market on a match, an election, or an award, take a fee for settling it honestly, and let the participants find their own prices.
- **Community questions.** A token community runs markets in its own token on the questions it actually argues about, with the payouts denominated in that token.
- **Editorial and forecasting desks.** A publication or research group settles markets on the outcomes it already reports on, building a public record of how it resolved them.

You cannot bet on your own market from the market's own address, because you decide the result. There is no bonding or slashing of oracles either: your published history of markets resolved, cancelled and left to expire is the entire accountability mechanism, and it is per-address.

XChain actions involved: BET v0 (create the market), BET v3 (publish the result), BET v1 (cancel it, refunding everyone in full). If you never resolve, the protocol emits BET_EXPIRE at the end of the resolve window and refunds every wager automatically.

### Betting into a Market

XChain betting is parimutuel, the same system racetracks use: every wager goes into a shared pool, and when the result is published the losing wagers are split among the winners in proportion to what each staked. There is no bookmaker quoting you a fixed price, so the odds move as money arrives after you bet.

Your stake is escrowed by the protocol the moment you bet, not held by a company, and bets are final: there is no cancel and no edit. Your stake comes back in full, with no fee taken, if the oracle cancels the market, if nobody backed the winning outcome, or if the oracle never resolves within the window.

**What this enables:**

- **Betting without a counterparty.** There is no order book to fill against, so a wager never sits unmatched no matter how thin the market is.
- **Wagering in any token.** Markets are denominated in an XChain token rather than the coin, so a token can be the unit of account for the questions its holders care about.
- **Auditable settlement.** Every wager, the escrow, and the published result are on-chain, so anyone can replay the arithmetic on their own node.

XChain actions involved: BET v2 (place a wager on one outcome).

The full guide to both sides is [Betting](./betting.md), and the protocol reference is [`BET`](../protocol/actions/bet.md).

---

## Private Deployments

### Internal Company Networks

Organizations can run XChain on a private regtest network; a fully featured, fully isolated instance of the platform. Every action works identically to the public network. The organization controls the block production, the gas issuance, and the entire environment.

This is useful for internal asset management (tracking equipment, licenses, or internal credits), piloting blockchain applications before going to mainnet, and training teams on the platform without real-money risk.

XChain actions involved: All actions, in a controlled environment.

### Internal Asset Tracking

Run a private deployment where different departments hold addresses and tokens represent internal resources: project budgets, equipment units, license seats. Transfers between departments are recorded immutably. Audits become a matter of reading the ledger rather than reconciling spreadsheets.

XChain actions involved: ISSUE, SEND, AIRDROP, DIVIDEND.

### Internal Trading and Exchanges

A private XChain deployment can run its own DEX, letting internal departments or subsidiaries trade internal assets with each other at market-determined prices, without any external exposure and without relying on a centralized company database that can be edited.

XChain actions involved: ORDER, DISPENSER.

---

## Smart Contracts and Programmable Logic

XChain has a built-in smart contract layer that runs on top of every supported chain (Bitcoin, Litecoin, and Dogecoin today). Contracts are written in JavaScript, deployed permanently on the blockchain, and executed by the same nodes that process token transactions. There is no separate contract chain, no separate validator network, and no separate token to buy: your existing wallet, your existing balances, and your existing XCHAIN gas fees are all you need.

### Programmable Tokens

A smart contract on XChain can do what a person with a wallet can do: issue tokens, transfer balances, place orders, set up dispensers, send messages; but on a schedule or under conditions that you define in code.

- **Automatic token vesting**: tokens released to recipients on a schedule, without anyone needing to push a button on the date.
- **Automated market makers**: liquidity pools that price tokens continuously based on supply and demand, going beyond the fixed-price model of orders and dispensers.
- **Multi-condition escrow**: funds released only when several conditions are all met (time elapsed, multiple parties have approved, an outside event has occurred).
- **On-chain governance**: token-weighted voting where the result of the vote is executed by the contract itself, with no human in the middle.
- **Cross-chain automation**: contracts that coordinate actions across the chains XChain runs on simultaneously.

XChain actions involved: DEPLOY (to publish a contract), EXECUTE (to call a method on it), DEPOSIT and WITHDRAW (to move tokens in and out of the contract's custody), BATCH (to group multiple actions into one transaction; they execute in order and are *not* atomic, so if a later action fails the earlier ones still apply), and SLEEP (a contract can put its own token to sleep, pausing trading on the token for a defined window or indefinitely).

### AI-Powered Smart Contracts

A smart contract on XChain can ask a question of the outside world (including a large language model) and get a verified answer back, written to the blockchain by the validator network. The contract then continues running with the answer in hand. This is one of the most distinctive features of the platform: smart contracts can reason about the real world, not just the data already on the chain.

Here's how it works in plain terms. A contract calls a built-in function with a question: "what is the price of gold right now?", or "is this Twitter post in violation of community guidelines?", or simply "summarize this article in one sentence". The platform's validator network independently looks up the answer (each validator does it separately, so no single party controls the result), compares everyone's answers, and writes the agreed-upon answer back to the blockchain. The contract then receives the answer through a callback and decides what to do with it.

Two providers ship in the initial release:

- **Web data.** The contract supplies an HTTPS URL; validators each fetch it and the network agrees only if the responses match exactly. Good for any deterministic web endpoint: price APIs, government data feeds, sports results, public records.
- **Large language model.** The contract supplies a prompt; validators each ask an approved AI model (Claude Sonnet 4.6 or Claude Opus 4.7 at launch) and a separate judge model decides whether their answers are semantically equivalent. Good for tasks where exact byte-equality is impossible but human-equivalent agreement is enough.

**What this enables:**

- **AI-judged contests and competitions.** A contest contract receives entries, asks an AI to score or rank them, and distributes prizes automatically based on the AI's verdict.
- **Content moderation oracles.** A platform contract asks an AI whether content is in policy before paying out a creator royalty.
- **Real-world data triggers.** An insurance contract pays out automatically when an HTTP-accessible weather API reports a storm above a threshold. A market that must settle itself from an official source, with no human oracle, can read that source the same way; if a person is willing to publish the result, the native [betting system](#prediction-markets-and-betting) does the whole job without a contract.
- **Sentiment-driven flows.** A treasury contract adjusts its allocation strategy based on AI analysis of news headlines or social posts.
- **Translation, summarization, classification.** Any contract that needs the kind of judgment a person would make; but at machine speed, on every transaction.
- **Dispute resolution.** A contract submits both sides' arguments to an AI judge and acts on the verdict.

The answers are recorded on-chain forever, alongside the validators' cryptographic signatures, so the result can be audited and replayed by anyone running their own XChain node.

XChain actions involved: DEPLOY + EXECUTE on the contract side, ATTEST behind the scenes (the platform handles this automatically; contract authors call `xchain.attestation.request(...)` from inside the contract).

### Native Multi-Chain Staking

XChain has a built-in mechanism that lets any token, on any chain, be staked against a smart contract. Stakers lock up tokens; the contract's code decides what that lockup unlocks (access, voting weight, a share of fees, etc.); and if the contract decides someone misbehaved, it can take some or all of the staked tokens away from them, sending the slashed tokens to a destination the contract author chose at deploy time, including the chain's burn address. This works on every chain XChain supports, today Bitcoin, Litecoin, and Dogecoin.

This is a general-purpose primitive. It is not just for validating the network; the network has its own separate staking system for that. *Anyone* deploying a contract can declare it stakeable, and that contract can then build whatever logic on top makes sense for the application.

**What this enables:**

- **Staked claims and oracles.** Participants stake tokens to back their claims; the contract slashes wrong ones and pays out correct ones from the slashed pool. Use this shape when the payout rule itself has to be custom code; for an ordinary market on a question, [Prediction Markets and Betting](#prediction-markets-and-betting) is the native primitive and needs no contract.
- **Security bonds for services.** A service operator stakes tokens as a deposit; users get paid out of that bond if the service misbehaves or goes offline.
- **Validator-like services on top of XChain.** A contract can run its own internal validator set (for, say, a sidechain bridge, a relay service, or a federated oracle) backed by stake on any chain.
- **Reputation games.** Communities stake tokens against their own predictions, votes, or moderation decisions, with reputation calibrated by what gets slashed and what gets rewarded.
- **Conditional escrow with teeth.** Two parties stake tokens against a deal; an arbitrator (or an [AI judge](#ai-powered-smart-contracts)) decides if the deal was kept and slashes accordingly.
- **DAO membership locks.** Members stake tokens to participate in a DAO; the DAO's contract slashes them for spam or rule-breaking, with the rules defined entirely in code.

At deploy time, the contract author decides two things: how long a staker must wait after asking to withdraw (the cooldown period) and where slashed tokens are sent. Both are locked permanently when the contract is published. Neither the author nor anyone else can change them later. Stakers can therefore audit the rules before locking anything up.

XChain actions involved: DEPLOY (with staking metadata), STAKE, UNSTAKE, DELEGATE, EXECUTE (to invoke whatever logic the contract has built around its stakes).

For more details on the contract layer, see [Smart Contracts](../concepts/smart-contracts.md).

---

*See also: [Creating Tokens](./creating-tokens.md) | [Trading](./trading.md) | [Betting](./betting.md) | [Cross-Chain](./cross-chain.md) | [FAQ](./faq.md)*

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
