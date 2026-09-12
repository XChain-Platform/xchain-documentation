<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - XBRIDGE
This action moves a token between chains by lock-and-mint / burn-and-release against a protocol-owned escrow, never by minting on two ledgers independently. Version `0` locks XCHAIN on BTC for a destination chain; version `1` burns XCHAIN on a destination chain to release it back on BTC; version `2` is the system-injected settle leg that applies a finalized transfer, on either side, and is never user-broadcast. Versions `3`, `4` and `5` generalize the same three-step lifecycle to any bridgeable token, naming the bridged copy under its origin chain's root (`BTC.PEPECASH`, `DOGE.FUFU`). See [Cross-Chain Bridge](../xchain-bridge.md) for XCHAIN's own bridge and [Token Bridge](../token-bridge.md) for the general framework, rooted naming, and the issuer opt-in.

Every version shares one manifest entry, one decoder name, one doc page (the `ATTEST` precedent: one name, mixed user- and system-formats). A version is refused with `invalid: XBRIDGE before activation` below its network's activation height (`XCHAIN_BRIDGE_ACTIVATION` for versions 0 to 2, `TOKEN_BRIDGE_ACTIVATION` for versions 3 to 5, the latter never lower than the former on any network).

## PARAMS
| Name           | Type    | Description                                                                                     |
| -------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `VERSION`      | Integer | Format version (0=lock XCHAIN, 1=burn XCHAIN, 2=settle XCHAIN, 3=lock token, 4=burn bridged token, 5=settle token) |
| `DEST_COIN`    | String  | Destination coin, a supported coin other than the source chain; v0, v3                           |
| `DEST_ADDRESS` | String  | Destination address on `DEST_COIN`, validated coin-and-network aware; v0, v3                     |
| `BTC_ADDRESS`  | String  | Destination BTC address, BTC-network validated; v1                                               |
| `TICK`         | String  | v3: a native (undotted, non-GAS) tick on this chain to lock. v4: a bridged row on this chain (`<ORIGIN>.<NAME>`) to burn |
| `ORIGIN_ADDRESS` | String | Destination address on the bridged tick's origin chain, validated against that chain; v4        |
| `AMOUNT`       | String  | Positive decimal, at most the token's `DECIMALS` fractional digits, at most the source's balance; v0, v1, v3, v4 |
| `TRANSFER_ID`  | String  | 64-hex id of the finalized `bridge_transfers` row this settle leg applies; v2, v5 (system-injected only, never user-supplied) |
| `MEMO`         | String  | An optional memo to include; v0, v1, v3, v4                                                      |

## Formats

### Version `0` - Lock XCHAIN (user-broadcast, BTC only)
- `XBRIDGE|0|DEST_COIN|DEST_ADDRESS|AMOUNT|MEMO`

### Version `1` - Burn XCHAIN (user-broadcast, non-BTC only)
- `XBRIDGE|1|BTC_ADDRESS|AMOUNT|MEMO`

### Version `2` - Settle XCHAIN (system-injected; never broadcast)
- `XBRIDGE|2|TRANSFER_ID`

### Version `3` - Lock a token (user-broadcast, origin chain only)
- `XBRIDGE|3|TICK|DEST_COIN|DEST_ADDRESS|AMOUNT|MEMO`

### Version `4` - Burn a bridged token (user-broadcast, bridged rows only)
- `XBRIDGE|4|TICK|ORIGIN_ADDRESS|AMOUNT|MEMO`

### Version `5` - Settle a token (system-injected; never broadcast)
- `XBRIDGE|5|TRANSFER_ID`

## Examples
```
XBRIDGE|0|DOGE|D8bFJYQ6JZ4tSjzZbXqXYh2vN3xKzQpump|500|
Locks 500 XCHAIN on BTC into the DOGE escrow (ADDRESS.BRIDGE_DOGE); a matching XBRIDGE v2 credits the DOGE address once the federation finalizes the transfer
```

```
XBRIDGE|1|1ExampleAddressXXXXXXXXXXXXXXXXXXX|200|
Burns 200 XCHAIN on DOGE, lowering DOGE's XCHAIN supply by 200; a matching XBRIDGE v2 on BTC releases 200 from ADDRESS.BRIDGE_DOGE to the named BTC address
```

```
XBRIDGE|3|PEPECASH|DOGE|D8bFJYQ6JZ4tSjzZbXqXYh2vN3xKzQpump|1000|
Locks 1000 native PEPECASH on BTC (PEPECASH's origin chain) into the DOGE escrow; the copy arrives on DOGE as BTC.PEPECASH
```

```
XBRIDGE|4|BTC.PEPECASH|1ExampleAddressXXXXXXXXXXXXXXXXXXX|250|
Burns 250 of the bridged BTC.PEPECASH row on DOGE; a matching XBRIDGE v5 releases 250 native PEPECASH on BTC to the named BTC address
```

## Rules
- Below `XCHAIN_BRIDGE_ACTIVATION` (v0 to v2) or `TOKEN_BRIDGE_ACTIVATION` (v3 to v5) for the network, every version returns `invalid: XBRIDGE before activation`.
- **Version 0 (lock XCHAIN).** BTC only; on any other chain, `invalid: XBRIDGE (BTC only)`. `DEST_COIN` must be a supported coin other than BTC (`invalid: DEST_COIN`). `DEST_ADDRESS` is validated with the coin-and-network-aware address check for `DEST_COIN` (`invalid: DEST_ADDRESS`). `AMOUNT` must be a positive decimal at up to 8 fractional digits and no more than the source's XCHAIN balance (`invalid: AMOUNT`, `invalid: insufficient funds`). Debits the source and credits `ADDRESS.BRIDGE_<DEST_COIN>`; no supply change on BTC. Fee: `XBRIDGE_BASE` (5,000 gas).
- **Version 1 (burn XCHAIN).** Non-BTC only; on BTC, `invalid: XBRIDGE v1 is not valid on BTC`. `BTC_ADDRESS` is validated as a BTC address (`invalid: BTC_ADDRESS`). Debits the source and lowers this chain's XCHAIN supply by `AMOUNT`. Fee: `XBRIDGE_BASE`, paid in native coin.
- **Version 2 (settle XCHAIN).** System-injected only from a finalized `bridge_transfers` row; a broadcast v2 is refused with `invalid: XBRIDGE v2 is system-injected`. On the destination (from a lock): credits `DEST_ADDRESS` and raises this chain's XCHAIN supply, creating the token row on first use if it does not yet exist. On BTC (from a burn): debits `ADDRESS.BRIDGE_<src_chain>` and credits the named BTC address; an escrow that would go negative is refused outright and logged once, applying nothing. Pays no fee.
- **Version 3 (lock a token).** User-broadcast only on the token's own origin chain. The `TICK` guards run in this order, and the first one that fails is the verdict: an origin-rooted name (`<ORIGIN>.<NAME>`) is a bridged copy, not a native row, so it is refused with `invalid: TICK (not native here)` and burned with v4 instead; the GAS tick keeps v0 (`invalid: TICK (use XBRIDGE v0)`, matched case-insensitively because every ticker lookup is); a native name carrying a dot is `invalid: TICK (subassets are not bridgeable yet)`, lifted in a later milestone; a name too long to carry this chain's root and a dot once rooted is `invalid: TICK (too long to bridge)`; and finally the row's [bridge opt-in](./issue.md#version-7---bridge-opt-in) must name `DEST_COIN` (`invalid: TICK (not bridgeable to DEST_COIN)`). `DEST_ADDRESS` and `AMOUNT` validate as v0. A sleeping or list-blocked source cannot lock. Debits the source and credits the destination's escrow; stamps the row's `DECIMALS` and confirmation depth onto the pending transfer. Fee: `XBRIDGE_BASE`.
- **Version 4 (burn a bridged token).** User-broadcast only against a bridged row (`<ORIGIN>.<NAME>`) on the chain that received it; a native row, or a rooted name this chain's keyless bridge role address does not own, is refused with `invalid: TICK (not bridged)`. `ORIGIN_ADDRESS` is validated against the tick's origin chain, not against this one, and a failure is `invalid: ORIGIN_ADDRESS`. Debits the source and lowers the bridged row's supply. Fee: `XBRIDGE_BASE`.
- **Version 5 (settle a token).** System-injected only, the v2 lifecycle with a tick; a broadcast v5 is refused with `invalid: XBRIDGE v5 is system-injected`. On the destination (from a lock): creates the origin-rooted root and child rows on first use, credits the destination address, raises the bridged row's supply. On the origin (from a burn): debits the destination coin's escrow, credits the named address on the origin chain; a negative escrow is refused the same way as v2. Injected legs bypass sleep and list checks the way `CROSS_SETTLE` does, so a sleeping origin still releases escrow to a burner. Pays no fee.
- A source `SLEEP`, `ALLOW_LIST` or `BLOCK_LIST` on the token blocks a new v0/v3 lock and v1/v4 burn the same way it blocks a `SEND`; it never blocks the injected v2/v5 settle leg, and it has no effect on a copy already bridged elsewhere.

## Trust model, stated plainly

The record a lock or burn produces is signed by the hub's `cross_chain` federation and mirrored to every indexer; the destination applies it once quorum-verified against the mirrored validator set. Milestone 1 is therefore a **hub-trusted mint**: a compromised hub can supply both the transfer record and the roster that verifies it. This is the same trust boundary the cross-chain DEX already runs on, stated here rather than left implicit. A destination-side check against the origin chain's own signed state (a checkpoint cross-check) closes that boundary before this action is armed on mainnet; see [Cross-Chain Bridge](../xchain-bridge.md#trust-model) for the full statement and its status.

## Reorgs and finality

If the source lock or burn is reorged out before the federation signs it, no transfer record is ever produced. If a finalized record's source is reorged out before it applies, the federation retracts it and the destination never applies it. **Once a mint or release has applied on the destination, it is final**: the platform has no destination-side unwind, so a later reorg of the *source* leg leaves the applied credit in place and shows up instead as a reported deficit between the escrow and the shadow supply it backs (`getbridgeinvariant`, [Cross-Chain Bridge](../xchain-bridge.md#the-supply-invariant)), which the confirmation depth exists to make expensive to reach. A plain credit landed on an escrow address with no matching transfer record (a stray `SEND`, `AIRDROP`, or DEX fill) is the opposite case, a harmless surplus, never a deficit.

## Notes
- The escrow addresses (`ADDRESS.BRIDGE_<COIN>`, one per non-origin coin per network) are ordinary keyless protocol role addresses; nobody holds a key for them, so a lock's credit and a burn's release both settle as plain ledger balance moves with no new escrow table.
- A general token's bridged copy is named under its origin chain's root, `<ORIGIN>.<NAME>` (`BTC.PEPECASH`, `DOGE.FUFU`), never a bare name a squatter could pre-register on the destination. See [Token Bridge](../token-bridge.md) for the naming rule and its two limits (dotted origin names, tick length) in milestone 1.
- Bridging a token is opt-in and owner-controlled: see [ISSUE format `7`](./issue.md#version-7---bridge-opt-in) for `BRIDGE_CHAINS`, `MIN_DEPTH`, and `LOCK_BRIDGE`.
- `XBRIDGE` is unrelated to the [Cross-Chain DEX](../cross-chain-dex.md) (`ORDER`/`SWAP` matched across chains through the same federation): the DEX trades a token that already exists on both sides, while `XBRIDGE` is how a token gets a shadow balance on a chain it was never issued on in the first place.
- `getbridgeinvariant` (hub, open read) and `getpendingbridgetransfers` / `getbridgetransfer` (indexer, open read) surface the escrow-versus-supply invariant and in-flight transfers; see [Cross-Chain Bridge](../xchain-bridge.md#reads) for their shape.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
