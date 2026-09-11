<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Contract ABI (Display Metadata)

A deployed contract MAY describe its callable methods by exporting a static
`abi` object alongside them. Wallets and explorers use it to render a method
selector, named/typed parameter inputs, and one-line method descriptions
instead of anonymous positional fields. It is the XChain analogue of a
"verified contract ABI" on account-based chains, with one important
difference: XChain contracts are plain JavaScript source stored on-chain, so
the callable surface is already discoverable; the `abi` only adds names,
types, and descriptions on top.

The `abi` is **purely advisory display metadata**. The VM never reads it, the
indexer never validates or stores it separately, it participates in no
consensus rule, and it costs nothing beyond the code bytes it occupies (code
is metered per byte at deploy). A contract without an `abi` (or with a
malformed one) works exactly like any other; consumers fall back to the
name-only method list they extract from the source.

## Declaration

The `abi` is a property on the `module.exports` object, next to the methods
it describes. The entire block MUST be a **static literal** (no computed
keys, no identifiers, no function calls) so tools can read it from the AST
without executing contract code:

```js
module.exports = {
    meta: {
        name:        'Escrow',
        description: 'Two-party escrow with an arbiter',
        version:     '1.0.0'
    },

    abi: { version: 1, methods: {
        fund:   { summary: 'Deposit the escrow amount', params: [ { name: 'tick', type: 'tick' }, { name: 'amount', type: 'amount' } ] },
        status: { summary: 'Read escrow status', params: [], view: true }
    } },

    fund:   function (xchain) { /* ... */ },
    status: function (xchain) { /* ... */ }
};
```

| Field | Meaning |
|---|---|
| `version` | Numeric literal, currently `1`. The **ABI schema version**, not the contract's own version; see the section below. Readers ignore the whole block if missing or non-numeric. |
| `methods` | Object literal keyed by method name. Methods absent from the map simply have no metadata. |
| `methods.<m>.summary` | Optional one-line description (string literal). |
| `methods.<m>.params` | Optional array of `{ name, type }` object literals, in wire order. Defaults to `[]` (a no-argument method). |
| `methods.<m>.view` | Optional boolean literal. `true` declares the method read-safe: UIs group it under "Read" surfaces (e.g. the explorer's simulation card) instead of "Write". Default `false`. |

### Parameter types

Types shape input UX only (placeholders, numeric keyboards, client-side
sanity checks). The wire format is unchanged: `EXECUTE` params are always
positional pipe-delimited strings.

| Type | Intent |
|---|---|
| `string` | Free-form text |
| `number` | Integer or decimal count (block heights, indexes) |
| `amount` | Token quantity in display units |
| `address` | Chain address |
| `tick` | Token ticker |
| `bool` | The string `true` or `false` |
| `json` | JSON-encoded payload |

## Relationship to the identity manifest (`meta`)

`meta` and `abi` sit side by side on the export object and answer different
questions: `meta` says **what this contract is** (its name, its one-line
description, its own version), and `abi` says **what its methods look like**.
They also have different rule strengths, which is why they are separate keys
rather than one block. `meta` is read at deploy time by the VM and judged by
consensus: at/after the `CONTRACT_META_REQUIRED` activation a missing or
malformed `meta` rejects the DEPLOY outright, and the accepted values are
extracted into indexed columns the explorer searches. `abi` is never read at
deploy time at all, is parsed statically off the source by readers, and is
ignored wholesale when malformed. See
[DEPLOY](actions/deploy.md#contract-identity-manifest-meta-required-at-the-flag-day)
for the `meta` verdicts and grammar.

**`abi.version` and `meta.version` are different things.** `abi.version` is
the numeric schema version of the ABI block itself (currently `1`) and moves
only when this document's format changes. `meta.version` is a string the
author chooses for their own contract (`'1.0.0'`), is validated only as text,
and means nothing to consensus beyond being stored and displayed. A contract
carrying `abi: { version: 1 }` and `meta: { version: '2.3.0' }` is entirely
ordinary.

## Reader behavior (fail-closed)

Reference readers: `contract-introspect.js` in xchain-explorer (served as the
`abi` field on `GET /{COIN}/api/contract/{idx}`) and
`ContractUtils.parseAbi()` in xchain-sdk. Both apply the same rules:

- A dynamic or structurally wrong `abi` / `version` / `methods` makes the
  whole block unreadable: readers return null and UIs fall back to the
  name-only method list.
- A malformed **single method entry** (unknown param type, non-literal
  values, wrong shapes) drops only that method's metadata; the rest of the
  `abi` survives.
- A contract that exports a *function* named `abi` has a dispatchable method
  called `abi` and no metadata; readers distinguish the two by AST node type.
- `initialize` (the DEPLOY-time constructor, see [DEPLOY](actions/deploy.md))
  is conventionally omitted from `abi.methods`; constructor arguments are
  visible on the deploy action itself. A future `constructorParams` top-level
  field is reserved for describing them.

## Security note

The `abi` is **self-declared by the contract author and never verified
against the code**. A malicious contract can declare `view: true` on a
state-mutating method, or write misleading summaries and parameter names to
social-engineer callers. Consumers MUST treat it as untrusted display hints:

- Never use the `abi` for authorization, consensus, or settlement decisions.
- The `view` flag is a presentation grouping, not a safety boundary; the
  explorer's read-simulation sandbox discards all effects regardless of it.
- UIs that render `abi` metadata SHOULD keep a manual/positional entry lane
  available and point users at the on-chain source, which is the only
  authoritative description of what a method does.
