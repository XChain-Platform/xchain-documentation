<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Build a Stakeable Contract

A stakeable contract is a smart contract that anyone can lock tokens against. The contract's own code decides what locking up tokens unlocks for the staker — access, voting weight, a yield, a seat in some game — and the contract can slash any staker's locked tokens at any time according to rules you (the contract author) defined. The protocol handles bookkeeping, cooldown periods, and routing slashed tokens to a destination you set at deploy time.

Contract staking is a **general-purpose developer primitive**. It is separate from the network's own validator staking — the two systems share no state. Any contract on **Bitcoin, Litecoin, or Dogecoin** can be stakeable.

This tutorial walks through deploying a stakeable contract, locking tokens against it, reading and slashing stakes from inside the contract, and unstaking. It assumes you have already worked through [Build_Your_First_Token.md](Build_Your_First_Token.md) and ideally also [Smart_Contract_Development.md](Smart_Contract_Development.md).

---

## Prerequisites

- SDK connected to a regtest or testnet stack (see [Regtest_Development.md](Regtest_Development.md))
- A token you control with enough supply for stakers to lock up — `MYTOKEN` in the examples below. If you don't have one yet, issue one now.
- Two funded addresses: the **contract author** (who will deploy) and at least one **staker** (who will lock tokens against the contract).
- Enough native coin on the deploying chain to cover transaction fees.

---

## Step 1: Decide What Staking Means For Your Contract

Before writing code, pin down four things:

1. **What does staking unlock?** Access to a method? A seat in a game? Eligibility to claim a reward? Voting weight? The protocol doesn't enforce any of this — your contract's code does.
2. **What gets slashed, and by whom?** Slashing is unilateral — only your contract can slash its own stakers. Decide what behaviors trigger a slash and how much.
3. **What is the cooldown period?** When a staker calls `UNSTAKE`, their tokens are not returned immediately. You set the cooldown in **blocks** (any value from 1 to 100,000) at deploy time. This is **permanent** — it cannot be changed later.
4. **Where do slashed tokens go?** Either a specific on-chain address (a treasury, a community pool, a reward sink) or the literal sentinel `BURN`, which routes to the chain's configured burn address. Also **permanent** at deploy time.

Stakers will read both of those settings before they decide to lock anything up. Design them to be defensible.

---

## Step 2: Write the Contract

Stakeable contracts use the same JavaScript runtime as any other XChain smart contract. The extra surface is the `xchain.contract.*` accessor, which lets a contract read and modify its own stakes.

Here is a small example: a contract that grants a method (`getSecret`) to anyone who has staked at least 100 `MYTOKEN`, and allows an admin pubkey to slash a misbehaving staker.

```js
module.exports = {
    init: function(adminPubkey) {
        // Store the admin's pubkey in state. Set once at construction.
        xchain.state.set('admin', adminPubkey);
    },

    // Anyone who staked >= 100 MYTOKEN can call this and get the secret.
    getSecret: function() {
        var caller = xchain.getInputParam(0);  // pubkey passed by caller
        var staked = xchain.contract.getStake(caller, 'MYTOKEN');
        if (xchain.math.gte(staked, '100')) {
            return 'the secret handshake';
        }
        return 'not eligible';
    },

    // How many MYTOKEN are locked across all stakers?
    totalLocked: function() {
        return xchain.contract.getTotalStaked('MYTOKEN');
    },

    // Top 1000 stakers, sorted descending. Useful for leaderboards.
    leaderboard: function() {
        return xchain.contract.getStakers('MYTOKEN');
    },

    // Only the admin can call this. Slashes one staker by a specific amount.
    // Slashed tokens go to whatever SLASH_DESTINATION was set at deploy time.
    slashStaker: function() {
        var caller   = xchain.getInputParam(0);  // who is calling
        var pubkey   = xchain.getInputParam(1);  // who to slash
        var amount   = xchain.getInputParam(2);  // how much
        var admin    = xchain.state.get('admin');

        if (caller !== admin) {
            return 'unauthorized';
        }

        xchain.contract.slash(pubkey, 'MYTOKEN', amount);
        return 'slashed';
    }
};
```

A few things to notice:

- The contract reads stakes with `xchain.contract.getStake(pubkey, tick)`. The `pubkey` is the Ed25519 signing key the staker used (passed in via `STAKE v3`). Stakers are identified by pubkey, not by address.
- `xchain.contract.slash(pubkey, tick, amount)` is the *only* way tokens leave a staker's balance other than them calling `UNSTAKE`. It can only target stakers of **this** contract — you cannot slash someone else's contract's stakers.
- `getStakers` returns the top 1000 stakers by amount. If you expect more than 1000, don't design rules that require iterating all of them in one call.

For the full `xchain.contract.*` reference, see [Smart_Contract_Development.md](Smart_Contract_Development.md#contract-staking).

---

## Step 3: Deploy the Contract as Stakeable

Use the SDK's `deployStakeableContract` workflow. This is `DEPLOY v1` under the hood — `VERSION: '1'`, with `COOLDOWN_BLOCKS` and `SLASH_DESTINATION` set.

```js
const XChainSDK = require('xchain-sdk');
const sdk = new XChainSDK({ hubUrl: 'http://localhost:35500' });

const contractSource = `module.exports = { /* ... the code from Step 2 ... */ };`;

const result = await sdk.workflows.deployStakeableContract(
    AUTHOR_WIF,
    {
        code: contractSource,
        gasLimit: 500000,
        constructorParams: [ADMIN_PUBKEY_HEX],   // passed to init(...)
        COOLDOWN_BLOCKS: 100,                    // 100 blocks before unstaked tokens are returned
        SLASH_DESTINATION: 'BURN'                // slashed tokens go to the burn address
        // SLASH_DESTINATION can also be a regular address:
        // SLASH_DESTINATION: 'mvThcDEbeqog2aJ7JNj1FefUPaNdYYGqHt'
    },
    []   // no initial deposits in this example; pass [{ tick, quantity }, ...] to seed the contract with funds
);

console.log('contract action_index:', result.deploy.indexed.action_index);
console.log('contract address:',      result.deploy.indexed.contract_address);
```

After the DEPLOY v1 confirms, the contract is live and stakeable. Anyone on the same chain (BTC, LTC, or DOGE) can begin staking against it.

**Key constraints set in stone at deploy time:**

| Field | Bounds | Mutable after deploy? |
|---|---|---|
| `COOLDOWN_BLOCKS` | `[1, 100000]` | No |
| `SLASH_DESTINATION` | Valid address on the deploying chain, or `BURN` | No |
| Contract code | n/a — already immutable for all contracts | No |

If you set `SLASH_DESTINATION` to an address that is later compromised or lost, those slashed tokens still go there. Choose carefully.

---

## Step 4: Stake Against the Contract

A staker uses `STAKE v3`. The SDK exposes this as `stakeToContract`:

```js
const stakerSession = sdk.session(STAKER_WIF);

// Stake 250 MYTOKEN. signingPubkey is the Ed25519 key the staker will use
// to delegate / unstake / be slashed. It is independent of the staker's
// regular wallet address — generate one per stake.
const stakeResult = await stakerSession.stakeToContract({
    amount:              '250',
    signingPubkey:       STAKER_SIGNING_PUBKEY_HEX,   // 64 hex chars (Ed25519)
    targetContractIndex: result.deploy.indexed.action_index,
    tick:                'MYTOKEN'
});
```

This locks 250 MYTOKEN out of the staker's balance and writes a row in the `contract_stakes` table. Once the action is confirmed (and the 6-block activation delay has elapsed), `xchain.contract.getStake(pubkey, 'MYTOKEN')` inside the contract will return `'250'` for that staker.

**Stake-and-execute pattern:** if the contract grants access on stake, a staker often wants to immediately call a contract method. Use `BATCH v0` to bundle `STAKE v3 + EXECUTE v0` into one broadcast — the EXECUTE will see the new stake once the BATCH is indexed.

```js
await stakerSession.batch([
    sdk.stakeToContract({ amount: '250', signingPubkey, targetContractIndex, tick: 'MYTOKEN' }),
    sdk.execute({ contractActionIndex: targetContractIndex, method: 'getSecret', params: [signingPubkey] }),
]);
```

(Note: the activation delay still applies — the stake isn't visible inside the contract until 6 blocks after the BATCH confirms. The EXECUTE will see `getStake(...) === '0'` if it runs in the same block as the STAKE.)

---

## Step 5: Slash a Staker

Calling the `slashStaker` method from the admin pubkey deducts tokens from a specific staker and routes them to the deploy-time `SLASH_DESTINATION`:

```js
const adminSession = sdk.session(ADMIN_WIF);

await adminSession.execute({
    contractActionIndex: targetContractIndex,
    method: 'slashStaker',
    params: [
        ADMIN_PUBKEY_HEX,           // caller
        MISBEHAVING_STAKER_PUBKEY,  // who to slash
        '50'                         // how much MYTOKEN
    ]
});
```

A few things to know about slashing:

- **Authorization is implicit and per-contract.** A contract can only slash its own stakers — you cannot accidentally drain someone else's contract's stakers.
- **Slash reaches active stake first, then cooldown-locked stake.** A staker cannot dodge a slash by initiating an unstake — the protocol pulls from the cooldown queue if the active stake isn't enough.
- **Over-slash is silently capped.** If you ask to slash 100 but the staker only has 30 locked, it slashes 30 and continues without throwing.
- **The destination is permanent.** Slashed tokens go to whatever `SLASH_DESTINATION` you set at deploy time — `BURN` (the chain's burn address), or a regular address.

---

## Step 6: Unstake

When a staker wants their tokens back, they call `UNSTAKE v1`. This **begins** the cooldown — the tokens are not returned immediately.

```js
await stakerSession.unstakeFromContract({
    signingPubkey:       STAKER_SIGNING_PUBKEY_HEX,
    targetContractIndex: targetContractIndex,
    tick:                'MYTOKEN'
});
```

After this confirms:

1. After **6 blocks**, the stake becomes invisible to the contract (`xchain.contract.getStake(...) === '0'`). The staker is effectively no longer participating.
2. After **`COOLDOWN_BLOCKS` more blocks** (so block + 6 + COOLDOWN_BLOCKS in total), the locked tokens are credited back to the staker's address.

During the cooldown window, the contract can still slash the staker — the cooldown-locked balance is reachable by `xchain.contract.slash`.

---

## Step 7: Rotate or Revoke the Signing Key (DELEGATE)

A staker can rotate their signing pubkey without un-staking, using `DELEGATE v1`:

```js
await stakerSession.delegateForContract({
    newSigningPubkey:    NEW_STAKER_PUBKEY_HEX,
    targetContractIndex: targetContractIndex,
    tick:                'MYTOKEN'
});
```

After the 6-block activation delay, the old pubkey is retired and the new pubkey owns the stake row. Useful for key hygiene without exiting the stake.

To revoke a delegated key without replacing it, use `DELEGATE v3`:

```js
await stakerSession.delegate({
    version:             3,
    signingPubkey:       OLD_STAKER_PUBKEY_HEX,
    targetContractIndex: targetContractIndex,
    tick:                'MYTOKEN'
});
```

Until the staker delegates a new key, the stake row has no valid signer.

---

## Common Patterns

**Reputation-weighted DAO membership.** Deploy a stakeable contract where each method gates on `getStake(caller, 'MYTOKEN') >= threshold`. Members lose voting power when slashed for bad-faith votes.

**Security bond for a service operator.** A service deploys the contract and stakes their own bond against it. Users get paid out of the bond if the service misbehaves — the slashStaker method routes slashed tokens to the affected user's address (via a per-incident `SLASH_DESTINATION` baked into a fresh contract deploy per incident, or via a payout contract method that consumes contract-held funds after a slash).

**Prediction market.** Participants stake against a side of a question. When the outcome resolves, the contract slashes everyone who staked the wrong side and pays out winners from the slashed pool plus the contract's own balance.

**Validator-style services on top of XChain.** A contract runs its own internal validator set — for a sidechain bridge, a relay, a federated oracle — gated by stake. The contract itself decides who can sign on its behalf based on stake weight.

For more examples, see [user-guide/Use_Cases.md#native-multi-chain-staking](../user-guide/Use_Cases.md#native-multi-chain-staking).

---

## Read-Through Checklist Before Mainnet

- [ ] You have explicitly chosen `COOLDOWN_BLOCKS` and verified it matches the kind of behavior you want stakers to commit to. Long cooldowns punish exit; short cooldowns let bad actors un-stake before consequences land.
- [ ] You have explicitly chosen `SLASH_DESTINATION` and the receiving address (if not `BURN`) is one you control or have publicly committed to in writing.
- [ ] You have tested the contract end-to-end on regtest (DEPLOY v1 → STAKE v3 → EXECUTE → slash → UNSTAKE v1 → cooldown completion).
- [ ] You have considered what happens if you (the deployer) lose access to your admin key. Slashing pathways gated on admin-only access become permanently unreachable in that case.
- [ ] You have documented the staking rules for prospective stakers in a place they will see *before* they lock tokens up.

---

## Next Steps

- [Smart_Contract_Development.md](Smart_Contract_Development.md) — full reference for the `xchain.contract.*` accessor and the rest of the VM API.
- [user-guide/Use_Cases.md#native-multi-chain-staking](../user-guide/Use_Cases.md#native-multi-chain-staking) — more concrete contract-staking applications.
- [protocol/Contract_Staking.md](../protocol/Contract_Staking.md) — the protocol-level specification.
- [Batch_Operations.md](Batch_Operations.md) — bundle STAKE v3 with EXECUTE (or other actions) into a single broadcast.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/licensing).
