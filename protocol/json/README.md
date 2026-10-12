<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# JSON Schemas

Machine-readable JSON artifacts for the XChain protocol.

## Token Information Standard (v1.1.2, current)

The off-chain token metadata document referenced by a token's on-chain `DESCRIPTION` URI.

- [Schema](./token-information-standard-v1.1.2-schema.json): JSON Schema for the metadata document.
- [Example](./token-information-standard-v1.1.2-example.json): a worked example that conforms to the schema.

v1.1.2 changes no field. It states the `dns` entry requirement in draft-04 keywords: every entry requires `type`, `host` and `value`, and an `MX` entry also requires `priority`. Earlier versions wrote that rule with `if`/`then`/`else` and `const` under a draft-04 declaration, so a validator honoring the declared draft never enforced it. A `dns` entry missing one of those fields is now rejected; every other v1.1.1 document remains valid.

### Previous versions

- v1.1.1: [schema](./token-information-standard-v1.1.1-schema.json), [example](./token-information-standard-v1.1.1-example.json). Frozen as published; its `dns` required fields use `if`/`then`/`else`/`const` under a draft-04 declaration, so a draft-04 validator does not enforce them. It relaxed one constraint over v1.1.0: an `images`, `audio`, `video` or `files` entry requires `type` plus at least one of `data` (off-chain URL) or `data_ref` (on-chain `FILE` reference), where v1.1.0 required `data` outright and so rejected the fully on-chain form the standard itself recommends.
- v1.1.0: [schema](./token-information-standard-v1.1.0-schema.json), [example](./token-information-standard-v1.1.0-example.json). Frozen as published; its four media definitions require `["type", "data"]`, so a `data_ref`-only entry fails validation against it. Its `dns` rule has the same draft-04 gap as v1.1.1.
- v1.0.0: [schema](./token-information-standard-v1.0.0-schema.json), [example](./token-information-standard-v1.0.0-example.json). Frozen as published; it predates the token-gating fields (`packs`, `title`, `data_ref`, `locked`, `pack_id`). v1.1.0 is additive over it (no new required field), so a v1.0.0 document is a valid v1.1.0 document unless it already used one of those five names as an extra with a type or length v1.1.0 now declares (`locked` must be a boolean; `title`, `data_ref` and `pack_id` strings of at most 255 characters; `packs` an object of pack entries). Its `dns` rule has the same draft-04 gap as v1.1.1.

See the [Token Information Standard](../token-information-standard.md) for the field-by-field reference.

---

**Copyright © 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC – https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later) with a commercial license available for proprietary use.
