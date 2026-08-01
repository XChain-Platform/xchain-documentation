<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Platform Action - FILE
This action uploads a file including file metadata. The action also supports **token-gated cryptographically secure files**, encrypted on-chain such that only holders of a specific token can decrypt them. Gating is enabled by populating the optional `GATE_TICKER`, `ENCRYPTION_METHOD`, and `KEY_HASH` fields, with an optional `GATE_MIN_AMOUNT` to require a minimum holding rather than any holding. See [Token-Gated Content](../token-gated-content.md) for the end-to-end design.

## PARAMS
| Name                | Type   | Description                                                              |
| ------------------- | ------ | ------------------------------------------------------------------------ |
| `VERSION`           | String | Format Version                                                           |
| `NAME`              | String | Name of the file                                                         |
| `TYPE`              | String | MIME Type of the file                                                    |
| `TITLE`             | String | Title of the file                                                        |
| `MEMO`              | String | An optional memo to include                                              |
| `GATE_TICKER`       | String | (optional) Token ticker that gates this file. Empty = public file.       |
| `ENCRYPTION_METHOD` | String | (optional) Encryption method code. `1` = AES-256-GCM. Required when gated. |
| `KEY_HASH`          | String | (optional) Hex `sha256(K)` of the symmetric key. Required when gated.    |
| `GATE_MIN_AMOUNT`   | String | (optional) Minimum balance of `GATE_TICKER` at which the content unlocks. Empty = any holder. |
| `COMPRESSION`       | String | (optional) How the stored bytes are compressed. Empty/absent = raw (every historical FILE). `1` = deflate-raw. Other values reserved. |

## Formats

### Version `0`
- `VERSION|NAME|TYPE|TITLE|MEMO|GATE_TICKER|ENCRYPTION_METHOD|KEY_HASH|GATE_MIN_AMOUNT|COMPRESSION`

The gating fields are optional and appended after `MEMO`. The encoder strips trailing empty fields, so a non-gated file serializes to the compact `FILE|0|NAME|TYPE|TITLE|MEMO` form and is wire-compatible with software that predates the gating extension. The same holds for `GATE_MIN_AMOUNT`: an eight-field gated FILE is byte-identical to what it was before the field existed, so every historical FILE reads the same way.

## COMPRESSION

`COMPRESSION` tells a reader how to reconstruct the original file from the bytes that are actually on chain. It is **presentational, never consensus**: FILE validity rules do not inspect `rawData`, so an indexer that has never heard of this field produces identical validity verdicts and identical state. What an old reader gets wrong is only the display, and only for files published after it.

That is also why **no reader may ever validate it**. Shipped indexers silently ignore unknown trailing fields, so a reader that rejected a malformed `COMPRESSION` value while others ignored it would fork validity across the fleet. An unknown or invalid code degrades to serving the stored bytes as-is; it never invalidates an action.

**Readers must derive `COMPRESSION` from the stored action string at serve time**, not from a column parsed at ingest. A compressed FILE mined before a given indexer upgraded would otherwise have been stored marker-less and served as deflated garbage forever, even after that indexer caught up.

**Public files.** The encoder compresses by default and keeps the compressed form only when it is genuinely smaller, so already-compressed media (JPEG, MP4, ZIP) silently rides raw. A reader inflates before serving, with a streamed 150:1 ratio guard, and falls back to the stored bytes with an explicit indicator if inflation fails: the field is sender-asserted and a lying one must never crash a reader or produce partial output.

**Gated files are the exception.** On a gated FILE, `COMPRESSION=1` means **inflate after decrypt**: the field describes the plaintext, which the client compressed before encrypting (see [Token-Gated Content](../token-gated-content.md)). Serving layers MUST NOT attempt to inflate ciphertext, and the encoder never sets the field on a gated FILE - it belongs to whoever performed compress-then-encrypt.

## Examples
```
FILE|0|test.txt|text/plain|Test File|This is a test upload
This example uploads a plain text file named test.txt with the `TITLE` of Test File and a `MEMO`. Trailing gating and compression fields are empty and stripped.
```

```
FILE|0|xchain.jpg|image/jpeg|XChain Logo|This is the official XChain Logo
This example uploads a JPEG file with the `TITLE` of XChain Logo and a `MEMO`.
```

```
FILE|0|stems.zip|application/zip|PEPECREATURE Stems|Audio stems for holders|PEPECREATURE|1|abc123...
This example uploads an encrypted ZIP gated by the PEPECREATURE token. `ENCRYPTION_METHOD` `1` = AES-256-GCM. The raw file data is the ciphertext (format `[12-byte nonce][16-byte GCM authentication tag][ciphertext]`); the `KEY_HASH` lets holders verify they received the correct key.
```

## Rules
- When `GATE_TICKER` is non-empty, the SOURCE address must be the **issuer** of the gated token (i.e. the OWNER of the most recent valid `ISSUE` for `GATE_TICKER`). Otherwise the FILE is invalid. Prevents third parties from gating spam content to popular tickers.
- When `GATE_TICKER` is non-empty, `ENCRYPTION_METHOD` must be `1` (AES-256-GCM). Other values reserved for future algorithms.
- When `GATE_TICKER` is non-empty, `KEY_HASH` must be a 64-character lowercase hex string (32 bytes / 256 bits).
- When `GATE_TICKER` is non-empty, `rawData` is the ciphertext: `[12-byte nonce][16-byte GCM authentication tag][ciphertext]`.
- `GATE_MIN_AMOUNT`, when present, must be a decimal amount strictly greater than zero (every zero form is invalid), at most 40 characters, digits with at most one `.`, no leading zeros unless the integer part is exactly `0`, a non-empty fractional part whenever a `.` is present, and no more decimal places than min(the gate token's divisibility, 18). A present-but-invalid value makes the FILE invalid rather than being ignored: a FILE is immutable, so a dropped threshold would leave the publisher believing one was in force while the chain recorded none.
- `GATE_MIN_AMOUNT` is only meaningful with a `GATE_TICKER`; on a non-gated FILE it is invalid, since there is no balance to weigh it against.

## Cost and storage

**A `FILE` pays no XCHAIN protocol fee.** The gas schedule's only per-byte term is
`VM_DEPLOY_PER_BYTE`, which applies to contract deployment, and the static protocol fee
covers `EXECUTE`/`DEPLOY`; `FILE` appears in neither. What a publisher pays is the **native
miner fee** on the host chain, which scales with the bytes actually written, so choosing a
cheaper carrier or letting `COMPRESSION` shrink the payload lowers the real cost directly.

This is a deliberate position, not an oversight. The Taproot envelope and default
compression together make a stored byte roughly 50x cheaper than the legacy chunk lane, and
those bytes live forever in every decoder, indexer and explorer database. Two limits, not a
fee, are what bound that growth:

- the per-encoding payload ceiling (`ENVELOPE_MAX_PAYLOAD` for envelope-carried actions,
  8,192 compiled bytes for the legacy lanes), enforced identically in the block and mempool
  paths, and
- the serve-time decompression ratio cap, which bounds what a crafted payload can inflate to
  in a reader.

If FILE volume ever makes storage growth an operational problem, the ceiling is the lever to
reach for. Anyone sizing indexer or explorer capacity should plan against the ceiling and
expected FILE rate rather than assuming a fee throttles demand, because none does.

## Pack semantics
Two or more gated `FILE` actions by the same **publisher** with the same `GATE_TICKER` **and** the same `KEY_HASH` form a **pack**; they share a symmetric key and unlock together. Pack membership is implicit in that triple; the protocol does not need a separate "pack" concept. A pack's effective unlock threshold is the MINIMUM `GATE_MIN_AMOUNT` across its files, and any file in it without a threshold makes the whole pack unconditional, because one key unlocks all of them. The publisher is part of the key because token ownership transfers: without it, a former issuer's files would keep setting the threshold for a token they no longer control. See [Token-Gated Content](../token-gated-content.md) for details and use cases.

## Notes
- Raw file data is uploaded by specifying it as `rawData` to the XChain encoder.
- `TYPE` can be any MIME type supported at https://www.iana.org/assignments/media-types/media-types.xhtml
- `TYPE` examples :
  - `text/plain` = Text File
  - `text/html`  = HTML File
  - `text/csv` = Comma Separated Values File
  - `image/jpeg` = JPEG File
  - `image/png` = PNG File
  - `image/gif` = GIF File
- A `FILE` may appear inside a `BATCH`, typically paired with a `MESSAGE` v2 (ECIES) so that an issuer publishing a gated file commits the recoverable key in the same transaction as the encrypted file. See [`BATCH`](./batch.md) and [Token-Gated Content](../token-gated-content.md).
- To officially associate an uploaded `FILE` with a `TICK` (e.g. NFT artwork or related content), the token's owner broadcasts a [`LINK`](./link.md) between the `FILE` and the token's `ISSUE`, see the [NFT Standard](../nft-standard.md).

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
