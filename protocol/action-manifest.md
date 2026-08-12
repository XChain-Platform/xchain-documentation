# ACTION manifest

`action-manifest.json` (this directory) is the authoritative registry of every
XChain protocol ACTION and which repositories must wire it. It is the single
source of truth for the cross-repo "action lockstep": today "what actions exist"
is re-encoded as an independent literal in roughly six places, and three of them
fail **closed and silent** if you forget one:

- forget the **decoder** `VALID_ACTION_NAMES` and every on-chain instance is dropped at decode;
- forget the **indexer** dispatch/registration and the action coerces to `UNKNOWN` and no-ops (per-node divergence is a ledger fork);
- forget the **explorer** `getActionData` branch and the public page renders blank.

## How it is enforced

Each repo vendors a byte-identical copy at `test/fixtures/action-manifest.json`
and ships an `ActionManifestConformance.test.js` that runs in its own unit tier
(no sibling checkout required). Each guard asserts two things:

1. **BEHAVIOR**: the repo's local action set equals the manifest slice for its role flag (`wireDecoded` for the decoder, `indexerHandled` for the indexer dispatch, `userEncodable` for the SDK Formats, `explorerRender` for the explorer, `walletForm` for the wallet registry).
2. **IDENTITY**: the vendored copy is byte-identical to this canonical file (skips when `xchain-documentation` is not checked out, matching the `ConsensusPrimitiveConformance` convention).

So adding an action everywhere-but-one-repo fails that repo's CI, naming the
missing action and the file to edit.

The SDK guard asserts a third thing, one level below the action set: each
`Formats[ACTION]` version set equals that action's `userEncodableVersions`
array. Without it the role flags are action-level only, so a VERSION the
indexer accepts solely from itself could be added to an authorable action's
Formats and every guard stayed green . Two such versions exist today:
`VOTE` v2 (finalize) is rejected from a user broadcast by
`if(!data['IS_SYNTHETIC'])` in the indexer's `vote.js`, and `PRICE` v0 is the
validator COIN/FIAT snapshot, valid only with a PBFT quorum of Ed25519
signatures from price-capability stakes. Both are parsed by the indexer and
absent from `userEncodableVersions`, so an SDK Format for either now fails CI
instead of shipping a composer for transactions that die on arrival.

## Schema

```jsonc
{
  "flags":      { /* what each per-repo role flag means */ },
  "categories": { /* human-readable grouping (wire-user / validator / mirror-injected / lifecycle / explorer-legacy-render) */ },
  "aliases":    { "TRANSFER": "SEND", ... },   // expanded to canonical before any gate
  "actions": {
    "SEND": { "category": "wire-user", "wireDecoded": true, "indexerHandled": true, "userEncodable": true, "userEncodableVersions": [0, 1, 2, 3], "explorerRender": true, "walletForm": true }
    // one entry per action; only the TRUE flags are present
  }
}
```

`userEncodableVersions` is required on every `userEncodable` action and
forbidden on the rest. It lists the FORMAT versions a user may author, audited
against the indexer handler's own `this.formats` map and its system-only gates
rather than copied from the SDK. Getting an entry wrong is worse than leaving
the array out: a version listed here that the indexer will not accept from a
user forces an SDK Format that can only build dead transactions, so re-read the
handler before editing one.

The per-repo sets legitimately differ by role: the SDK omits validator-only
actions (`ANCHOR`/`ATTEST`/`NODEPROOF`/`SLASH`); the indexer adds mirror-injected
(`XCALL`/`XEXEC`/`CROSS_SETTLE`) and lifecycle (`*_MATCH`/`*_EXPIRE`/`DISPENSE`)
handlers that are never decoded wire bytes; the explorer is the render superset
(including legacy order/dispenser cancel+edit views). The manifest encodes these
differences as flags rather than pretending all sets are equal.

Two things deliberately excluded: the indexer `protocol_changes` **feature-gate
flags** (`VM_ACTIONS`, `CONTROLLER_GUARD`, `UNIFIED_FEES`, ...) which are not
actions, and the `UNKNOWN` catch-all sentinel.

## Adding a new ACTION

1. Add one entry to `action-manifest.json` with the role flags it should carry.
2. Re-vendor: run `bin/sync-action-manifest.sh` from the platform checkout. It copies
   this file over every `test/fixtures/action-manifest.json` and verifies the result.
3. Run each repo's conformance test. Each repo whose flag you set but did not wire fails loudly; wire it until green.

`bin/sync-action-manifest.sh --check` is the cross-repo byte-parity gate, run by
`bin/ci-all.sh`. It exists because the per-repo IDENTITY assertion below only
compares against canonical when `xchain-documentation` is checked out beside the
repo, which on GitHub it never is, so the monorepo run is where all six copies are
compared at once. The same pass classifies every other `action-manifest.json` in
the checkout: build output, `xchain-node` install clones and throwaway worktrees
are reported and not gated, while a **tracked** copy in a platform repo that is
not on the roster fails, since that is how a seventh vendoring site with its own
conformance guard would otherwise appear with nothing keeping it in step.

```mermaid
flowchart TD
    Add["Add entry to action-manifest.json<br>with the role flags it should carry"] --> Vendor["Re-vendor: bin/sync-action-manifest.sh<br>copies the file over every repo's<br>test/fixtures/action-manifest.json"]
    Vendor --> Test["Each repo runs ActionManifestConformance.test.js<br>in its own unit tier"]
    Test --> Behavior{"BEHAVIOR: repo's local action set<br>equals the manifest slice for its role flag?"}
    Behavior -->|"no"| Fail["That repo's CI fails,<br>naming the missing action and the file to edit"]
    Behavior -->|"yes"| Identity{"IDENTITY: vendored copy<br>byte-identical to the canonical file?"}
    Identity -->|"no"| Fail
    Identity -->|"yes"| Green["Repo's conformance test passes"]
    Fail --> Wire["Wire the action in that repo"]
    Wire --> Test
```

> Step 2 is one command as of . The full collapse of the per-repo literals
> into generated code (so the per-repo edits disappear too) is still a future
> follow-on; today the manifest, the sync tool and the conformance guards make the
> fan-out **safe** and **one-edit to vendor**, not yet **one-edit to wire**.
