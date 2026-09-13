<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# JSON Schemas

Machine-readable JSON artifacts for the XChain protocol.

## Token Information Standard (v1.1.1, current)

The off-chain token metadata document referenced by a token's on-chain `DESCRIPTION` URI.

- [Schema](./token-information-standard-v1.1.1-schema.json): JSON Schema for the metadata document.
- [Example](./token-information-standard-v1.1.1-example.json): a worked example that conforms to the schema.

v1.1.1 relaxes one constraint and adds nothing: an `images`, `audio`, `video` or `files` entry now requires `type` plus at least one of `data` (off-chain URL) or `data_ref` (on-chain `FILE` reference), where v1.1.0 required `data` outright and so rejected the fully on-chain form the standard itself recommends. It is a pure relaxation, so every v1.1.0 and v1.0.0 document remains valid.

### Previous versions

- v1.1.0: [schema](./token-information-standard-v1.1.0-schema.json), [example](./token-information-standard-v1.1.0-example.json). Frozen as published; its four media definitions require `["type", "data"]`, so a `data_ref`-only entry fails validation against it.
- v1.0.0: [schema](./token-information-standard-v1.0.0-schema.json), [example](./token-information-standard-v1.0.0-example.json). Frozen as published; it predates the token-gating fields (`packs`, `title`, `data_ref`, `locked`, `pack_id`). v1.1.0 is additive over it, so every v1.0.0 document is a valid v1.1.0 document.

See the [Token Information Standard](../token-information-standard.md) for the field-by-field reference.

---

**Copyright © 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC – https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later) with a commercial license available for proprietary use.
