<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Running a Validator

A validator is an XChain hub with a staked on-chain identity. It signs the work the network needs done: publishing prices, attesting to outside facts, matching cross-chain actions.

There are two ways to run one, and the cheaper one is a first-class citizen rather than a lesser mode. This page explains both so you can pick deliberately.

## The short version

| | Lightweight validator | Full validator |
|---|---|---|
| Runs a coin node (`bitcoind` and friends) | No | Yes |
| Runs its own decoder + indexer | No, replicates them | Yes |
| Gets chain data from | `xchain-sync` replication | Its own node, decoded locally |
| Can claim `price`, `attestation`, `cross_chain`, `oracle_publish` | Yes | Yes |
| Can claim `full_node` | No | Yes |
| Base oracle reward | Yes | Yes |
| Full-node reward tranche | No | Yes, once armed |
| Penalised for being lightweight | **Never** | n/a |
| Realistic hardware | A small board or a modest VPS | A machine with room for the chain |

Both are real validators. A lightweight validator participates, signs, and earns; it simply cannot prove it holds a copy of the chain, so it does not receive the extra tranche reserved for validators who do.

## What a validator actually needs

Every validator, either tier, needs three things:

1. **A stake.** An on-chain `STAKE` from an address you control, naming your validator's signing public key.
2. **A signing identity.** An Ed25519 keypair the hub generates and holds.
3. **A running hub.** The `xchain-hub` service, reachable by its peers.

Note what is *not* on that list: a coin node. The protocol assigns no tiers by decree. Capabilities qualify automatically when your total effective stake clears each capability's floor, and most capabilities never touch a coin node at all. `price` needs a price feed. `attestation` needs a reachable model provider. `cross_chain` verifies source actions against indexer APIs. `oracle_publish` needs a broadcast wallet.

Only one capability requires a coin node, and it is the one named after it.

## Capabilities and their stake floors

Capabilities are not applied for. Any key whose total effective stake clears a floor qualifies for that capability automatically, so a single larger stake can qualify you for several at once.

| Capability | Minimum stake (XCHAIN) | What it does | Needs a coin node |
|---|---|---|---|
| `oracle_publish` | 500 | Publishes signed oracle rounds | No |
| `price` | 1,000 | Signs price rounds | No |
| `attestation` | 1,000 | Attests to off-chain facts | No |
| `full_node` | 2,000 | Proves possession of the chain | **Yes** |
| `cross_chain` | 5,000 | Matches actions across chains | No |

## How the two tiers get their chain data

A full validator runs the ordinary pipeline: a coin node feeds the decoder, the decoder feeds the indexer, and the hub reads the result.

A lightweight validator skips all of that and **replicates the finished databases** instead, using `xchain-sync` in client mode. It ends up with the same decoder and indexer databases locally, without ever downloading a blockchain. That is the whole trick, and it is why a validator can run on hardware that could never hold a chain.

In client mode you point the service at one or more sources:

```
SYNC_MODE=client
SYNC_SOURCES=https://sync.xchain.io
```

The client fetches the schema, then replicates block by block, detects gaps on reconnect, and self-heals.

### Read this part before you trust a replica

Replication is only as trustworthy as its sources, and the number of sources is what changes the guarantee:

- **One source is a trust relationship.** A single-source replica believes what it is told. It is fine when you know who runs the source, and it is the situation today, because the sources published so far are operator-run.
- **Two or more independent sources is a check.** Clients configured with several sources hold each block until every source agrees on its hash, so a source that fabricates data is caught rather than believed.

For indexer replicas there is a further guard on by default: the client rebuilds the light-client state roots as it applies blocks and halts if its own recomputation disagrees with the source. That turns a lying source into a stopped replica instead of a silently wrong one.

The honest summary is that a lightweight validator today leans on the operator's sync tier, and that becomes less true with every independent validator that publishes one. If that bothers you, it is an argument for running the full tier, not an argument against the light one.

## Rewards, and the one thing that is not live yet

Oracle round rewards split into two tranches:

- **The base tranche** goes to every qualified signer of the round, lightweight or full.
- **The full-node tranche** goes only to validators that have proven possession of a real chain copy.

Proof happens through a periodic possession challenge. Every node can derive the challenge from on-chain data, but only a node holding the chain can compute the answer. Verdicts are recorded on-chain, and eligibility for the tranche is a participation *rate*, not a single success: a validator must pass at least 70% of the challenge epochs in the trailing window, so one outage costs nothing.

**The full-node tranche is not active yet.** It ships inert and stays that way until its reward share is set above zero and the initial verifier set is seeded. Until then, both tiers earn the same rewards, and running a full node buys you self-sufficiency rather than income.

## What lightweight validators are never penalised for

Failing a possession challenge is not an offence. A validator that does not run a coin node simply fails the challenges, earns nothing from the full-node tranche, and is left alone: its stake is untouched and there is no failed-challenge slash. The full-node tier is deliberately a carrot, never a stick.

This was a deliberate design decision, and the reason is worth knowing. Capabilities qualify by stake threshold with no on-chain opt-in, so a validator staked for `cross_chain` automatically clears the `full_node` floor as well. Slashing failed challenges would have burned the bond of a validator who never claimed to run a node in the first place.

Be careful not to over-read this. **It means lightweight validators are not punished for being lightweight. It does not mean validators are never slashed.** Misbehaviour in the capabilities you actually exercise, such as signing contradictory messages or publishing prices that diverge from the network, carries its own penalties in both tiers.

## Which should you run?

Run **lightweight** if you want to participate without hosting a chain, if your hardware is modest, or if you are standing up a validator quickly. It is the tier most community validators will want.

Run **full** if you want to depend on nobody for your view of the chain, if you intend to serve as a sync source for others, or if you want the full-node tranche once it is armed.

You are not locked in. The tiers differ by what you run alongside the hub, so a lightweight validator that later adds a coin node becomes a full one, and its stake and identity carry over unchanged.

## Next steps

- [Node Operator Quickstart](./quickstart-node-operator.md): installing and running the platform stack, the starting point for the full tier
- [xchain-sync](../components/sync/README.md): replication service reference, including client configuration
- [Hub decentralization](../components/hub/decentralization.md): how validators find each other and share work
- [NODEPROOF](../protocol/actions/nodeproof.md): the possession challenge and the reward-tranche rules in protocol detail
- [COLLECT](../protocol/actions/collect.md): how earned rewards are claimed

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
