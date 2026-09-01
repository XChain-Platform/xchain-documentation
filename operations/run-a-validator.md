<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Run a Validator

How to stand up an XChain validator on **testnet**, from an empty machine to a
node that is staked, peered with the network, and publishing. Mainnet follows
the same steps with different values; the differences are listed at the end.

Nobody has to approve you. Membership is derived from on-chain stake: you
broadcast one `STAKE` naming your signing key, and every hub on the network
starts counting you on its next signer-set refresh.

## What you get, in one picture

```
xchain-node validator init      generates three keys, prints two addresses to fund
        |
        v
fund the two addresses          testnet BTC to the stake address, testnet DOGE to the DOGE address
        |
        v
xchain-node validator stake     mints XCHAIN on testnet, then broadcasts STAKE (one command)
        |
        v
xchain-node install v0.12.3 xchain-hub     starts the validator; peers admit it once the stake activates
```

## Prerequisites

⬜ A machine that can run Docker, with a public IP or DNS name  
⬜ TCP **10002** open inbound (the testnet P2P port; mainnet uses 10001)  
⬜ Node 22 and git  
⬜ About an hour, most of it waiting for testnet blocks

## Step 1: install the CLI

`xchain-node` installs from source:

```bash
git clone -b v0.12.3 https://github.com/XChain-Platform/xchain-node.git ~/xchain-node
cd ~/xchain-node
npm install
npm link
```



Everything below assumes you run commands from `~/xchain-node`. The CLI reads
its `.env` from the directory you run it in, so a command run from elsewhere
silently sees none of your settings.

## Step 2: create your validator identity

```bash
cd ~/xchain-node
xchain-node validator init --network testnet --p2p-addr <your-public-host>:10002
```

This is offline and takes a second. It generates three keys and writes them
under `~/xchain-node/config/validator/` (the directory is git-ignored):

| File | What it is | Mode |
|---|---|---|
| `signing.key` | Your Ed25519 **signing key**. Its public half is what you stake to. | 0600 |
| `wallets.env` | Your **stake wallet** (a BTC testnet key) and your **DOGE publisher wallet** (a DOGE testnet key). | 0600 |
| `signer/` | The small module the hub loads to sign DOGE transactions with the publisher key. Mounted read-only into the hub container. | 0600 `.env` |
| `hub-caps/capabilities.json` | Which capabilities you serve, already pointed at your DOGE wallet. | 0644 |
| `../hub.local` | The hub's API key, generated once per host. | 0600 |

It prints your **PUBKEY** and **two addresses to fund**:

```
  PUBKEY (stake XCHAIN to this to qualify capabilities):
    ae61f26f28d238d8303de56f6d701c8ede559d3f143bce7ed20f9ea5f84cfc4f

  Wallets generated. Fund these two addresses:
    stake / fees   (TBTC)  : mxmCJbT7k1qK5RxzUERe7Siw5bAtBwhDXV
    price + anchor (TDOGE) : nhpQyVMALLqWV446C9ewXxEVe3xLfDmRQ9
```

Sensible defaults were filled in for you: the five `validator01-05.xchain.io`
seed peers, the testnet oracle epoch, and all four capabilities enabled. Run
`xchain-node validator status` any time to see them.

### Back up the keys now

⬜ Copy `config/validator/signing.key` and `config/validator/wallets.env` to offline media  
⬜ Confirm both copies are readable, then keep them somewhere the server is not

There is no recovery. Lose `signing.key` and you re-key and re-stake. Lose
`wallets.env` and the coin at those addresses is gone.

### Bringing your own keys (optional)

Both wallets are ordinary single-key P2PKH wallets, so you can use keys you
already hold, including a vanity address you ground yourself, the way the
project's own validators use `mverify1...` addresses. Import them at init time:

```bash
# prompts for each WIF with echo off; nothing is passed on the command line
xchain-node validator init --network testnet --p2p-addr <host>:10002 \
  --import-stake-key --import-doge-key
```

You can import one and generate the other. For scripted installs, the same
keys can come from `XCHAIN_NODE_STAKE_WIF` and `XCHAIN_NODE_DOGE_WIF` in the
environment. Requirements:

- The stake key is a **Bitcoin testnet** key (address starts with `m` or `n`);
  the DOGE key is a **Dogecoin testnet** key (address starts with `n`). A key
  from the wrong network is refused.
- Legacy P2PKH addresses. The publisher signs with a single key, and the
  encoder resolves the sender from a P2PKH address.
- If the stake address already holds testnet BTC or XCHAIN, `validator stake`
  simply uses what is there.

If you keep your DOGE key somewhere the CLI cannot read (a hardware signer, a
remote service), skip the generated wallets with `--no-wallets`, write your own
signer module, and point `XCHAIN_NODE_HUB_SIGNER_DIR` at it. The module contract
is in the [hub configuration reference](../components/hub/configuration.md)
(`HUB_SIGNER_MODULE`), and the generated `config/validator/signer/signer.js` is a
working example to start from.

Every ROLLCALL payload is longer than the 76-byte OP_RETURN cap, so it always
rides the chunked two-phase P2SH lane, and the hub's built-in broadcast
pipeline only finishes phase 1 there. A hand-built module that exports only
`walletSign` will sign roll calls but can never publish one, and it fails
silently: export `broadcast(payload)` too, the way the generated signer does.
`xchain-node validator status` reports whether your configured signer has it.

Existing wallets are **kept** across `validator init --force` (which only
rotates the signing key). Replacing them is a separate, explicit
`--force-wallets`, because a replaced address abandons whatever coin was at it.

Re-running `validator init` on a validator you already set up is safe and is
how you upgrade: it prints your pubkey and addresses, fills in anything a
newer version added, and never touches your signing key or your stake.

## Step 3: fund the two addresses

**Stake address** (TBTC): send testnet bitcoin from any testnet4 faucet. It
pays the fees for the mint and stake transactions in step 4. Measured on
testnet4 in August 2026, at the 20 sat/vB the encoder quotes there:

| Action | Cost | Why |
|---|---|---|
| each `MINT` | ~5,100 sats | 19-byte payload, fits in one transaction |
| the `STAKE` | ~11,900 sats | its 78-byte payload plus the 4-byte protocol marker exceeds the 80-byte single-output limit, so it rides a two-transaction encoding |

So a first-time stake from zero (three mints plus the stake) runs about
**27,000 satoshis**. Funding **50,000** leaves comfortable headroom. Every
XCHAIN action on testnet is a Bitcoin transaction, so this is also the balance
to top up if you ever want to change your stake.

**DOGE address** (TDOGE): send testnet dogecoin. This is the wallet your hub
**spends from** when it is the elected publisher for a price round or a state
anchor, which is what the `oracle_publish` capability means. Qualifying for
`oracle_publish` is a matter of stake (see the floors below); actually
publishing costs a DOGE transaction each time, and an empty wallet means the
rounds you are elected for do not get written. The same wallet also pays for
ROLLCALL publishes: about **0.006 DOGE per roll call** (two ~0.003 DOGE
transactions), so funding it to **0.02 DOGE** is comfortable headroom for
anchors and roll calls together. `xchain-node validator status` shows the
current balance converted into roll calls of runway. Keep it topped up; the
hub logs a low-balance warning.

## Step 4: stake

> **Stake only when you intend to run the hub, and stand down if you stop.**
> Membership is derived from on-chain stake alone, so a validator that has
> staked but is not running still counts toward every capability's validator
> count `N` while contributing nothing. Because the quorum is
> `max(2*floor((N-1)/3)+1, ceil((N+1)/2))`, adding an absent validator can
> *raise* the threshold everyone else has to meet: going from 5 validators to
> 6 moves quorum from 3 to 4. It also puts you in publisher elections you
> cannot answer. If you are going to be down for more than a short while,
> [unstake](#removing-yourself).

One stake of **25000 XCHAIN** clears every capability floor at once:

| Capability | Floor |
|---|---|
| `oracle_publish` (price rounds and anchors) | 500 |
| `price` | 1000 |
| `attestation` | 1000 |
| `full_node` | 2000 |
| `cross_chain` | 5000 |
| `http_get` attestation provider | 10000 |
| `llm` attestation provider | 25000 |

On testnet, XCHAIN is a faucet token anyone can mint (10000 per transaction,
50000 per address). You do not have to do that by hand:

```bash
xchain-node validator stake              # dry run: shows balances and the plan, sends nothing
xchain-node validator stake --broadcast  # sends it
```

The dry run is also your "have I funded it yet" check. With `--broadcast`, the
command mints whatever XCHAIN you are short (three transactions from zero) and
then broadcasts `STAKE v1` naming your pubkey.

All of it goes out **back to back, within seconds**, so the whole run confirms
in the next block or two rather than costing a block per step. From zero,
expect to wait roughly one block after the last transaction is sent.

That is safe rather than optimistic. Each transaction is funded by the one
before it, so they form a chain, and Bitcoin requires a parent transaction to
come before its child. The indexer then resolves your stake against every
earlier action, so the mints count whether they share the stake's block or sit
in the one before it: what matters is that they come first, and the chain
guarantees that. If the chain can't be formed for any reason, the command says
so and waits for the mints to be indexed before staking, instead of gambling on
block order. `--serialize` forces the old one-action-per-block behaviour if you
ever want it.

It is safe to interrupt and re-run: it re-reads your balance and only sends
what is still missing (wait for anything in flight to confirm first, or it
will not be counted yet).

Then one more wait: a stake becomes **active 6 blocks** after it is indexed.
You can watch it at `https://explorer.xchain.io/TBTC/validator/<your pubkey>`.

## Step 5: give the hub a BTC indexer

Your hub reads the chain through a **BTC testnet indexer**: the on-chain
validator set, your own stake, the current tip. Pick one:

**Run one on the same machine** (self-contained; the bootstrap restore does the
heavy lifting):

```bash
xchain-node install v0.12.3 all bitcoin testnet
```

When the BTC stack is on the same host, the hub finds its indexer through the
CLI's own config push and you set nothing else.

**Or point at an indexer you have access to**, in `~/xchain-node/.env`:

```
BTC_INDEXER_API_URL=http://<indexer-host>:3004
BTC_INDEXER_API_KEY=<its API key, if it has one>
```

The validator reads are on the indexer's gated list, so a keyed indexer 401s
without the key. The hub names that case in its log.

## Step 6: decide your capabilities

`config/validator/hub-caps/capabilities.json` is ready to go for `price`,
`attestation` and `oracle_publish`. One thing needs your decision:

- **`cross_chain`** needs a BTC RPC endpoint under `cross_chain.chains.BTC.rpc`.
  If you installed the BTC stack in step 5, point it at that node. If not, list
  `"cross_chain"` under `DISABLED_CAPABILITIES`.

Either configure a capability properly or disable it. A validator that
qualifies by stake but fails its local self-test is **still counted in
quorum**, so a half-configured capability skips rounds and drags the quorum
math for everyone: the threshold rises with your stake, but you never answer.

Nothing on-chain penalises that today. SLASH burns stake on equivocation
proofs only, so an absent validator is not slashed; the hub-local
`SLASH_MISSED_ROUNDS_THRESHOLD` lane can mark a validator `suspended` in a
hub's own table, which no quorum read consults. On a network where ROLLCALL
is active, a validator absent for K consecutive rolled epochs is **evicted**
from the capability set: its stake is deactivated and refunded after the
cooldown, not burned. See `protocol/actions/rollcall.md`.

Do not put anything else in `hub-caps/`; the whole directory is mounted into
the hub and the installer refuses to build the mount if it holds any file
other than `capabilities.json`.

## Step 7: start the validator

```bash
cd ~/xchain-node
xchain-node install v0.12.3 xchain-hub
```

The installer provisions everything the hub needs: Docker networks, a MariaDB
container, the hub's database and user, then boots the hub in validator mode
with your signing key, your capability config and your DOGE signer mounted. On
a fresh machine it asks for a MariaDB root password **once**, interactively;
for unattended installs set `XCHAIN_NODE_DB_ROOT_PASSWORD` instead.

## Step 8: verify

```bash
xchain-node validator status        # what this node is configured as
xchain-node logs xchain-hub         # what it is doing
```

On the public explorer, no key needed. The two checks answer different
questions, and it is worth knowing which is which:

⬜ `https://explorer.xchain.io/TBTC/validator/<pubkey>` shows your STAKE as
`valid` with an activation block. This is **chain-derived**: it appears once
your STAKE is indexed, whether or not your hub is running.

⬜ `https://explorer.xchain.io/TBTC/validator_capabilities` lists your pubkey
per capability with `qualified: 1`. This is **reported by your own hub over
P2P**, not derived from the chain: your hub evaluates its own stake and
self-tests, then gossips that state to its peers. So it only appears after
your hub is running and peered, and its absence points at your P2P
connectivity or a failing self-test, never at your stake.

In the hub log:

⬜ `Stake-amount poll attached to <url>` (the indexer from step 5 is reachable)  
⬜ peer connections opening to the `validatorNN.xchain.io` seeds, with no `P2P: Invalid signature` lines  
⬜ `Capability MIN_STAKE (genesis, pinned ...)` matching the floors above

Peers admit your traffic within one signer-set refresh (30 seconds) of your
stake activating. You do not need to tell anyone.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `validator stake` says `BLOCKED: no confirmed TBTC` | The stake address has no testnet bitcoin for fees | Fund it (step 3) and re-run |
| `validator stake` says the pubkey already carries a valid STAKE | You are already staked | Nothing to do |
| Hub exits with `Missing/invalid required environment variable: HUB_NETWORK` | Validator initialized without a network (very old init, or a non-standard port) | Re-run `validator init --network testnet`, or set `HUB_NETWORK=testnet` in `.env` |
| Hub logs `Stake-amount poll disabled (no BTC indexer URL...)` | Step 5 not done | Install the BTC stack or set `BTC_INDEXER_API_URL` |
| Hub logs 401s from the indexer | Keyed indexer, no key | Set `BTC_INDEXER_API_KEY` |
| `oracle_publish` self-test fails `doge_address not configured` | `capabilities.json` was edited or predates the wallets | Re-run `validator init` (it fills the placeholders and keeps everything else) |
| Hub refuses to boot: `HUB_SIGNER_MODULE failed to load` | The signer directory is missing or its `.env` is incomplete | `xchain-node validator status` shows the signer path; re-run `validator init` to regenerate it |
| Staked and the hub is up, but you never appear in `validator_capabilities` | That table is gossiped from your hub to its peers, not read from the chain | Check the hub log for peer connections and for self-test failures; a capability that fails its self-test is never advertised |
| Qualified but never publishing | DOGE wallet empty | Top it up (step 3) |
| ROLLCALL signed but never appears on Dogecoin | Hand-built signer module has no `broadcast` export | Add `broadcast(payload)` to the module, or use the CLI-generated signer; `validator status` shows which you have |

## Mainnet differences

- `--network mainnet`, P2P port **10001**.
- XCHAIN is not mintable; acquire it and send it to the stake address, then
  `validator stake` skips the mint step.
- The oracle epoch has no built-in default yet; pass `--oracle-epoch-start`
  with the federation's value.
- The DOGE wallet spends real DOGE. Size it for the publishing cadence you
  expect and watch the low-balance warning.

## Removing yourself

```bash
xchain-node validator unstake              # dry run: shows the active stake
xchain-node validator unstake --broadcast  # withdraw it
```

It reads your active stake from the chain, refuses if there is nothing to
withdraw, and broadcasts `UNSTAKE` from the stake address.

**Standing down is not instant, and there are two clocks.** The stake keeps
counting toward every capability for **6 more blocks** after the unstake is
indexed, then drops out of the active set; that delay is the same reorg
protection that applies when you join. Your XCHAIN is on the longer clock: it
stays locked for a cooldown of **1000 blocks** (roughly 7 days on Bitcoin)
from the block the unstake lands in, and the cooldown sweep credits it back
only then. Plan around both rather than assuming you have left, or can spend,
the moment the transaction lands.

Stop the hub with `xchain-node stop xchain-hub` any time after that. Keep the
keys until the unstake has settled.
