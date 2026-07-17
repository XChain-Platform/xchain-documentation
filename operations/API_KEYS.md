<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# API Keys and the No-Key Posture

Every XChain service that exposes an HTTP API supports an optional API key. None of them refuse to start without one. This page defines the platform-wide standard for how a service behaves when its key is unset (the "no-key posture"), so operators know exactly what an unkeyed deployment exposes.

## The standard: fail-open with a loud startup warning

When a service's API key environment variable is unset, the service:

1. **Starts normally** (fail-open). Keyless operation is a first-class mode, required for local development, regtest stacks, and single-host deployments where the API is not reachable from outside.
2. **Prints a loud warning to the console at startup** stating that authentication is disabled and which surface is open. The open state is never silent.
3. **Enforces the key on every gated request when the key IS set.** Setting the key is the opt-in to authentication; there is no separate enable flag.

The one deliberate exception to pure fail-open: methods that would be dangerous without any authentication at all (for example the utxo-tracker's bootstrap snapshot/restore, or xchain-sync's `/halt/clear`) instead **fail closed**: they return 401 or are disabled entirely until a key is configured. The startup warning states this too.

## Per-service summary

| Service | Key variable | Behavior when unset |
|---|---|---|
| xchain-encoder | `API_KEY` | Open access to all JSON-RPC methods; startup NOTICE printed |
| xchain-hub | `HUB_API_KEY` (plus `HUB_REORG_API_KEY` tier) | Write methods and WebSocket subscriptions unauthenticated; startup WARNING printed. In validator mode the hub refuses to start keyless unless `HUB_ALLOW_UNAUTHENTICATED=true` is set explicitly |
| xchain-indexer | `INDEXER_API_KEY` | Write and federation-read methods are REJECTED (fail closed) unless `INDEXER_ALLOW_UNAUTHENTICATED=true`; startup WARNING printed either way |
| xchain-sync | `SYNC_API_KEY` | REST/WS API unauthenticated and `/halt/clear` disabled; startup WARNING printed |
| xchain-utxo-tracker | `UTXO_TRACKER_API_KEY` | Admin methods (bootstrap snapshot/restore, raw key scans) fail closed; read-only UTXO/balance queries stay open; startup WARNING printed |
| xchain-regtest-miner | `MINER_API_KEY` | All methods open (expected for regtest); startup WARNING printed |
| xchain-explorer | none | Public read-only API by design; no key exists |
| xchain-decoder | none | No public HTTP API; no key exists |

## Operator guidance

- **Local regtest / e2e stacks:** run keyless. The warnings are expected noise.
- **Any shared, multi-tenant, or public-facing deployment:** set a strong random key for every service you expose, and pass the matching key to its clients (for example the hub's `<COIN>_INDEXER_API_KEY` must equal the indexer's `INDEXER_API_KEY`, and `<COIN>_ENCODER_API_KEY` must equal the encoder's `API_KEY`).
- **Auditing a running host:** the startup warnings appear in each container's logs (`docker logs <container> 2>&1 | grep -i "API_KEY"`), so an unkeyed service is always discoverable after the fact.

See [Configuration](./CONFIGURATION.md) for where each variable is set.
