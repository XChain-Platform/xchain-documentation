<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# AI-Assisted Contract Authoring

XChain contracts are plain, single-file JavaScript (or TypeScript). That is a
quiet superpower: the whole JavaScript tooling ecosystem, including large
language models, already writes and reviews this language well. This guide
covers the AI-assisted authoring workflow that turns that fact into the fastest
on-ramp on any smart-contract platform.

There are two entry points:

- **Describe your contract in English** and get a working, deploy-ready XChain
  contract back.
- **Paste your Solidity** and get the XChain equivalent, with the meaningful
  differences explained.

For Solidity developers this reframes the platform: there is no Solidity-to-XChain
translation *compiler* to learn or babysit, because translating an EVM contract
is a language task a model does well, not a bytecode problem. XChain does not run
EVM bytecode by design (the execution models differ); see
[Solidity to XChain](./solidity-to-xchain.md) for why, and for the concept map the
AI workflow is built on.

## Why this is safe

An LLM can write a contract that *looks* right but would be rejected the moment
you tried to deploy it: a `Math.pow`, a `RegExp`, an `async` method. XChain's
determinism gate rejects exactly those, on-chain, at deploy time. A stray decimal
literal is the quieter failure: it is a non-blocking **warning**, so the contract
deploys and only the warning tells you the arithmetic is non-deterministic. The
AI-assisted workflow closes both gaps by running every generated contract through
the **same static determinism gate the on-chain validator uses**, then feeding any
errors back to the model to fix, before you ever spend a transaction. You get
generation speed with deploy-time correctness.

The harness never invents rules of its own: it teaches the model the same
concept map, model shifts, and hard rules documented in
[Solidity to XChain](./solidity-to-xchain.md), then holds the output to the gate.

## The workflow

The `xchain-foundry` CLI (shipped with `xchain-vm`) drives this with no network
calls and no API key of its own. You bring your own model; the CLI builds the
prompt and validates the reply.

### 1. Describe what you want

```bash
xchain-foundry describe "an escrow that holds MTK until both buyer and seller
  approve, then releases the whole balance to the seller; either party can
  cancel before approval to refund the buyer"
```

This prints a ready-to-use prompt (a `SYSTEM` block that teaches the model the
XChain contract model, and a `USER` block with your brief). Paste it into any
capable LLM. Add `--ts` to ask for a TypeScript contract, or `--json` to get the
chat-style `messages` array for wiring into your own client.

### 2. Translate existing Solidity

```bash
xchain-foundry from-solidity ./MyVault.sol
```

Same idea, but the prompt asks the model to translate the Solidity into the
XChain equivalent and to add a **Notes** section explaining the differences
(`msg.value` becomes a `DEPOSIT`, a synchronous return becomes a callback, and so
on). Where a native protocol action replaces the whole contract, for example an
ERC-20 is simply an `ISSUE`, the model is told to say so instead of porting code
you do not need.

### 3. Validate the reply

Run the model's answer straight back through the gate:

```bash
# from a saved file
xchain-foundry validate ./model-reply.txt

# or straight from a pipe
your-llm-cli < prompt.txt | xchain-foundry validate -
```

`validate` extracts the contract from the reply, runs the determinism gate and
the gas estimate, and prints `PASS` or `FAIL`. On failure it prints a **repair
prompt** you can paste back to the model to fix the specific violations. Repeat
until it passes, then `xchain-foundry simulate` it (on Node 22 / Linux) and
deploy with `xchain-sdk` / `xchain-encoder`.

## Programmatic use

For an integrated experience (an editor plugin, a web IDE, an agent) the harness
is exposed as a library. You inject your own model; everything else, including
the automatic repair loop, is handled for you.

```javascript
const { authorContract } = require('xchain-vm/toolkit');

// `complete` is any function that takes a [{role, content}] messages array and
// returns the model's text. Wire it to your provider of choice.
async function complete(messages) {
    // ...call your LLM, return the assistant's reply as a string...
}

const result = await authorContract({
    mode: 'describe',                 // or 'from-solidity'
    input: 'a vesting vault that releases 1/12 of the balance each month',
    complete,
    maxRepairs: 2                     // gate-driven fix-it rounds after the first try
});

if (result.ok) {
    console.log(result.contractJs);   // the exact JS the deploy gate accepted
    console.log(result.notes);        // model's explanation / differences (Solidity mode)
} else {
    console.error('did not converge:', result.gate.errors);
}
```

`authorContract` returns the accepted contract source (`contractJs`, already
type-stripped if the model wrote TypeScript), the final gate result, the number
of model calls (`attempts`), and the full `transcript` for auditing. Because the
model client is injected, the harness is provider-agnostic and runs its own tests
with no network access.

Lower-level building blocks are exported too: `buildAuthoringPrompt`,
`buildRepairPrompt`, `extractContractCode`, and the canonical `KNOWLEDGE` base
(concept map, model shifts, and hard rules) if you want to build your own loop.

## Good habits

- **Reach for a native action first.** Ask the model for a token, a sale, an
  airdrop, or enforced royalties and it will point you at `ISSUE`, `DISPENSER`,
  `AIRDROP`, or a controller-bound token instead of a contract you would have to
  maintain. Writing a contract is for genuinely custom logic.
- **Always validate before you trust.** Model output is a draft. The gate is the
  arbiter; `PASS` means the deploy will pass the on-chain determinism check.
- **Simulate before you deploy.** `xchain-foundry simulate` runs the contract in
  a local in-memory sandbox so you can unit-test behavior with millisecond
  feedback and no regtest stack.

## Where to go next

- [Solidity to XChain](./solidity-to-xchain.md) - the concept map, native-action
  shortcuts, and side-by-side examples the AI workflow is built on.
- [Smart Contract Development](./smart-contract-development.md) - the full
  authoring, linting, and deployment guide.
- [Regtest Development](./regtest-development.md) - run a local stack to exercise
  your contract end to end before mainnet.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.
