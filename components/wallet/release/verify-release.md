<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->
<!-- ported 2026-08-02 from xchain-wallet/docs/Verify_Release.md @ 34639117 (worktree dirty) -->

# Verify a release

This is the recipe for verifying that a release artifact you downloaded was produced from the source tree at a specific git tag, and was signed by the project maintainer's release key.

If you only want a one-line answer: clone the repo, run the reproduce script, compare hashes, then verify the GPG signature on the hash manifest. The detail below walks you through each step.

**Companion docs:** [Reproducible Builds](../reproducible-builds.md) (what we promise and how the bytes are made deterministic), [Security & Threat Model](../security.md) (the wallet's threat model and the disclosure channel).

**Looking for the key fingerprint?** It is not on either companion page, and not anywhere on this documentation site: see [Where the release key fingerprint is published](#where-the-release-key-fingerprint-is-published).

---

## What you're checking

Four independent claims combine into a real verification:

1. **Bit-for-bit reproducibility.** Rebuilding from a tagged commit produces the same pre-signing artifact bytes that the maintainer signed for that tag.
2. **Hash integrity.** The SHA-256 of the artifact you downloaded matches the hash the maintainer published for that tag.
3. **Signature authenticity.** The maintainer's release GPG key signed the hash manifest, and that key matches the fingerprint published through the [two independent channels](#where-the-release-key-fingerprint-is-published) named below.
4. **Release identity.** The manifest says, inside the signed bytes, which release it describes. A genuine manifest from a different release passes claims 2 and 3 perfectly, so without this one you can be handed an older signed release and never know.

You need all four to claim verification. Skipping signatures trusts the download host. Skipping hashes trusts the build environment. Skipping the identity check trusts that nobody swapped one signed release for another. Skipping reproducibility trusts that the maintainer's machine wasn't compromised between source and signing.

**The short version.** `tools/release/verify.sh` does claims 2, 3 and 4 in one command, and is the same script the maintainer runs before publishing:

```bash
bash tools/release/verify.sh --input <download-dir> --tag vX.Y.Z
```

The manual walk-through below exists so you can check each claim yourself without trusting our script either.

---

## Prerequisites

- `git`
- `gpg` (a working GnuPG install; `gpg --version` should show 2.x)
- `sha256sum` (Linux) / `shasum -a 256` (macOS)
- For desktop reproducibility: `docker` (the reproduce container pins toolchain versions so you don't need to install Node / pnpm locally)

Anything beyond that depends on the target you're verifying.

---

## Where the release key fingerprint is published

The fingerprint is published through two independent channels, and neither of them is this documentation site:

- [`SECURITY.md`](https://github.com/XChain-Platform/xchain-wallet/blob/master/SECURITY.md) in the `xchain-wallet` repository on GitHub.
- [`https://xchain.io/security`](https://xchain.io/security), on a different host with a different deployment path.

Two channels exist so that whoever could quietly rewrite one of them cannot quietly rewrite both, which is the only reason a published fingerprint is worth anything. Read it from both. **If the two disagree, trust neither**: do not install anything, and ask in a public channel which one is current. This page deliberately links to those channels rather than repeating the value, because a third copy is a third thing the key ceremony has to keep in step, and a stale copy of a trust root is worse than no copy.

**Which key this is.** Three GPG keys exist in this project's orbit, and they are not interchangeable:

| Key | Signs | Where its fingerprint lives |
|---|---|---|
| Wallet release key | `RELEASE_HASHES.txt`, the manifest this page verifies | the two channels above |
| Tag-signing key | the git tag each wallet release is cut from | `tools/release/tag-signing-fingerprint.txt` in `xchain-wallet`; checked by our release pipeline, not by you |
| `releases@xchain.io` platform key | XChain Platform artifacts (source and bootstrap archives, packaged binaries), **not** wallet releases | [Release Signing](../../../operations/release-signing.md) |

If a document says "the release key" without saying which one, take the fingerprint as the answer rather than the name.

**No signed XChain Wallet release exists yet.** The release key now exists and both channels publish its fingerprint, but nothing has been signed with it, so any file offered to you as a signed XChain Wallet release is not one.

---

## Step 1: import the maintainer's release key

Take the fingerprint from the [two channels above](#where-the-release-key-fingerprint-is-published). Then get the key itself. **Where you get the key from matters far less than the fingerprint check that follows it**, which is the whole reason the fingerprint is published separately from the key: a key that fails that check is discarded no matter how official its source looked, and a key that passes it is the right key no matter how ordinary its source was.

The key is committed in the wallet repository, so this works today:

```bash
curl -fsSL -o release-signing-key.asc \
  https://raw.githubusercontent.com/XChain-Platform/xchain-wallet/master/tools/release/release-signing-key.asc
gpg --import release-signing-key.asc
gpg --fingerprint <FINGERPRINT>
```

The key is not on a public keyserver yet. When it is, `gpg --keyserver keys.openpgp.org --recv-keys <FINGERPRINT>` will fetch the same key, and the fingerprint check below is unchanged either way.

Cross-check the fingerprint output against the published one. They must match exactly. If they do not, stop and ask in a public channel before proceeding: a mismatching fingerprint is the canonical sign that your view of either the key's source or the published fingerprint is compromised.

If you already have the key from a prior verification, you do not need to re-import.

---

## Step 2: download the artifact and its signature

Every release tag publishes:

- The artifact (`.dmg`, `.exe`, `.AppImage`, `.deb`, `.zip` for extension stores).
- `RELEASE_HASHES.txt`, the SHA-256 manifest of every artifact in the release.
- `RELEASE_HASHES.txt.asc`, the GPG signature on the manifest.

Releases are served from `downloads.xchain.io`, not from GitHub release assets. The manifest lives under its versioned name, which is the form to prefer: the filename then states which release it describes, and `verify.sh` can check that claim against the manifest's own header with no `--tag` needed.

```bash
TAG=vX.Y.Z
BASE="https://downloads.xchain.io/wallet"
curl -fsSL -o RELEASE_HASHES.txt     "${BASE}/RELEASE_HASHES/${TAG}.txt"
curl -fsSL -o RELEASE_HASHES.txt.asc "${BASE}/RELEASE_HASHES/${TAG}.txt.asc"
curl -fsSLO --path-as-is "${BASE}/desktop/<artifact-filename>"
```

Use the artifact filename appropriate for your platform. Desktop installers are under `desktop/`, the web tarball under `web/`, and the extension zip under `extension/`.

**Note the space.** Every desktop artifact name contains one (the product name is two words), so a URL you paste by hand needs it percent-encoded as `%20`, for example:

```bash
curl -fsSLO "${BASE}/desktop/XChain%20Wallet-0.334.0-arm64-mac.zip"
```

If you took a manifest named plainly `RELEASE_HASHES.txt` from somewhere else, pass `--tag vX.Y.Z` to `verify.sh` so the same check can still run: it refuses to call a manifest verified when nothing says which release it belongs to.

---

## Step 3: verify the signature on the hash manifest

```bash
gpg --verify RELEASE_HASHES.txt.asc RELEASE_HASHES.txt
```

You want to see "Good signature from ..." and a key fingerprint that matches the one published through the [two channels](#where-the-release-key-fingerprint-is-published). A "WARNING: This key is not certified with a trusted signature" line is normal unless you've explicitly trust-signed the key locally; read the fingerprint regardless.

If verification fails: stop. Do not run the artifact. Report it through the disclosure channel on the [Security & Threat Model](../security.md) page: either the manifest or the signature (or both) was tampered with.

---

## Step 4: verify the artifact hash

```bash
# Linux / Windows (Git Bash, WSL)
sha256sum -c <(grep "<artifact-filename>" RELEASE_HASHES.txt)

# macOS
shasum -a 256 -c <(grep "<artifact-filename>" RELEASE_HASHES.txt)
```

You want to see `<artifact-filename>: OK`. A `FAILED` line means the file you downloaded does not match the hash the maintainer published: likely a corrupt download (rare) or a tampered mirror (rare but serious).

The manifest begins with `#` header lines. `shasum -c` ignores them; GNU `sha256sum -c` reports "N lines are improperly formatted" and carries on, which is noise, not a problem. Strip them if you would rather not read it:

```bash
grep -v '^#' RELEASE_HASHES.txt | grep "<artifact-filename>" | sha256sum -c -
```

One caveat worth knowing if you are checking the whole manifest at once: macOS ships a `/sbin/sha256sum` that prints that warning and then **exits 0 even when every line was malformed and nothing was checked**. Read the `: OK` lines, not just the exit code (`verify.sh` rejects malformed lines itself rather than trusting either tool).

---

## Step 4b: check which release the manifest describes

```bash
grep '^#' RELEASE_HASHES.txt
```

```
# XChain Wallet release manifest
# manifest-version: 2
# tag: v0.333.1
# tag-commit: 9f3c...
# built: 2026-07-31T18:02:11Z
# dev-mock-gate: enforced
# artifacts: 8
# profile default: ./xchain-wallet-web-v0.333.1.tar.gz
# profile store: ./xchain-wallet-ios-v0.333.1.ipa
```

These lines are inside the signed bytes, so a good signature vouches for them too. Four things to read:

- **`tag`** must be the release you meant to download. A manifest lifted from another release hashes and verifies perfectly; this line is the only thing that catches it.
- **`tag-commit`** is the commit the tag resolved to at signing time. Use it for the reproduce step below.
- **`dev-mock-gate`** must say `enforced`. Anything else means the release was signed without the check that keeps the development stub SDK, which shows fabricated addresses and cannot really sign, out of a shipped bundle. Treat that as a reason to ask before installing.
- **`profile`** says which feature set each artifact was built with. `default` is the full app: web, desktop and the extension. `store` is the mobile build, which compiles out the surfaces the app stores' review rules keep us from shipping there, so an Android or iOS build genuinely contains less code than the desktop one of the same version. Every artifact appears on exactly one of these lines; the Android APK you download directly is `store` too, because it is built from the same bundle that goes to the store.

At this point the artifact has been authenticated. You can install or run it.

---

## What the signature proves, per surface

Byte-exact verification is only possible for artifacts served from our own download host. Three of the four store surfaces re-package or re-sign what we submit, so for those the manifest proves what was submitted, not what was delivered to you. This is a property of the stores, not something we can close:

| Where you got it | What the manifest proves |
|---|---|
| downloads.xchain.io (web tarball, desktop installers) | Everything above: the bytes you have are the bytes we signed. |
| Chrome Web Store | The store repacks our zip into a store-signed CRX. You cannot hash the CRX against our manifest; comparison is content-level at best. The store's own signature is what protects delivery. |
| Google Play | Play re-signs and derives per-device APKs from the AAB we upload. Nothing you receive hashes to our manifest. |
| App Store | Apple re-encrypts and thins the ipa. App Store users cannot hash what they were served. |

If byte-exact verification matters to you, take the artifact from downloads.xchain.io rather than from a store.

### Updates are checked the same way, without you

Everything above describes verifying by hand. The desktop app does the equivalent automatically before it installs an update: it fetches the signed manifest for the version being offered, verifies the signature against a copy of the release key compiled into the app itself, and refuses to install an artifact whose hash the manifest does not cover. The check runs between the download and the install, and it is the only install path there is; there is no second, unverified route for a bug or a later change to wire up.

Two consequences worth understanding:

- On Linux this is the only authenticity check **for the artifacts we host**. The `.AppImage` and `.deb` carry no operating-system signature, and the SHA-512 in the update-info file is served by the same host as the binary, so it is a checksum from the same party, not a signature. The pinned key is what makes a compromise of the download host survivable. A Snap Store install is the exception and works the other way round: the Store signs what it serves, `snapd` installs only what the Store has signed and handles updates itself, so the wallet's own update path is switched off there and none of the manual recipe on this page applies to it.
- Because the key is compiled in, rotating it means shipping a wallet update. That is what pinning costs and what it buys.

---

## Step 5 (optional but recommended): reproduce the build

A passing signature plus matching hashes prove that the maintainer released what they signed. Reproducing the build proves that what they signed is what the source produces, closing the loop against a maintainer-machine compromise.

### Desktop (Linux)

```bash
git clone https://github.com/XChain-Platform/xchain-wallet.git
cd xchain-wallet
git checkout ${TAG}
bash packages/desktop/scripts/reproduce.sh ${TAG}

# Compare OUR published hashes with YOUR rebuilt ones. Only the Linux
# artifacts are reproducible as shipped (they carry no code signature),
# so both sides are filtered to them. Both manifests are plain
# `sha256sum` output over the same filenames, so this is a line diff.
diff <(grep -v '^#' RELEASE_HASHES.txt | grep -E '\.(AppImage|deb)$' | sort) \
     <(grep -v '^#' reproduce-out/RELEASE_HASHES.txt | sort)
```

A zero-byte diff means the artifacts we published are what this source produces. Any mismatch is diagnostic: `reproduce-out/` also holds `UNPACKED_HASHES.txt`, which hashes the bundle file by file and is how you find which one moved. See the [Reproducible Builds](../reproducible-builds.md) page and the [Linux desktop page](desktop/linux.md) for the possible causes (toolchain drift, timestamp leakage, supply-chain tampering).

### Desktop (macOS / Windows)

Cross-platform reproduction is not yet wired. Until that lands, the per-platform `RELEASE_HASHES.txt` entry plus the GPG signature on the manifest is the available integrity guarantee for those targets.

### Extension and web

Per-release reproduce scripts for the extension `.zip` and the web SPA bundle are not yet available. Until they land, the extension store's signing pipeline and the web SPA's SRI hashes are the available integrity guarantees for those targets.

---

## What "verified" means and does not mean

A verified release means: the bytes you installed correspond to the source tree at a specific git tag, signed by the maintainer's release key. It does NOT mean:

- **The source code itself is bug-free.** Read it, audit it, or rely on independent reviews.
- **The maintainer's release key has not been compromised.** A rotation changes the fingerprint, so watch for it in the [two publication channels](#where-the-release-key-fingerprint-is-published) themselves, which is where a rotation lands, rather than only on the release page.
- **Upstream dependencies are safe.** The reproducible-build pipeline pins versions but does not audit them. The Electron framework (desktop) and Chromium (web) trust chains live upstream.
- **Every locale, chain, or signer behaves correctly.** That is what testing and the [QA checklist](qa-checklist.md) cover.

Verification protects against tampering between source and download. It is one defensive layer among many.

---

## Reporting a verification failure

A signature failure or hash mismatch is a security event. Please report it through the disclosure channel on the [Security & Threat Model](../security.md) page, ideally via private vulnerability reporting, with the failing artifact URL, the SHA-256 you computed, and the GPG output. Do not post it in a public forum first.
