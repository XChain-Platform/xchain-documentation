# Maintainers

This file lists the people responsible for `xchain-documentation`, what each of them owns, and how to escalate issues that need a human's attention beyond what `CONTRIBUTING.md` and `SECURITY.md` cover.

The XChain Platform is in pre-launch development and ships under a single primary maintainer today. As contributors take on durable responsibility for areas of the codebase, they will be added here. This is a conventional MAINTAINERS file (an open-source norm used by distros and downstream packagers), not an aspirational org chart.

---

## Primary maintainer

| Role | Name | GitHub | Areas |
|---|---|---|---|
| Lead | J-Dog | [@J-Dog](https://github.com/J-Dog) | Everything: the protocol specification, component docs, and developer guides |

Contact:

- General and non-sensitive: open an issue at <https://github.com/XChain-Platform/xchain-documentation/issues>.
- Code of Conduct: `conduct@dankest.llc` (per `CODE_OF_CONDUCT.md`).
- Security disclosures: GitHub Private Vulnerability Reporting, or `security@dankest.llc` (per `SECURITY.md`).

---

## Areas of responsibility

Until additional maintainers join, the lead owns every area below. The table is here so a future contributor (or downstream packager) can see what each area entails when scoping a contribution.

| Area | What it covers |
|---|---|
| Protocol spec | `protocol/` ACTION definitions, encoding formats, DB naming conventions, Token Information Standard, error codes, URI scheme, and JSON schemas |
| Component docs | `components/` documentation for each of the 15 documented xchain-* components |
| Developer guide | `developer-guide/` tutorials, integration examples, and query references |
| Getting started | `getting-started/` platform intro, quickstarts, and glossary |
| Concepts | `concepts/` metalayer model, tokens, ACTIONs, encoding, cross-chain, gas, and security overviews |
| Architecture | `architecture/` data pipeline, component map, and database design |
| User guide | `user-guide/` capabilities, use cases, and FAQ for non-technical readers |
| AI and agents | `ai-agents/` guides for building AI agents on the platform |
| Operations | `operations/` deployment, monitoring, upgrades, and troubleshooting |
| Overview and whitepaper | `OVERVIEW.md`, `WHITEPAPER.md`, `BLOCKCHAINS.md` |
| Legal and project files | `legal/`, `LICENSE.md`, `NOTICE.md`, `CHANGELOG.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `MAINTAINERS.md` |

---

## Adding a maintainer

A contributor becomes a maintainer when they have:

1. Sustained contribution in a specific area for at least one release cycle (typically 2 to 3 weeks of active work).
2. Reviewed and merged at least three PRs from outside contributors.
3. Demonstrated awareness of the project's conventions: Markdown style consistent with the existing docs, accurate examples that reflect the current wire format and ACTION definitions, and plain language in user-facing sections.

Open a PR adding the new maintainer to the table above with their GitHub handle and area(s) of responsibility. The lead approves and merges.

## Removing a maintainer

A maintainer steps down by opening a PR removing their row. The lead also removes a maintainer who has been inactive for six months or who violates the Code of Conduct, after a written notice period.

---

## Escalation paths

If you cannot reach the relevant area maintainer within a reasonable window:

| Situation | Escalate to |
|---|---|
| Active security incident | `security@dankest.llc` (per `SECURITY.md`) |
| A documented consensus rule, encoding, or validation requirement that is unsafe or ambiguous | Open a public issue tagged `security` AND email `security@dankest.llc` |
| Code-of-conduct concern | `conduct@dankest.llc` (per `CODE_OF_CONDUCT.md`) |
| PR has been open without review for 14+ days | Comment `@J-Dog` on the PR; if no response within 7 more days, open an issue tagged `governance` with the PR link |

---

## Decision-making

The lead makes final calls on:

- Spec changes that affect consensus (encoding, validation, ACTION definitions): these are coordinated with the maintainers of xchain-indexer, xchain-decoder, and xchain-vm before merging.
- Doc structure and section organization.
- User-facing plain language and audience targeting.
- Adopting a new heavy dependency.
- Code-of-conduct enforcement, and maintainer additions or removals.

Smaller calls (clarifications, additions within an existing section, fixing examples, dependency bumps inside an existing minor) go through PR review by the area maintainer.

---

## Cross-project relationships

| Project | Relationship |
|---|---|
| [`xchain-indexer`](https://github.com/XChain-Platform/xchain-indexer) | Primary implementing service for protocol spec; consensus-affecting spec changes are coordinated here first |
| [`xchain-decoder`](https://github.com/XChain-Platform/xchain-decoder) | Implements the encoding formats and ACTION extraction documented in `protocol/` |
| [`xchain-vm`](https://github.com/XChain-Platform/xchain-vm) | Implements the contract execution model documented in the protocol and component docs |
| All other xchain-* services | Every service cites this repo as the authoritative spec; each service's `components/` entry is maintained in sync with that service's own repo |

The documentation maintainer is not automatically a maintainer of those sibling projects. Cross-project changes go through each project's own review process.
