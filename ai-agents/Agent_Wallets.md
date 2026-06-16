<!--
Copyright © 2025–2026 Dankest, LLC
SPDX-License-Identifier: AGPL-3.0-or-later
Licensed under the GNU Affero GPL v3.0 or later; see LICENSE.md.
A commercial license is available, contact legal@dankest.llc.
-->

# Giving an AI Agent a Wallet, Safely

If an AI agent is going to move real value, it should only be able to move the value you decided it can move: on the actions you chose, to the places you allow, at a rate you set. The SDK's **agent session** exists for exactly that.

## The idea

A normal wallet session can do anything the key can do. An agent session wraps the same key with a policy that is checked before every action leaves the SDK:

```js
const sdk = new XChainSDK({ network: 'dogecoin-testnet' });

const agent = sdk.agentSession(wif, {
    // Nothing is allowed unless you list it.
    allowedActions: ['SEND', 'EXECUTE', 'COINPAY'],

    // Where funds may go (optional — omit to allow any destination).
    allowedDestinations: ['DTqQ...storefront', 'DBgH...treasury'],

    // The most a single action may move.
    maxPerAction: { SEND: { MYTOKEN: '100', '*': '10' } },   // '*' = any other token

    // The most the agent may move in total, per rolling window.
    maxPerWindow: { hours: 24, perTick: { MYTOKEN: '500' }, maxActions: 50 },

    // Above this, a human (or supervising process) must say yes.
    confirmAbove: {
        perTick: { '*': '50' },
        handler: async (ctx) => await askTheOperator(ctx),   // ctx: action, tick, amount, windowUsage
    },

    // See every denial (alerting, logs).
    onPolicyViolation: (v) => console.error('agent blocked:', v.code, v.message),

    // Override the default usage-state path (~/.xchain/agent-usage-<address>.json).
    // The file persists window usage across restarts so a crash-loop cannot reset caps.
    stateFile: '/var/lib/myapp/agent-usage.json',
});

await agent.send({ tick: 'MYTOKEN', amount: '5', destination: 'DTqQ...storefront' });
```

Every successful action's result carries `result.policy` (what was checked and how much of the window is used) so the agent can reason about its own remaining budget instead of discovering limits by hitting them.

## What happens on a violation

The action is refused **before anything is signed or broadcast**, with a typed `SDKPolicyError` whose `code` says exactly why:

| Code | Meaning |
|------|---------|
| `POLICY_ACTION_DENIED` | Action type not in `allowedActions` |
| `POLICY_DESTINATION_DENIED` | Destination not in `allowedDestinations` |
| `POLICY_AMOUNT_EXCEEDED` | Single-action amount exceeds the per-action cap |
| `POLICY_WINDOW_AMOUNT_EXCEEDED` | Rolling-window token total would breach the cap |
| `POLICY_WINDOW_COUNT_EXCEEDED` | Rolling window already holds `maxActions` actions |
| `POLICY_CONFIRMATION_DENIED` | Amount was above `confirmAbove` threshold and the handler returned false |
| `POLICY_STATE_CORRUPT` | Usage-state file is unreadable or structurally invalid: indicates a corrupt state file, not a policy denial. Do not retry; inspect and remove or repair the file deliberately to recover. |

Agents should treat all `SDKPolicyError` codes as final answers, not errors to retry.

## Designed to fail closed

- No `allowedActions` list → the session refuses to construct. Nothing is allowed by default.
- Window usage is persisted to disk (default `~/.xchain/agent-usage-<address>.json`), so restarting the agent (or crash-looping it) does not reset the spending window.
- If that usage file is corrupted, the session **blocks** rather than silently starting a fresh window. Delete it deliberately to reset.
- Amount checks use exact decimal arithmetic. There is no floating-point edge to slip through.

## What this does: and does not: protect against

This is a guardrail around the **agent**, not around the **key**. It protects you from an agent that hallucinates an amount, gets prompt-injected into draining a wallet, or loops on a bad plan. It does not protect you from an attacker who steals the WIF itself; they can use the raw SDK without the policy.

Two practices close most of that gap:

1. **Fund the agent's address like a spending account, not a vault.** The window cap only has to be wrong by one top-up.
2. For hard enforcement, the roadmap includes a **MuSig2 co-signer**: the agent holds one key, a policy daemon holds another, and the network sees a single aggregate signature that simply cannot be produced outside policy. The SDK already ships MuSig2 (BIP-327); the co-signer service interface is specified and planned.

## For MCP users

The `xchain-mcp` server's read tools never touch keys. Its write tool (`submit_action`) stays off until the operator configures a key and policy, and when on it routes every submission through an agent session, there is deliberately no unpoliced write path for agents. See the [MCP Quickstart](MCP_Quickstart.md).
