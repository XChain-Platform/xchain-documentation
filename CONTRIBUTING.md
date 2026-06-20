# Contributing to XChain Documentation

Thanks for considering a contribution. `xchain-documentation` is the authoritative protocol specification for XChain Platform: ACTION definitions, encoding formats, consensus rules, database naming, the Token Information Standard, and the whitepaper. A change here can affect every implementer, so we review spec changes carefully and ask for precision.

If you're reporting a security issue, **stop here** and read [`SECURITY.md`](./SECURITY.md) instead. Security reports go through a private channel.

---

## Quick links

- Project overview: [`README.md`](./README.md)
- Disclosure policy: [`SECURITY.md`](./SECURITY.md)
- Code of Conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- License: [`LICENSE.md`](./LICENSE.md) + [`NOTICE.md`](./NOTICE.md) (GNU Affero General Public License v3.0, dual-licensed)
- Version history: [`CHANGELOG.md`](./CHANGELOG.md)

---

## Repo layout in 30 seconds

```
xchain-documentation/
├── getting-started/      platform intro, quickstarts, glossary
├── concepts/             metalayer, tokens, ACTIONs, encoding, cross-chain, gas, security
├── architecture/         data pipeline, component map, database design
├── components/           per-component docs (decoder, indexer, hub, ...)
├── developer-guide/      tutorials: build tokens, dispensers, query data, integrate, testing
├── ai-agents/            building AI agents with MCP and bounded wallets
├── user-guide/           capabilities, use cases, FAQ (no code required)
├── protocol/             34 ACTION definitions, Token Information Standard, schemas
├── operations/           deployment, Docker, monitoring, upgrades, troubleshooting
├── legal/                licensing, commercial license, trademark, contributor agreement
├── BLOCKCHAINS.md        supported chains, adding new blockchains
├── OVERVIEW.md           platform overview
├── WHITEPAPER.md         technical whitepaper
├── CHANGELOG.md          authoritative version history
└── README.md             entry point and section map
```

---

## Setting up

### Prerequisites

- **Node.js 22** exactly. The platform pins Node 22 fleet-wide; `engines.node` in `package.json` declares `>=22.0.0`. Use 22.
- A Markdown editor or plain text editor. No build step is required to read or edit docs.

### First-time clone

```bash
git clone https://github.com/XChain-platform/xchain-documentation.git
cd xchain-documentation
```

There is no `npm install` or build step needed for editorial contributions.

---

## Making changes

This repository contains Markdown files only. There is no source code to compile and no test suite to run.

### Types of contribution

- **Editorial fixes** (typos, grammar, broken links, formatting): open a pull request directly. No issue needed unless the fix is ambiguous.
- **Clarifications and non-consensus additions**: open a pull request with a clear description of what was unclear and how the new text resolves it.
- **Spec changes that affect consensus behavior**: these require more care. See the section below.

---

## Proposing a spec change

A spec change is anything that alters how a compliant implementation should parse, validate, encode, or process an ACTION, update ledger state, or compute fees. Even small wording shifts can have consensus implications.

Before writing the PR:

1. **Open an issue first.** Describe the current text, the problem with it, and your proposed change. This surfaces disagreement early and avoids wasted drafting effort.
2. **Cite the exact section.** Reference the file path and the current text you are changing.
3. **Describe the consensus impact.** Explain whether the change is additive (no existing behavior changes), clarifying (no behavior changes, but removes ambiguity), or consensus-breaking (a compliant implementation would behave differently after the change).
4. **Consensus-breaking changes need sign-off from implementing service maintainers** before the PR merges. This means the teams responsible for `xchain-decoder`, `xchain-indexer`, and any other service the spec governs. Tag them in the issue.

Once the issue has consensus, open the PR against `master`. Keep one logical change per PR; don't batch unrelated spec edits.

---

## Markdown style

- Use **ATX headings** (`#`, `##`, `###`), not underline-style headings.
- **Two trailing spaces** on consecutive bold-label lines (for example, `**Date:**  `) so CommonMark renders the line break instead of collapsing them.
- **Never use the em-dash character** (U+2014) in any text you author. Rewrite the sentence with a comma, colon, parentheses, or two sentences. A plain hyphen `-` is fine occasionally. A hook will block any file that contains the long dash.
- Use fenced code blocks with a language hint (` ```json `, ` ```bash `, etc.) for all code examples.
- Keep line length reasonable (80-100 chars) for readability in `git diff`, but do not wrap mid-sentence just to hit a target.
- Spell out numbers under 10 in prose; use digits for larger values and for all byte counts, hex values, and numeric parameters.

### Keeping examples accurate

All byte-level encoding examples and on-chain data samples in the spec must match the actual platform behavior. If you discover a discrepancy between a spec example and what the services actually do, note it explicitly in your PR description and flag which side is authoritative.

---

## Commit messages

Match the existing log style: a concise subject line, then a short body explaining what changed and why.

- Branch off `master` and keep history linear (rebase, don't merge).
- One logical change per commit; don't batch unrelated edits.
- **No `Co-Authored-By` trailers.** This is a project policy.
- **Never `--no-verify`.** If a hook fails, fix the cause; don't bypass it.

---

## Pull requests

Before opening a PR:

1. Confirm `git status` is clean apart from intended changes (no editor backup files, no `.env`).
2. Update `CHANGELOG.md` with a terse entry for your change.
3. Open the PR with a clear title and a description of what changed and why. For spec changes, link to the issue where maintainer sign-off was obtained.

For non-security bugs or editorial issues, open an issue at <https://github.com/XChain-platform/xchain-documentation/issues/new>. For security bugs, see [`SECURITY.md`](./SECURITY.md).

---

## Code of Conduct

We follow our [Code of Conduct](./CODE_OF_CONDUCT.md), adapted from the Contributor Covenant 2.1. Be kind, assume good faith, and disagree without being a jerk.

---

Last reviewed: 2026-06-16.
