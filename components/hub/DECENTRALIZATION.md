# Hub Decentralization

## Current State

xchain-hub is a centralized service. All other services in the platform depend on it for configuration discovery, pricing data, and cross-chain swap coordination. A single hub instance holds the authoritative key-value store for the entire deployment.

This design is operationally convenient — configuration changes propagate to all services without restarts, and cross-chain coordination has a single integration point. However, it introduces a single point of trust and a single point of failure.

## Why Decentralize

### Single point of failure

If the hub process crashes or its LevelDB store becomes corrupted, the entire platform degrades. Services that cannot reach the hub fall back to stale local config or fail their startup checks. Cross-chain swaps stall until the hub recovers.

### Single point of trust

The hub operator controls configuration for all services. In a self-hosted deployment this is acceptable, but it creates a trust assumption that is difficult to remove as the platform grows. A malicious or misconfigured hub could redirect services to wrong endpoints or manipulate pricing data.

### Scalability ceiling

A single LevelDB-backed process has limited horizontal scaling options. Under high coordination load (many concurrent cross-chain swaps), the hub becomes a bottleneck.

## Decentralization Approaches

### Configuration: on-chain BROADCAST actions

Platform configuration could be published as BROADCAST actions on-chain. Each service would read its configuration directly from the chain, removing the hub as a configuration intermediary. Configuration changes would be made by broadcasting a new action, making them auditable and tamper-evident.

Trade-off: on-chain config updates are slower (require block confirmation) and more expensive (transaction fees). For parameters that change rarely — database hostnames, port numbers — this is acceptable. For parameters that change frequently, a different mechanism is needed.

### Pricing: oracle feeds

Fiat price data currently flows through the hub. This could be replaced by a network of price oracle nodes that each independently source and publish pricing data. Consumers would aggregate across multiple oracles and apply a median or weighted average, removing the single-source dependency.

Existing decentralized oracle networks (e.g. Chainlink, on supported chains) could serve as external price sources, with an adapter layer translating their data into the XChain format.

### Service discovery: DNS or on-chain records

Rather than polling the hub for hostnames and ports, services could resolve each other via DNS SRV records or on-chain BROADCAST records. This removes the hub from the critical path for service startup.

DNS-based discovery is operationally straightforward in Docker and Kubernetes environments where service names are already DNS-resolvable. On-chain records provide stronger trust guarantees but with higher latency.

### Cross-chain coordination: trustless mechanisms

Cross-chain swap coordination is the hardest problem. The current hub-mediated approach requires trusting the hub operator to match swaps fairly and completely.

Trustless alternatives under consideration:

- **Hash-time-locked contracts (HTLCs)** — each party locks funds with a hash lock; the secret reveal on one chain unlocks funds on the other. Does not require a coordinator, but requires both parties to be online during the swap window.
- **On-chain swap records** — swap intents are published as BROADCAST actions on each chain. A stateless coordinator watches both chains and calls the relevant indexers when a matching pair is found. The coordinator is untrusted — it cannot forge a match because the on-chain records are authoritative.
- **Relay network** — a decentralized network of relay nodes each independently watches all supported chains for swap intents and races to submit matches. Correct behavior is incentivized by a relay fee.

## Status

Hub decentralization is planned. The on-chain BROADCAST configuration approach and DNS-based service discovery are the nearest-term candidates. Cross-chain trustless coordination requires deeper protocol changes and is being designed separately.

Current roadmap items tracking this work are maintained in the platform's issue tracker. Check the [platform roadmap](../../PLATFORM.md) for the latest status.

## Related

- [Hub](README.md) — current hub architecture and API reference
- [Cross-Chain Concepts](../../concepts/CROSS_CHAIN.md) — how cross-chain swaps work at the protocol level
