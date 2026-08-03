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

Signing jobs run inside a protected deployment environment that requires a human reviewer to approve each run before it can start. A job that names this environment cannot start, and therefore cannot read a signing credential, until a maintainer approves it. The environment is also restricted to the release tag pattern, so it cannot be triggered from an arbitrary branch or pull request.

Approval is meant to be a real check, not a rubber stamp: the maintainer looks at the run, confirms the tag points at the commit they meant, on a run they expected, before approving. An unexpected release run gets the same scrutiny as an unexpected password-reset email.

## 2. Signing credentials are bound to that environment

Every signing credential (macOS code-signing and notarization, Windows code-signing, and the credentials used for store submission builds) is scoped to the protected environment, never stored as a repository-wide secret. A repository-wide secret is readable by any workflow, including one added from a pull request branch; an environment-scoped one is only readable by a job that has already cleared the approval gate above.

Some of these credentials have configuration that must be complete or not present at all: a partially configured signing path can silently fall back to producing an unsigned artifact rather than failing loudly. That is exactly why the setup is verified end to end (see below) rather than assumed correct from the presence of a few values.

**The manifest-signing key never appears here, and must never be added.** The release hash manifest is signed offline, on a separate release machine, not inside CI. A CI runner that could sign the manifest would turn every path into the workflow into a path to a signed release; keeping that key off every runner is what makes the rest of this page meaningful.

## 3. Restricting who can create a release tag

Creating a tag matching the release pattern is restricted to the release maintainer through a repository tag ruleset. Everyone else with push access can still push code and still cannot start a release. Force-pushing over an existing release tag is blocked, so a tag cannot be silently repointed at a different commit after the run that built from it; without that, the run recorded against a tag would stop proving anything, since the tag could later mean something else.

## 4. Keeping signing secrets away from pull requests

The release workflow triggers only on a tag push, never on a pull request or an unscoped manual dispatch. Workflow runs proposed by outside collaborators from a fork require explicit approval before they run at all, which keeps a workflow-file change proposed in a pull request from being a path to a protected secret.

## 5. Verifying it actually works

Before the first real release, and after any change to this setup, the whole chain is exercised end to end rather than assumed:

- A throwaway tag pushed from the maintainer account should start the run, fail the early tag/version consistency check, and never reach a signing job. That is the cheap gate working.
- A tag creation attempt from a non-maintainer account with push access should be refused outright. If it is not, the tag restriction is not in force and nothing else here matters.
- On a real tag, the signing jobs should sit in a "waiting for approval" state, with no secret-bearing step run before that approval is given.
- After approval, the run summary should show what ran and confirm nothing was published anywhere automatically.

---

## What is deliberately not automated

- **Publishing.** No upload to the download host, no store submission. A human pushes the final button on every release.
- **Manifest signing.** The signing key never reaches a CI runner (see §2).
- **Store review.** Store review is asynchronous by nature. This setup accepts that the store can lag a release tag, and treats any artifact-side version skew as the thing to catch instead.

The workflow's own output is build artifacts and a run record. Publishing and store submission happen afterward, by a human, on the release maintainer's own machine.
