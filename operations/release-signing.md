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

## Operational notes

- The private key lives only in the release operator's local GPG keyring, with
  an armored 0600 backup alongside the bootstrap signing key (off-site copy per
  the Backup/DR runbook).
- Rotation follows KEY-ROTATION-RUNBOOK.md: generate the successor, cross-sign
  it with the outgoing key, publish both, then retire the old key at its expiry.
