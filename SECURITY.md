# Security Policy

`xchain-documentation` is the protocol specification repository for XChain Platform: ACTION definitions, encoding formats, consensus rules, database naming, the Token Information Standard, and the whitepaper. This repository does not run code, but the specs it contains are authoritative. An error here, specifically a documented encoding rule, consensus requirement, or validation constraint that is unsafe or ambiguous, can lead every implementer in the wrong direction at once. We take correctness reports seriously.

If you've found a security issue, please **do not open a public issue or pull request**. Use the private channels below.

---

## How to report

### Preferred: GitHub Private Vulnerability Reporting

Open a draft advisory at:

<https://github.com/XChain-Platform/xchain-documentation/security/advisories/new>

This is the fastest path. The advisory is private until we publish it.

### Alternative: Email

Email **security@dankest.llc** with:

- A description of the issue and the threat it poses.
- The specific document, section, and text that contains the problem.
- A concrete scenario: which implementer behavior the spec permits or encourages, and why that behavior is insecure.
- Any proposed corrected text you'd like considered.

For sensitive reports, encrypt the email body to our PGP key. Its fingerprint is published at <https://xchain.io/security>, which is currently the only place a public reader can read it, and the key itself is served beside it. If you would rather make first contact before sending anything sensitive, the email channel is fine for that and we will coordinate an encrypted exchange before you share details.

We do not currently offer a paid bug bounty. We do offer public credit in release notes and the advisory itself, unless you prefer to remain anonymous.

---

## Response timeline

| Stage | Target |
|---|---|
| Initial acknowledgement | within 72 hours |
| Triage + severity assignment | within 7 days |
| Fix or mitigation in master | within 30 days for high/critical, 90 days for lower severities |
| Coordinated public disclosure | up to 90 days from initial report, or sooner if a corrected spec has shipped |

If we cannot meet a timeline, we will tell you why and propose a new one. We will not silently let a report age.

---

## Scope

### In scope

- Security-relevant correctness errors in the protocol spec: a documented encoding, consensus rule, or validation requirement that is unsafe, ambiguous, or would lead implementers to build an insecure system.
- Spec text that, if followed literally, would cause two compliant implementations to diverge in a security-relevant way (for example, balance accounting or ownership determination).
- A spec omission that leaves an implementer no safe choice (no guidance on an edge case that an attacker can exploit).

### Out of scope

- Bugs in the actual service implementations (report those against the relevant xchain-* code repository, unless the root cause is a spec error).
- Typos, grammar issues, and non-security editorial problems (open a normal issue or pull request for those).
- Vulnerabilities in the underlying coin nodes or third-party dependencies.

If you are unsure, send the report anyway and we will tell you whether it falls in scope.

---

## What we ask

- Give us a reasonable window to fix before disclosing publicly. The 90-day ceiling is firm; earlier is fine once a corrected spec has shipped.
- Be specific: cite the document, section, and the exact text that is problematic, and explain the attack scenario it enables.
- Do not open a public issue for a security-relevant finding while coordinated disclosure is in progress.

---

## What we will do

- Confirm receipt within the SLA above.
- Keep you informed as triage and remediation proceed.
- Credit you in the advisory and `CHANGELOG.md` entry, on request.
- Coordinate a CVE assignment when the severity warrants it.
- Publish a post-fix advisory describing the issue, the correction, and the affected version range.

---

## Versions covered

We ship security fixes against the latest revision on `master`. The current version is recorded in `CHANGELOG.md` and the badge in `README.md`.

---

Last reviewed: 2026-06-16.
