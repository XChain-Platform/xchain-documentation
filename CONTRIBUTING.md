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
├── protocol/             36 ACTION definitions, Token Information Standard, schemas
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
git clone https://github.com/XChain-Platform/xchain-documentation.git
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

### File naming

**Name every new document `lowercase-kebab-case.md`.** `cross-chain-dex.md`, not `CROSS_CHAIN_DEX.md`, `Cross_Chain_DEX.md`, or `crossChainDex.md`. Directories follow the same rule, and already do.

Three reasons this is a rule rather than a preference:

- **The filename IS the URL.** `protocol/cross-chain-dex.md` is published at `/protocol/cross-chain-dex`. No case or separator transformation happens in between, so a link cannot drift from the file it points at.
- **It removes a bug the repo has already hit.** macOS is case-insensitive and the servers are not, so a wrong-case link resolves fine on a contributor's laptop and 404s in production. All-lowercase makes that mistake impossible rather than something a test has to catch after the fact.
- **Hyphens read as word separators; underscores read as word joiners.** `cross_chain_dex` is one token to a search engine, `cross-chain-dex` is three. Underscores also disappear underneath a link underline.

Spell acronyms out in lowercase like any other word: `nft-standard.md`, `api-reference.md`, `xchain-uri-scheme.md`, `mcp-quickstart.md`.

**Exempt, and deliberately so**, because GitHub and other tooling look these up by exact name:

- **`README.md`, at any depth.** It is the folder-index convention: GitHub renders it when you browse into a directory, and the docs build publishes it as that directory's index, so it never appears in a URL to be inconsistent with.
- **At the repository root only:** `LICENSE.md`, `NOTICE.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `MAINTAINERS.md`, `AUTHORS.md`.

Nested copies of those names get no special treatment from any tool, so they are ordinary pages and follow the rule: `legal/CLA.md` is `legal/cla.md`.

Root-level exempt files still publish at a lowercase URL (`/license`, `/changelog`). Lowercasing the URL is the URL layer's job and says nothing about what the file is called on disk.

Renaming an existing document is a URL change, so it needs a redirect. Add the old path to the rename manifest the docs build reads, rather than leaving the old URL to 404: there are links to these pages on sites nobody here controls.

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

For non-security bugs or editorial issues, open an issue at <https://github.com/XChain-Platform/xchain-documentation/issues/new>. For security bugs, see [`SECURITY.md`](./SECURITY.md).

---

## Code of Conduct

We follow our [Code of Conduct](./CODE_OF_CONDUCT.md), adapted from the Contributor Covenant 2.1. Be kind, assume good faith, and disagree without being a jerk.

---

Last reviewed: 2026-06-16.
