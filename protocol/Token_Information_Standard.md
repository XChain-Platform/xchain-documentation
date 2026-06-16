<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Token Information Standard (TIS)

The Token Information Standard (TIS) defines standardized formats to associate information like images, audio, video, and files with a token.

# JSON Specifications

## v1.0.0
- [Token Information Standard JSON Schema](./json/token-information-standard-v1.0.0-schema.json)
- [Token Information Standard JSON Example](./json/token-information-standard-v1.0.0-example.json)

### JSON Field Definitions

| Field       | Type   | Description
| :---        | :---   | :---
| tick        | String | The TICK of the token
| description | String | A longish description about this token. 2048 characters max.
| website     | String | A link to the website for the token. 100 characters max.
| name        | String | The full name of the token
| html        | String | HTML code providing additional information or functionality
| owner       | Object | Information about the owner of this token
| contacts    | Array  | Information about how to contact the owner of this token
| categories  | Array  | Information on what type of categories this token falls into
| social      | Array  | Social media accounts related to this token
| images      | Array  | One or more images used to represent the token
| audio       | Array  | One or more audio files related to the token
| video       | Array  | One or more video files related to the token
| files       | Array  | One or more files related to the token
| packs       | Object | Display metadata for [token-gated content packs](./Token_Gated_Content.md). Map of pack id → `{ name, description }`.
| dns         | Array  | One or more DNS records related to the token.

### File Entry Fields

Entries inside the `files`, `audio`, `video`, and `images` arrays can carry the following fields:

| Field       | Type    | Description
| :---        | :---    | :---
| data        | String  | URL to the file (off-chain). Used for non-gated content.
| data_ref    | String  | Reference to an on-chain [`FILE`](./actions/FILE.md) action by `ACTION_INDEX`: `action:<index>` (same chain as the token) or `action:<COIN>:<index>` (sibling chain: base coin ticker `BTC`/`LTC`/`DOGE`, network tier implied by the token's network, same convention as [`LINK`](./actions/LINK.md)'s `COIN1`/`COIN2`). Lets cheap chains carry the bytes for tokens on expensive ones: e.g. a BTC token whose artwork FILE lives on DOGE. When both `data` and `data_ref` are present, clients prefer `data_ref`.
| name        | String  | Filename
| type        | String  | MIME type
| title       | String  | Display title
| locked      | Boolean | `true` if the file is encrypted and gated. Clients use this to render locked/unlocked states without first fetching the FILE action.
| pack_id     | String  | (Optional) Pack identifier grouping files that share an unlock key. References the top-level `packs` map for display name and description. Does not need to be present for unlocking to work; the protocol groups by `KEY_HASH` directly.


# NFT Usage

Tokens following the [NFT Standard](./NFT_Standard.md) use TIS as their **display
layer**: the protocol records which files a token's owner has officially attached (via
[`FILE`](./actions/FILE.md) + [`LINK`](./actions/LINK.md)), but attaches no display
semantics to them; the token's TIS document decides what clients render and how.

Recommendations for NFT issuers:

- **Declare intent** with a category entry so clients can distinguish a collectible
  from an integer-unit currency that happens to share the same field values:

```json
"categories": [ { "type": "main", "data": "NFT" } ]
```

- **Use `data_ref` for on-chain content.** Pointing `images`/`audio`/`video`/`files`
  entries at on-chain `FILE` actions (`"data_ref": "action:<index>"`) gives the display
  assets the same permanence as the token itself. Off-chain `data` URLs remain valid
  for creators who prefer them. For tokens on expensive chains, upload the bytes on a
  cheap sibling chain and reference them cross-chain
  (`"data_ref": "action:DOGE:<index>"`).
- **For a fully on-chain token**, upload the TIS JSON itself as a `FILE` action and
  set `DESCRIPTION=action:<index>` (the On-Chain Format below). With the document and
  its `data_ref` media all on-chain, every byte a client needs to render the token is
  recoverable from a full chain parse. No hosting, no hostnames.
- **For immutable presentation**, host the TIS JSON content-addressed (`ipfs:`/`ord:`/
  `ar:` or URL`;HASH` forms below) and set `LOCK_DESCRIPTION=1` on the token so the
  pointer can never change. (The on-chain `action:<index>` form is inherently
  content-immutable, locking the description makes the pointer immutable too.)

Clients classify a token as NFT-pattern by chain state (`DECIMALS=0` +
`LOCK_MAX_SUPPLY=1`; the canonical rule is defined in the
[NFT Standard](./NFT_Standard.md#classification-rule-for-clients)) and treat the TIS
category as the issuer's stated intent.

# Supported Token Description Formats

Below are a number of token description formats which should be recognized by XChain block explorers.

## IMAGE Format
<table>
<tr><td><b>Format</b></td><td>https://domain.com/imagename.jpg</td></tr>
<tr><td><b>Note</b></td><td>URL must end in gif, jpg, or png </td></tr>
<tr><td><b>Example</b></td><td>https://xchain.io/img/xchain-color-500.png </td></tr>
</table>

## JSON Format
<table>
<tr><td><b>Format</b></td><td>https://domain.com/info.json</td></tr>
<tr><td><b>Note</b></td><td>URL to a JSON file ending in .json</td></tr>
<tr><td><b>Example</b></td><td>j-dog.net/json/JDOG.json </td></tr>
</table>

## JSON Format with Hash
<table>
<tr><td><b>Format</b></td><td>https://domain.com/info.json;HASH</td></tr>
<tr><td><b>HASH</b></td><td>64-character sha256 hash</td></tr>
<tr><td><b>Note</b></td><td>URL to a JSON file ending in .json</td></tr>
<tr><td><b>Example</b></td><td>j-dog.net/json/JDOG.json;96fc96754c913f60e9d7a0be07d76ffbcdc53338295cbd69595e69cf49616c3b</td></tr>
</table>

## On-Chain Format (action index)
<table>
<tr><td><b>Format</b></td><td>action:INDEX <i>or</i> action:COIN:INDEX</td></tr>
<tr><td><b>INDEX</b></td><td>ACTION_INDEX of a <a href="./actions/FILE.md">FILE</a> action whose raw bytes are a TIS JSON document (declared MIME type <code>application/json</code>)</td></tr>
<tr><td><b>COIN</b></td><td>(optional) base coin ticker (<code>BTC</code>/<code>LTC</code>/<code>DOGE</code>) when the FILE lives on a <b>sibling chain</b>; omitted = same chain as the token. The network tier (mainnet/testnet/regtest) is implied by the token's network, same convention as <a href="./actions/LINK.md">LINK</a>'s <code>COIN1</code>/<code>COIN2</code>. Lets cheap chains carry the document for tokens on expensive ones.</td></tr>
<tr><td><b>Note</b></td><td>The fully on-chain form: the TIS document itself lives on a chain, so the token's display metadata has the same permanence as the token. Combine with <code>data_ref</code> entries inside the document for on-chain media (also same- or sibling-chain), and <code>LOCK_DESCRIPTION=1</code> for an immutable pointer. Same casing/format as <code>data_ref</code>, one level up. Clients resolve the bytes the same way they resolve <code>data_ref</code> (e.g. the explorer's <code>/{COIN}/api/file/{INDEX}/raw</code>).</td></tr>
<tr><td><b>Example</b></td><td>action:12345 &nbsp;·&nbsp; action:DOGE:12345</td></tr>
</table>

## IMGUR Format
<table>
<tr><td><b>Format</b></td><td>imgur/IMAGENAME;TITLE</td></tr>
<tr><td><b>IMAGENAME</b></td><td>Filename of the image on imgur.com</td></tr>
<tr><td><b>TITLE</b></td><td>Title of the image/artwork</td></tr>
<tr><td><b>Note</b></td><td>In the URL https://i.imgur.com/yTS3gEv.png the IMAGENAME is yTS3gEv.png</td></tr>
<tr><td><b>Example</b></td><td>imgur/yTS3gEv.png;XChain</td></tr>
</table>

## SOUNDCLOUD Format
<table>
<tr><td><b>Format</b></td><td>soundcloud/CODE;TITLE</td></tr>
<tr><td><b>CODE</b></td><td>Unique code for the audio on soundcloud.com</td></tr>
<tr><td><b>TITLE</b></td><td>the title of the song/artwork</td></tr>
<tr><td><b>Note</b></td><td>In the URL https://api.soundcloud.com/tracks/924613324 the CODE is 924613324</td></tr>
<tr><td><b>Example</b></td><td>soundcloud/924613324;Back in Blood</td></tr>
</table>

## YOUTUBE Format
<table>
<tr><td><b>Format</b></td><td>youtube/CODE;TITLE</td></tr>
<tr><td><b>CODE</b></td><td>Unique code for the video on youtube.com</td></tr>
<tr><td><b>TITLE</b></td><td>the title of the video/artwork</td></tr>
<tr><td><b>Note</b></td><td>In the URL https://www.youtube.com/watch?v=FenVJ_cyE5M the CODE is FenVJ_cyE5M</td></tr>
<tr><td><b>Example</b></td><td>youtube/FenVJ_cyE5M;Can't Suck Dick!</td></tr>
</table>

## IPFS Format
<table>
<tr><td><b>Format</b></td><td>ipfs:CODE</td></tr>
<tr><td><b>CODE</b></td><td>Unique IPFS CID that points to a JSON file</td></tr>
<tr><td><b>Note</b></td><td>The ipfs format only works with JSON files</td></tr>
<tr><td><b>Example</b></td><td>IPFS:QmdnznjxzrjmLGpwjiDrgfdAu5r7VB4tWWWVtNRtqYqACq</td></tr>
</table>

## Ordinals Inscription Format
<table>
<tr><td><b>Format</b></td><td>ord:CODE</td></tr>
<tr><td><b>CODE</b></td><td>Inscription Reveal Transaction ID (standard 64 character hex string or converted to Base64)</td></tr>
<tr><td><b>Note</b></td><td>The ord format works with inscribed JSON files and inscribed images (png, jpeg and gif only)</td></tr>
<tr><td><b>Example</b></td><td>ORD:1d36aa544a20be86dca452e3abe464d33dd8567392dee8e333f72519e97af679<br/>or<br/>ORD:HTaqVEogvobcpFLjq+Rk0z3YVnOS3ujjM/clGel69nk=</td></tr>
</table>

## Arweave Format
<table>
<tr><td><b>Format</b></td><td>ar:HASH</td></tr>
<tr><td><b>HASH</b></td><td>Arweave transaction hash that points to a JSON file</td></tr>
<tr><td><b>Note</b></td><td>The ar format only works with JSON files. The hash is resolved via the public Arweave gateway at https://arweave.net/HASH</td></tr>
<tr><td><b>Example</b></td><td>AR:jGxVm7yghVDfv39tJds8kRFFrIsGTsg3h-JgXHx_inw</td></tr>
</table>

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
