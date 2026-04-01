# XChain Use Cases

XChain is a general-purpose token protocol. It does not prescribe what tokens are for — that is up to you. This guide explores the kinds of things people and organizations are building with it today, along with the kinds of things that become possible once you have programmable tokens living permanently on Bitcoin, Litecoin, or Dogecoin.

---

## Digital Assets and Collectibles

### Limited-Edition Collectible Tokens

Create a token with a fixed, locked supply — say, exactly 100 units — and distribute them to collectors. Because the max supply is locked on-chain, no one (including you) can ever create more. Buyers can verify the scarcity themselves without trusting your promises.

XChain actions involved: ISSUE (to create and lock the supply), SEND (to distribute to collectors).

### Community and Fan Club Tokens

Issue a token to represent membership in a community, fan club, or organization. Members who hold the token can be granted access to events, content, or voting rights. You can update who qualifies at any time by adjusting the allow list, or lock the membership rules permanently for a more formal structure.

XChain actions involved: ISSUE, LIST (to define eligible members), SEND (to distribute memberships).

### Digital Art and Media Tokens

Attach a piece of digital art or media to a token using on-chain file storage and linking. The FILE action stores content directly on the blockchain. The LINK action connects it to a token permanently. Together, they create an unalterable on-chain record of the artwork's existence at a specific point in time.

XChain actions involved: ISSUE, FILE (to store the content), LINK (to associate it with the token).

---

## Financial Instruments

### Loyalty Points and Rewards Programs

Issue loyalty points as tokens. Customers earn points (via SEND or AIRDROP), spend them in your store (via SEND back to your address), and accumulate them over time. Because balances live on the blockchain, they cannot be silently deleted or manipulated — customers own their points in the same way they own their coins.

XChain actions involved: ISSUE, SEND, AIRDROP.

### Gift Cards and Store Credit

Create a token representing store credit or a gift card. Issue it to a customer and they can spend it (transfer it to your payment address) at any time. You can optionally restrict the token to your own addresses using an allow list, so it cannot be sold or transferred elsewhere.

XChain actions involved: ISSUE, LIST, SEND.

### Revenue Sharing and Dividends

If your token has multiple holders and you want to pay them proportionally — like distributing profits to shareholders — the DIVIDEND action does this automatically. You specify the token representing shares, the payment token (which could be XCHAIN or any other token), and the amount per unit. Every holder receives their proportional cut in a single transaction.

XChain actions involved: ISSUE (to create the share token), DIVIDEND (to make distributions), SEND (for ongoing transfers).

### Fundraising Tokens with Minting Windows

Set up a token with a defined minting window — a start block and stop block — during which the public can mint their own allocation at a fixed amount per mint. This is a transparent, on-chain crowdfunding mechanism. Contributors mint directly from the blockchain; there is no intermediary holding funds. After the window closes, no more tokens can be created.

XChain actions involved: ISSUE (with mint window configuration), MINT (by contributors during the window).

---

## Business Operations

### Supply Chain Tracking

Issue a token to represent a batch of goods. As the goods move through your supply chain — from manufacturer to warehouse to retailer — send the token to the address representing each stage. Every transfer is timestamped and permanently recorded on the blockchain. Disputes about "where were these goods and when" can be resolved by reading the ledger.

XChain actions involved: ISSUE (to create the batch token), SEND (to track movement between parties).

### Certificates and Credentials

Issue credential tokens to individuals — employees, students, licensed contractors. The blockchain record proves the credential was issued at a specific time by a specific issuing address. If a credential needs to be revoked, the CALLBACK action can recall all outstanding tokens, optionally paying a settlement token to each holder. Verifying a credential is as simple as checking whether the address holds the token.

XChain actions involved: ISSUE, SEND, CALLBACK (for revocation).

### Voting and Governance

Issue a fixed number of voting tokens to eligible participants — one token equals one vote. Participants cast votes by sending their token to the address representing their chosen option. Because each transfer is on-chain, the vote tally is transparent and auditable by anyone. The token can be set up so that it cannot be sold or transferred to unregistered addresses, ensuring only eligible voters participate.

XChain actions involved: ISSUE, LIST (for eligible voters), SEND (vote casting), AIRDROP (to distribute voting tokens).

### Access Control and Token-Gated Systems

Build a system where access to a service, platform, or physical location requires holding a specific token. Anyone can verify on-chain whether an address holds the required token. You control who can hold the token via allow lists, and you can revoke access by recalling the token using CALLBACK. The rules are enforced by the blockchain, not by your server configuration.

XChain actions involved: ISSUE, LIST, SEND, CALLBACK.

---

## Communication and Data

### On-Chain Messaging

Send messages to specific addresses that are permanently recorded on the blockchain. Messages can be plaintext (visible to anyone) or encrypted so only the recipient can read them. Unlike email or messaging apps, on-chain messages cannot be deleted, censored, or claimed to have never been sent.

XChain actions involved: MESSAGE.

### Document Notarization

Upload a document's content or cryptographic fingerprint on-chain using the FILE action. The blockchain timestamp proves the document existed in its current form at a specific point in time. This creates tamper-proof records of contracts, agreements, or any document where the time of existence matters.

XChain actions involved: FILE.

### Broadcast Oracles and Public Announcements

Use the BROADCAST action to publish data on-chain — price feeds, event results, announcements, or any information that needs a permanent, immutable record. Applications and services can read broadcasts from the explorer API and trust that the data has not been altered since it was published.

XChain actions involved: BROADCAST.

---

## DEX Applications

### Token Marketplaces

Create a token representing anything of value — event tickets, in-game items, real-world assets — and list it on the XChain DEX. Buyers and sellers find each other through the order book. The exchange is automatic, transparent, and available to anyone on the supported blockchains.

XChain actions involved: ISSUE, ORDER.

### Automated Sales via Dispensers

Set up a dispenser to sell your tokens at a fixed price, 24 hours a day, without any manual involvement. Buyers send the right amount of coin and receive tokens automatically. This is ideal for token sales, fundraisers, or any scenario where you want continuous, reliable availability without running a backend server.

XChain actions involved: ISSUE, DISPENSER.

### Cross-Chain Arbitrage and Exchange

Trade tokens between Bitcoin, Litecoin, and Dogecoin using the SWAP action. This enables arbitrage between the same token type on different chains, or the exchange of value across chains for users who want to move their holdings from one blockchain ecosystem to another.

XChain actions involved: SWAP.

---

## Private Deployments

### Internal Company Networks

Organizations can run XChain on a private regtest network — a fully featured, fully isolated instance of the platform. All 19 actions work identically to the public network. The organization controls the block production, the gas issuance, and the entire environment.

This is useful for internal asset management (tracking equipment, licenses, or internal credits), piloting blockchain applications before going to mainnet, and training teams on the platform without real-money risk.

XChain actions involved: All actions, in a controlled environment.

### Internal Asset Tracking

Run a private deployment where different departments hold addresses and tokens represent internal resources — project budgets, equipment units, license seats. Transfers between departments are recorded immutably. Audits become a matter of reading the ledger rather than reconciling spreadsheets.

XChain actions involved: ISSUE, SEND, AIRDROP, DIVIDEND.

### Internal Trading and Exchanges

A private XChain deployment can run its own DEX, letting internal departments or subsidiaries trade internal assets with each other at market-determined prices — without any external exposure and without relying on a centralized company database that can be edited.

XChain actions involved: ORDER, DISPENSER.

---

*See also: [Creating Tokens](./CREATING_TOKENS.md) | [Trading](./TRADING.md) | [Cross-Chain](./CROSS_CHAIN.md) | [FAQ](./FAQ.md)*
