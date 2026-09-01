# Release Signing

All XChain Platform release artifacts (tagged source archives, bootstrap
archives, packaged binaries) are signed with the project release key.

> **This is not the XChain Wallet release key.** The wallet ships its own
> signing key, and its fingerprint is published on `SECURITY.md` in the
> `xchain-wallet` repository and at `https://xchain.io/security`, not here.
> Verifying a wallet download against the key below will fail, and should:
> see [Verify a release](../components/wallet/release/verify-release.md).

## Key

- **Owner:** XChain Platform Release Signing `<releases@xchain.io>`
- **Fingerprint:** `1DA7 C489 6F56 EA22 CF49 1EDF 4361 611A 82F9 0B70`
- **Type:** RSA 4096 (signing) + RSA 4096 encryption subkey
- **Created:** 2026-07-23 · **Expires:** 2036-07-20
- **Public key:** [`RELEASE-SIGNING-KEY.asc`](RELEASE-SIGNING-KEY.asc) (also published on the website at launch)

## Verifying a release

```sh
gpg --import RELEASE-SIGNING-KEY.asc
gpg --verify <artifact>.asc <artifact>
```

A good signature reports the fingerprint above. Any other key, or a missing
signature on a release artifact, means the artifact is not an official release.

### What a train release publishes

Every platform release attaches these to the `xchain-node` GitHub Release:

| Asset | What it is |
|---|---|
| `release-manifest.json` | every component's exact tag and commit for this release |
| `<component>-<version>.tar.gz` | one source tarball per train member, built at cut time |
| `SHA256SUMS` | digests of every asset above |
| `SHA256SUMS.asc` | detached signature over `SHA256SUMS`, by the key on this page |

A component that did not change in a release keeps the version it last shipped
under, so a tarball's version is the component's own, not always the train's.

### The four checks, in order

```sh
# 1. the tag: who cut this release
git tag -v v0.12.2

# 2. the digest file: this asset set is the one they published
gpg --verify SHA256SUMS.asc SHA256SUMS

# 3. the assets: these files are the ones that digest file describes
sha256sum -c SHA256SUMS          # macOS: shasum -a 256 -c SHA256SUMS

# 4. the manifest inside: which commit each component is pinned to
cat release-manifest.json
```

Order matters. A hash that matches an unverified digest file proves nothing,
because whoever supplied the file could have supplied the hashes. Step 2 is what
makes step 3 mean something.

`xchain-node install v0.12.2` runs the same chain for you: it verifies
`SHA256SUMS.asc` against a copy of this key shipped inside the repository, checks
the manifest against the signed digests, and refuses the install when the
signature is missing, tampered with, or made by any other key. Set
`XCHAIN_NODE_REQUIRE_SIGNED_RELEASE=0` to install without that check (airgapped
and development use); it says so on every run.

### Two places to read the fingerprint

The public key is committed at `tools/release/release-signing-key.asc` in every
train repository, with its fingerprint beside it in
`tools/release/release-signing-fingerprint.txt`. That copy is what CI and
`xchain-node` check against, and it reaches you through git history rather than
through this site, so the two can be compared instead of trusted one at a time.
If they ever disagree, trust neither and ask.

## Operational notes

- The private key lives only in the release operator's local GPG keyring, with
  an armored 0600 backup alongside the bootstrap signing key (off-site copy per
  the Backup/DR runbook).
- Rotation follows KEY-ROTATION-RUNBOOK.md: generate the successor, cross-sign
  it with the outgoing key, publish both, then retire the old key at its expiry.
