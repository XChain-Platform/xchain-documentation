<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/docs/Release_CI_Setup.md @ 34639117 (worktree dirty) -->

# Release CI: how the signing lane is protected

The wallet's continuous integration builds and signs release artifacts. On its own, a build workflow is not safe to run with real signing credentials: a tag-triggered workflow that holds code-signing secrets is a signed-malware factory if anyone with push access can fire it just by pushing a tag. The controls that make it safe live in the repository's settings and access rules, not in the workflow file itself, and they exist before the workflow is ever run with real signing credentials.

This page describes those controls at a level meant for anyone verifying that a release could only have come from an intentional, approved run, not the exact configuration values (those are operational detail, not something a reader needs to trust the output).

---

## Why settings, not YAML

The output of a compromised release run would be a properly signed, notarized, correctly named binary. It would pass every check a user can perform on the artifact itself. A user who downloads directly from `downloads.xchain.io` never touches a store review gate at all, so store review does not close this gap; these controls protect the user directly.

Nothing in a workflow file alone can enforce any of this, because a workflow file is editable by anyone who can push to the repository. The protection has to sit outside the file that a compromise would target.

## 1. A protected signing environment

Signing jobs run inside a protected deployment environment that is restricted to the release tag pattern, so it cannot be triggered from an arbitrary branch or from a pull request. A job that names this environment can only run on a release tag.

**There is no human approval step, and this page previously said there was.** A per-run reviewer gate is the natural companion to the restriction above, and it is not available on this repository's plan tier: the platform refuses to create the rule at all. Rather than describe a control that does not exist, this page states what actually stands in its place, which is the signature requirement in §3.

That is a real reduction in defence in depth and it is worth being precise about what it does and does not mean. There is no release path that is unprotected; there is one that is *singly* protected. Someone who obtained the maintainer's repository account, but not the offline tag-signing key, still could not produce a release, because no signing job runs on a tag that is not signed by that key. Someone holding both would meet nothing further.

## 2. Signing credentials are bound to that environment

Every signing credential (macOS code-signing and notarization, Windows code-signing, and the credentials used for store submission builds) is scoped to the protected environment, never stored as a repository-wide secret. A repository-wide secret is readable by any workflow, including one added from a pull request branch; an environment-scoped one is only readable by a job that has already cleared the approval gate above.

Some of these credentials have configuration that must be complete or not present at all: a partially configured signing path can silently fall back to producing an unsigned artifact rather than failing loudly. The build tooling does not treat a missing signing credential as an error, it simply skips signing, so a single mistyped value can yield a complete, correctly named, correctly sized set of installers that are not signed at all.

**That failure is now caught rather than merely warned about.** Before the release hash manifest is signed, every artifact is checked against the code signature its platform is expected to carry, and a release with even one unsigned artifact is refused. The ordering matters: the manifest attests the bytes of a file, not who published it, so a manifest signed over unsigned installers would verify perfectly forever and no later check, by us or by a user, could tell the difference. The check has to happen before that signature exists, and it does.

Platforms whose signature cannot be read from the machine assembling the release are recorded as unchecked rather than reported as fine, because "we did not look" and "we looked and it was good" must not appear the same way in a release record.

**The manifest-signing key never appears here, and must never be added.** The release hash manifest is signed offline, on a separate release machine, not inside CI. A CI runner that could sign the manifest would turn every path into the workflow into a path to a signed release; keeping that key off every runner is what makes the rest of this page meaningful.

## 3. What actually gates a release: the tag has to be signed

**A release tag must carry a cryptographic signature from the maintainer's release tag-signing key.** The workflow verifies that signature first, before any job that can read a signing credential runs. A tag pushed by anyone else, or an unsigned tag pushed by the maintainer's own account, starts nothing.

This is the control that does the work, and it is deliberately the one control that does not depend on repository settings or on the maintainer's platform account. The signing key is held offline, not in the repository and not on any runner, so obtaining push access is not enough to produce a release.

**There is no rule restricting who can create a release tag, and this page previously said there was.** Such a rule cannot be expressed correctly here: the platform's tag rules can exempt roles, teams and applications, but not one named person, and this repository has more than one account holding administrative access. Any exemption wide enough to admit the release maintainer would admit the other account too.

**No partial rule was created, and that was a deliberate choice rather than an oversight.** A rule that appears in the settings page while exempting everyone it needed to exclude protects nothing and reads, to the next person who checks, exactly like a rule that works. An absent control that is written down is safer than a present control that does nothing.

Anyone with push access can therefore create a tag. What they cannot do is make a signing job run on it.

## 4. Keeping signing secrets away from pull requests

The release workflow triggers only on a tag push, never on a pull request or an unscoped manual dispatch. Workflow runs proposed by outside collaborators from a fork require explicit approval before they run at all, which keeps a workflow-file change proposed in a pull request from being a path to a protected secret.

## 5. Verifying it actually works

Before the first real release, and after any change to this setup, the whole chain is exercised end to end rather than assumed:

- A throwaway tag pushed from the maintainer account should start the run, fail the early tag/version consistency check, and never reach a signing job. That is the cheap gate working.
- **An unsigned release tag should stop the run at the signature check, before any secret-bearing job starts.** This is the important one, because it is the control everything else now rests on. If an unsigned tag reaches a signing job, nothing else on this page matters.
- The signing jobs should be unable to start from a branch or a pull request at all, because the environment they name is restricted to the release tag pattern.
- The run summary should show what ran and confirm nothing was published anywhere automatically.
- **Every artifact the release produced should be checked for its expected code signature before the hash manifest is signed** (§2). A release whose signing credentials were missing should fail here rather than produce a signed manifest describing unsigned files.

These four are what can actually be verified. The two checks this list used to open with, a refused tag creation from a non-maintainer and a run "waiting for approval", would both fail today, because neither control exists (§1, §3). A verification step that cannot pass is worse than no step: it either gets quietly skipped or it gets read as a failure of something else.

---

## What is deliberately not automated

- **Publishing.** No upload to the download host, no store submission. A human pushes the final button on every release.
- **Manifest signing.** The signing key never reaches a CI runner (see §2).
- **Store review.** Store review is asynchronous by nature. This setup accepts that the store can lag a release tag, and treats any artifact-side version skew as the thing to catch instead.

The workflow's own output is build artifacts and a run record. Publishing and store submission happen afterward, by a human, on the release maintainer's own machine.
