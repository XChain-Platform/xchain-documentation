<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Validator Quickstart

Five steps from an empty machine to a validator that is staked, connected,
and working. Nobody has to approve you: you stake, and the network starts
counting you automatically.

This is the testnet path, and on testnet everything is free: the XCHAIN you
stake is minted from a faucet token, and the coins that pay fees come from
test faucets.

**You need:** a machine that runs Docker, a public IP or DNS name, TCP port
10002 open inbound, Node 22, and git.

## Pick what you want to support

Your stake is what qualifies you. One number to remember: **a single stake of
25,000 XCHAIN qualifies you for everything at once**, and the setup below
stakes exactly that. But each level has its own bar, so you can also start
small:

| To support... | Stake (XCHAIN) | You also need |
|---|---|---|
| Anchoring and price publishing | 500 | A little testnet DOGE (step 3 covers it) |
| Price rounds | 1,000 | Nothing extra |
| Attestations (verifying facts for contracts) | 1,000 | Nothing extra |
| Full-node proof | 2,000 | The Bitcoin stack (step 5 installs it) |
| Cross-chain matching | 5,000 | The Bitcoin stack (step 5 installs it) |
| Web attestations (`http_get` provider) | 10,000 | Nothing extra |
| AI attestations (`llm` provider, Claude) | 25,000 | The Claude CLI installed and signed in |

There is no application and no registration: any stake that clears a bar
qualifies for that level automatically.

## Step 1: install the CLI

```bash
git clone -b v0.12.2 https://github.com/XChain-Platform/xchain-node.git ~/xchain-node
cd ~/xchain-node
npm install
npm link
```

Run all the commands below from `~/xchain-node`.

## Step 2: create your validator identity

```bash
xchain-node validator init --network testnet --p2p-addr YOUR_PUBLIC_HOST:10002
```

One second, fully offline. It generates your keys and prints **two addresses
to fund**: a Bitcoin testnet address (pays transaction fees) and a Dogecoin
testnet address (pays for publishing).

**Back up `config/validator/signing.key` and `config/validator/wallets.env`
somewhere off this machine now.** There is no recovery if they are lost.

## Step 3: fund the two addresses

- Send **50,000 sats of testnet bitcoin** to the first address, from any
  testnet4 faucet. Setting up costs about 27,000 sats; the rest is headroom.
- Send **0.02 testnet DOGE** to the second address, from any Dogecoin
  testnet faucet.

## Step 4: stake

```bash
xchain-node validator stake              # dry run: shows the plan, sends nothing
xchain-node validator stake --broadcast  # do it
```

That one command mints the 25,000 XCHAIN from the testnet faucet token and
stakes it to your key. Everything goes out back to back and confirms within a
block or two. The dry run doubles as your "have I funded it yet" check, and
re-running is always safe: it only sends what is still missing.

Your stake goes live 6 blocks after it confirms. Watch it at
`https://explorer.xchain.io/TBTC/validator/YOUR_PUBKEY` (the init command
printed your pubkey; `xchain-node validator status` re-prints it).

## Step 5: start your validator

```bash
xchain-node install v0.12.2 all bitcoin testnet   # your own view of the chain
xchain-node install v0.12.2 xchain-hub            # the validator itself
```

The first command installs a self-contained Bitcoin testnet stack (a
bootstrap restore does the heavy lifting). The second boots the validator
with your keys and capabilities wired in. On a fresh machine it asks once for
a database root password.

That's it. Peers admit your validator within about 30 seconds of your stake
going live. You do not need to tell anyone.

## Check your work

```bash
xchain-node validator status     # what this node is configured as
xchain-node logs xchain-hub      # what it is doing
```

- `https://explorer.xchain.io/TBTC/validator/YOUR_PUBKEY` shows your stake as
  `valid`. This appears once the stake confirms, even before your hub runs.
- `https://explorer.xchain.io/TBTC/validator_capabilities` lists your pubkey
  once your hub is running and talking to its peers.

## Two things worth knowing

- **Stake only when you intend to run.** A staked validator that is not
  running still counts toward the network's voting thresholds while
  contributing nothing, which makes life harder for everyone else. Stake when
  you are ready to start the hub, and stand down if you stop.
- **Keep a little DOGE in the publisher wallet.** Publishing prices and
  anchors spends it. `validator status` shows your remaining runway, and the
  hub warns you when it runs low.

## Standing down

```bash
xchain-node validator unstake              # dry run
xchain-node validator unstake --broadcast  # withdraw your stake
```

Your stake stops counting toward the active set 6 blocks later. The XCHAIN
itself stays locked for a further cooldown of 1000 blocks (roughly 7 days on
Bitcoin) before the sweep credits it back, so do not plan on spending it
sooner. Stop the hub any time after you leave the active set with
`xchain-node stop xchain-hub`.

## Going deeper

- [Running a Validator](./running-a-validator.md): the two validator tiers,
  how rewards work, and what lightweight validators are (never) penalised for
- [Hub configuration](../components/hub/configuration.md): every setting,
  including the attestation providers

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
