<!--
Copyright © 2025–2026 Dankest, LLC
SPDX-License-Identifier: AGPL-3.0-or-later
Licensed under the GNU Affero GPL v3.0 or later; see LICENSE.md.
A commercial license is available — contact legal@dankest.llc.
-->

# MCP Quickstart

`xchain-mcp` is a Model Context Protocol server that gives any MCP-capable agent read-only tools over the XChain Platform. It ships inside the `xchain-sdk` package and needs zero configuration — tools default to the public platform hosts.

## Install

```bash
# From the xchain-sdk checkout (npm package publication is pending):
cd xchain-sdk && npm install
```

## Connect your client

**Claude Code:**

```bash
claude mcp add xchain -- node /path/to/xchain-sdk/mcp/cli.js
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "xchain": { "command": "node", "args": ["/path/to/xchain-sdk/mcp/cli.js"] }
  }
}
```

Any other MCP client: run `node mcp/cli.js` as a stdio server.

## What you get

22 read-only tools. Every tool takes a `coin` parameter selecting chain + network (`BTC`, `TBTC`, `LTC`, `TLTC`, `DOGE`, `TDOGE`, and `R*` for a local regtest stack).

| Area | Tools |
|---|---|
| Platform | `get_status`, `get_fee_schedule`, `get_validators` |
| Tokens | `get_token`, `search_tokens` (incl. `nft` type), `get_holders`, `get_project` |
| Addresses | `get_balances`, `get_address`, `get_history` |
| Chain data | `get_action`, `get_block`, `search` |
| Trading | `get_dispensers`, `get_markets`, `get_market`, `get_orderbook` |
| Contracts | `get_contract`, `get_contract_state`, `get_executions` |
| Trust | `get_attestations`, `verify_checkpoint` (client-side signature check) |

Plus two resources: `xchain://docs/llms.txt` and `xchain://docs/llms-full.txt` — the documentation, readable in-band.

## Try it

Ask your agent things like:

- "What's the status of the XChain BTC network?"
- "Search for NFTs on DOGE and show me the holders of the first one."
- "Verify the latest state checkpoint on BTC and explain what it commits to."

## Pointing at a regtest stack

The `R*` coins (`RBTC`, `RLTC`, `RDOGE`) default to localhost services. The standard SDK environment variables (`EXPLORER_URL`, `EXPLORER_PORT`, `HUB_API_HOST`, …) override any endpoint — see [SDK configuration](../components/sdk/CONFIGURATION.md).

## Writes are deliberately absent

This server cannot sign, submit, or spend anything — there is no key material anywhere in it. Transaction composition and submission tools are planned as a separate, policy-gated layer (spending limits, action allowlists) so an agent can only ever act inside bounds its operator set. Until then: agents read, humans write.
