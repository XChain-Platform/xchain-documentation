<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform Action - FILE
This action uploads a file including file metadata. The action also supports **token-gated cryptographically secure files** — encrypted on-chain such that only holders of a specific token can decrypt them. Gating is enabled by populating the optional `GATE_TICKER`, `ENCRYPTION_METHOD`, and `KEY_HASH` fields. See [Token-Gated Content](../Token_Gated_Content.md) for the end-to-end design.

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

## Formats

### Version `0`
- `VERSION|NAME|TYPE|TITLE|MEMO|GATE_TICKER|ENCRYPTION_METHOD|KEY_HASH`

The gating fields are optional and appended after `MEMO`. The encoder strips trailing empty fields, so a non-gated file serializes to the compact `FILE|0|NAME|TYPE|TITLE|MEMO` form and is wire-compatible with software that predates the gating extension.

## Examples
```
FILE|0|test.txt|text/plain|Test File|This is a test upload
This example uploads a plain text file named test.txt with the `TITLE` of Test File and a `MEMO`. Trailing gating fields are empty and stripped.
```

```
FILE|0|xchain.jpg|image/jpeg|XChain Logo|This is the official XChain Logo
This example uploads a JPEG file with the `TITLE` of XChain Logo and a `MEMO`.
```

```
FILE|0|stems.zip|application/zip|PEPECREATURE Stems|Audio stems for holders|PEPECREATURE|1|abc123...
This example uploads an encrypted ZIP gated by the PEPECREATURE token. `ENCRYPTION_METHOD` `1` = AES-256-GCM. The raw file data is the ciphertext (format `[12-byte nonce][ct][16-byte tag]`); the `KEY_HASH` lets holders verify they received the correct key.
```

## Rules
- When `GATE_TICKER` is non-empty, the SOURCE address must be the **issuer** of the gated token (i.e. the OWNER of the most recent valid `ISSUE` for `GATE_TICKER`). Otherwise the FILE is invalid. Prevents third parties from gating spam content to popular tickers.
- When `GATE_TICKER` is non-empty, `ENCRYPTION_METHOD` must be `1` (AES-256-GCM). Other values reserved for future algorithms.
- When `GATE_TICKER` is non-empty, `KEY_HASH` must be a 64-character lowercase hex string (32 bytes / 256 bits).
- When `GATE_TICKER` is non-empty, `rawData` is the ciphertext: `[12-byte nonce][ciphertext][16-byte GCM authentication tag]`.

## Pack semantics
Two or more gated `FILE` actions with the same `GATE_TICKER` **and** the same `KEY_HASH` form a **pack** — they share a symmetric key and unlock together. Pack membership is implicit in the shared `KEY_HASH`; the protocol does not need a separate "pack" concept. See [Token-Gated Content](../Token_Gated_Content.md) for details and use cases.

## Notes
- Raw file data is uploaded by specifying it as `rawData` to the XChain encoder.
- `TYPE` can be any MIME type supported at https://www.iana.org/assignments/media-types/media-types.xhtml
- `TYPE` examples :
  - `text/plain` = Text File
  - `text/html`  = HTML File
  - `text/csv` = Command Separated Values File
  - `image/jpeg` = JPEG File
  - `image/png` = PNG File
  - `image/gif` = GIF File
- A `FILE` may appear inside a `BATCH`, typically paired with a `MESSAGE` v2 (ECIES) so that an issuer publishing a gated file commits the recoverable key in the same transaction as the encrypted file. See [`BATCH`](./BATCH.md) and [Token-Gated Content](../Token_Gated_Content.md).

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
