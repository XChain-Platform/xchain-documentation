<!--
Copyright © 2025–2026 Dankest, LLC
SPDX-License-Identifier: AGPL-3.0-or-later
Licensed under the GNU Affero GPL v3.0 or later; see LICENSE.md.
A commercial license is available, contact legal@dankest.llc.
-->

# Building AI Agents on XChain

XChain is built to be easy for AI agents and LLM-powered tools to use. Not as an afterthought, but as a design goal. This section is the starting point if you are building an agent (or are one).

## What an agent can do today

**Read everything.** Every token, balance, trade, smart contract, and attestation on Bitcoin, Litecoin, and Dogecoin is queryable through the explorer's REST API. No API key, no account. The API is described by a machine-readable spec at `https://explorer.xchain.io/openapi.json`, and every error carries a stable machine-readable code (see [Error Codes](../protocol/Error_Codes.md)).

**Use the MCP server.** If your agent speaks the Model Context Protocol (Claude, and most agent frameworks), the `xchain-mcp` server gives it ready-made tools: token lookups, balances, dispensers, order books, contract state, checkpoint verification, across all chains and networks. See the [MCP Quickstart](MCP_Quickstart.md).

**Read the docs in one request.** The full documentation is published for LLMs at `https://docs.xchain.io/llms.txt` (curated index) and `https://docs.xchain.io/llms-full.txt` (the whole corpus, one file). Every doc page is also available as raw markdown, replace `.html` with `.md` in any docs URL.

**Verify, don't trust.** Quorum-signed state checkpoints let an agent verify platform state client-side: fetch `https://explorer.xchain.io/{COIN}/api/checkpoint/{height}/verify` and check the validator signatures yourself (the SDK and MCP server both do this for you).

## What smart contracts can do with AI

XChain smart contracts can call AI models. Not the other way to say it: a contract running on Bitcoin can request an LLM completion, the validator federation runs the request and agrees on the answer, and the result lands back on-chain in the contract's callback. See the [LLM attestation provider](../protocol/providers/llm.md) for how consensus over AI responses works.

## Conventions an agent should know

- `coin` is the host chain (BTC, LTC, DOGE); `tick` is a token symbol. There is no "asset" field.
- URL coin prefixes carry the network: `BTC` mainnet, `TBTC` testnet, `RBTC` regtest.
- Amounts are arbitrary-precision decimal **strings**. Never parse them as floating-point numbers.
- Branch on error `code` fields, never on message text ([Error Codes](../protocol/Error_Codes.md)).

## Transacting and getting paid

- **Give an agent a wallet, safely.** A bounded agent session caps what an agent may spend (which actions, to where, how much per rolling window) enforced before anything is signed. See [Giving an AI Agent a Wallet, Safely](Agent_Wallets.md).
- **Charge agents for data and APIs.** An HTTP 402-style flow lets an agent pay for a data feed, API, or file in your token, inside the request itself. No accounts, no keys. See [Charging Agents for Data and APIs](Charging_Agents.md).
- **Contracts that pay for AI.** A smart contract requesting an LLM or web attestation can attach a fee; the validator federation that fulfills the request earns it. See the [LLM attestation provider](../protocol/providers/llm.md) and [ATTEST](../protocol/actions/ATTEST.md).

## Hard, network-enforced spending limits

For limits an agent cannot bypass even with its own key, the SDK ships a **MuSig2 co-signer**: the agent holds one key, a policy daemon you run holds the other, and the chain only accepts a single aggregate signature that cannot be produced outside policy. The daemon decodes each transaction itself before adding its half, so a lying agent gains nothing. See [Giving an AI Agent a Wallet, Safely](Agent_Wallets.md) for setup and the operational rules.
