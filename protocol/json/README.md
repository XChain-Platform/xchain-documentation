<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# JSON Schemas

Machine-readable JSON artifacts for the XChain protocol.

## Token Information Standard (v1.1.0, current)

The off-chain token metadata document referenced by a token's on-chain `DESCRIPTION` URI.

- [Schema](./token-information-standard-v1.1.0-schema.json): JSON Schema for the metadata document.
- [Example](./token-information-standard-v1.1.0-example.json): a worked example that conforms to the schema.

### Previous versions

- v1.0.0: [schema](./token-information-standard-v1.0.0-schema.json), [example](./token-information-standard-v1.0.0-example.json). Frozen as published; it predates the token-gating fields (`packs`, `title`, `data_ref`, `locked`, `pack_id`). v1.1.0 is additive over it, so every v1.0.0 document is a valid v1.1.0 document.

See the [Token Information Standard](../token-information-standard.md) for the field-by-field reference.

---

**Copyright © 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC – https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later) with a commercial license available for proprietary use.
