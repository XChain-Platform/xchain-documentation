<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Features

This document walks the feature surfaces grouped by capability rather than by route. For the route-by-route walk see [UX Surfaces](UX.md).

## Token issuance

Full lifecycle support for XChain tokens (and assets, sub-assets, numeric issuances):

- **Issue**: `IssueTokenForm.jsx`. Set tick, max supply, decimals, description, divisibility, lockable / unlockable. Token wizard (`TokenWizard.jsx`) wraps issue + initial mint + first distribution into a single guided flow for non-power-users.
- **Mint**: `MintForm.jsx`. Mint up to the remaining supply.
- **Destroy**: `DestroyForm.jsx`. Burn supply.
- **Token admin**: `TokenAdminForm.jsx`. Owner-only operations: lock supply (no further mint), transfer ownership, update description.
- **Distribution**: distribute mint to a single recipient via Send, to many via Airdrop, against a price via Dispenser, or against a holder snapshot via Dividend.

## Distribution surfaces

- **Airdrop**: `AirdropForm.jsx`. Multi-recipient distribution with a parsed-recipients preview (`core/src/airdrop/parseRecipients.js`), paste or upload a CSV, the wallet shows you exactly what will go where before you sign. Pending-airdrop tracking (`core/src/flows/pendingAirdrops.js`) handles long-running multi-tx airdrops with resume on interruption.
- **Dispenser**: `DispenserForm.jsx` to create, `DispensersList.jsx` to browse, `DispenserDetail.jsx` to buy / inspect / close. A dispenser sells token X for native coin at a fixed rate; the buyer sends the coin and the dispenser auto-distributes the token.
- **Dispenser explorer**: `DispenserExplorer.jsx`. Cross-token discovery view, sortable by price, asset, escrow, or remaining supply.
- **Dividend**: `DividendForm.jsx`. Distribute a payout proportional to a holder snapshot; reads the explorer for current balances and shows the per-recipient breakdown before sign.

## DEX surface

The wallet exposes the platform's full on-chain DEX:

- **Markets list**: `MarketsList.jsx`. Discovery view across all token pairs.
- **Market view**: `MarketView.jsx`. Per-pair surface combining:
  - Price chart via `MarketChart.jsx` (lightweight-charts, fed from explorer trade history)
  - Place-order panel (`PlaceOrderPanel.jsx`), limit ORDER with expiry; native-coin or token side
  - Orderbook (`OrderbookPanel.jsx`), bucketized, with `core/src/market/bucketize.js`
  - Recent trades (`RecentTradesPanel.jsx`)
  - Open orders (`OpenOrdersPanel.jsx`), your unfilled orders with cancel
  - Trade history (`TradeHistoryPanel.jsx`), your fills

Order matching happens in `xchain-indexer`; the wallet only places + cancels.

## Encrypted messaging

`MESSAGE` action with three encryption modes:

- **ECIES**: multi-device default. Encrypt to the recipient's public key; recipient decrypts with their private key. The recipient doesn't need to be online or have prior contact.
- **ECDH**: session-based. Two parties run a Diffie-Hellman exchange to derive a shared secret; subsequent messages use that secret. Forward secrecy across sessions.
- **AES**: pre-shared key. Out-of-band shared secret; useful for groups or for a known counterparty.

Surfaces:

- **Compose**: `ComposeMessage.jsx`. Pick recipient (with public-key auto-resolution from on-chain history), pick encryption mode, write the body. Replies and threads default to the original encryption mode.
- **Inbox**: `MessagingInbox.jsx`. Decrypted message list with unread badge, reply, and ECIES-multi-device sync (your other devices that share the same mnemonic see the same inbox).

Pubkey lookup is automatic, the SDK queries the explorer for the recipient's most-recent on-chain transaction and extracts their public key from the input. If the recipient has no on-chain history the wallet surfaces a helpful error before sign.

## Smart contracts

xchain-vm runs JavaScript contracts in sandboxed V8 isolates with deterministic execution and AST-based gas metering. The wallet's contract surface:

- **Deploy**: `DeployContractForm.jsx`. Paste / upload contract source, see syntax-validation result, see gas estimate, sign the DEPLOY action.
- **Execute**: `ExecuteContractForm.jsx`. Pick a deployed contract, choose a method, fill arguments, see gas estimate, sign EXECUTE.
- **Funds**: `ContractFundsForm.jsx`. DEPOSIT a token into a contract's escrow; WITHDRAW back out.
- **Browse**: `ContractsList.jsx` per chain; `ContractDetail.jsx` shows bytecode + state + recent calls.
- **Author utilities**: syntax validation, float detection (contracts must use integer arithmetic), base64 encoding, gas estimation. All exposed by the SDK; the wallet wraps them behind the form UI.
- **ContractClient**: for repeated interactions with a specific contract, the SDK exposes a bound client. The wallet uses it under the hood; advanced users can mint one in the dApp bridge.

## BTC staking + delegation

Bitcoin-only validator participation:

- **Stake**: `StakeForm.jsx`. Lock up BTC for a chosen epoch count.
- **Unstake**: `StakingActionForm.jsx`. Withdraw stake after the unstake epoch passes.
- **Delegate**: `DelegationActionForm.jsx`. Delegate stake to an operator without giving up custody.
- **Revoke delegation**: same form. Reclaim direct control.
- **Claim rewards**: `StakingActionForm.jsx`. Sweep accrued rewards.
- **Staking dashboard**: `StakingDashboard.jsx`. Current stake, delegated stake, rewards, current epoch, next-unstake-eligible epoch.
- **Operator dashboard**: `OperatorDashboard.jsx`. For users running a validator: total delegated stake, delegator count, uptime, pending rewards.

## Multisig

See [Multisig](MULTISIG.md) for the full state machine. The wallet supports:

- **Classical n-of-m**: every cosigner produces a partial PSBT; coordinator finalizes via `xchain-sdk@1.13.0+`'s `wallet.signMultisigPsbt`. Today: software signer is the path of least resistance; hardware signers surface a deferral with a fallback.
- **MuSig2**: three-round protocol (commit → reveal → sign) producing a single Schnorr signature indistinguishable from a single-signer transaction. Software-signer-only today; hardware-signer support is firmware-gated.
- **Per-address multi-config**: schema v2 supports more than one multisig config per address, useful for rolling key rotation.
- **Transport**: paste-inbox + camera scanner + AnimatedQrFrames for offline cosigner round-trips. See [URI Schemes](URI_Schemes.md) for the encoded envelope.

## Cross-chain flows

- **Cross-chain swap**: `CrossChainSwapForm.jsx`. SWAP action across chains (BTC ↔ LTC ↔ DOGE) coordinated by `xchain-hub`.
- **Cross-chain templates**: `CrossChainTemplates.jsx`. Pre-built parallel-composer presets like "issue token on BTC + seed dispenser on LTC atomically".
- **Parallel composer**: `ParallelComposer.jsx`. Custom multi-chain action sequence with per-chain SDK instances and atomic-or-rollback semantics where the protocol allows.
- **Per-chain SDK registry**: `core/src/sdk/SDKRegistry.js`. The wallet keeps a registered SDK instance per chain so cross-chain flows can call into multiple chains in one user-confirmed step.

## dApp bridge

The wallet exposes `window.xchain` to dApps in browser tabs. See [Bridge](BRIDGE.md) for the full API. Provided methods:

- **`connect`**: initial origin grant
- **`getAccounts`** / **`getBalances`** / **`getSupportedChains`**, read-only
- **`signMessage`**: arbitrary message; user-confirmed
- **`signPsbt`**: sign a dApp-supplied PSBT under user-controlled paths
- **`signAction`**: sign a dApp-supplied XChain action; the wallet decodes + reviews + signs
- **`sendAction`**: sign + broadcast in one approval
- **`signIn`**: Sign-In with XChain (`@xchain-wallet/bridge-spec`'s `formatSignInChallenge` + `parseSignInChallenge`)
- **Events**: `accountsChanged`, `chainChanged`, `disconnect`, plus action-status streams via the SDK's WebSocket layer

## Air-gapped PSBT signing

For users who keep keys on an offline device:

- **Encoded transport**: chunked PSBT-QR over multiple frames (`core/src/uri/psbtQr.js`); BIP21 envelope for short payloads (`core/src/uri/bip21.js`); dedicated multisig PSBT envelope for cosigner rounds (`core/src/uri/multisigPsbtEnvelope.js`)
- **Animated frames**: `AnimatedQrFrames.jsx` paints multi-frame QRs; default 3 fps; `prefers-reduced-motion: reduce` flips to manual prev / next
- **Camera scanner**: `QrScanner.jsx` reads frames from the device camera; `core/src/uri/detectQrContent.js` routes BIP21 / PSBT-QR / multisig-envelope / sign-in-challenge / generic-string content to the right handler
- **Cross-shell pairing**: `RemoteSigner` lets the offline shell sign for the online shell once the channel is established

## Onboarding & recovery

- **Create**: fresh BIP39 24-word mnemonic, optional 25th-word passphrase, password-derived vault encryption
- **Import**: BIP39 (12 / 15 / 18 / 21 / 24 words), Counterwallet legacy, or single WIF
- **Migrate to BIP39**: one-way migration from Counterwallet legacy mnemonic; fresh BIP39 phrase, opt-in sweep flow to move balances
- **Discover used addresses**: gap-limit scan that populates already-used receive addresses on import
- **Dry-run restore**: verify a mnemonic + passphrase pair against the first N derived addresses without committing to a fresh wallet
- **Backup file**: full vault export, re-wrapped under a backup-specific KDF
- **View private key**: per-address WIF export, gated behind password re-entry

## Lock / unlock / auto-lock

- Argon2id-derived session key cached in `chrome.storage.session` (extension), OS keychain (desktop, optional), or in-memory only (web)
- Foreground auto-lock with configurable timeout (default 5 minutes)
- Manual lock action accessible from the global menu and via keyboard shortcut
- Browser-close drops the session-key namespace automatically
- OS keychain auto-unlock on desktop is disabled by default; opt-in via Settings → Security

## Internationalization & accessibility

- **i18n**: string registry under `core/src/i18n/`; English ships at v1.0.0 GA. Locale picker in Settings → Display.
- **Static a11y audit**: five-rule mechanical scan (button label / img alt / input label / textarea label / div-onclick role+tabIndex) over every shared route + UI primitive. CI fails on regression.
- **Reduced motion**: `prefers-reduced-motion: reduce` flips `AnimatedQrFrames.jsx` from auto-advance to manual stepping with prev / next buttons; cadence label flips from "3 fps" to "manual".
- **WCAG 2.2 AA**: target for the external accessibility audit. Audit-readiness packet ships with the repo.

## Reproducible builds

The pre-signing Linux desktop bundle is **Level-2 reproducible**:

- Digest-pinned base image (`Dockerfile`)
- Frozen lockfile (`pnpm install --frozen-lockfile`)
- `SOURCE_DATE_EPOCH` derived from `git log -1 --pretty=%ct`
- `RELEASE_HASHES.txt` SHA-256 manifest emitted by `scripts/build.sh`
- 18-rule static scaffolding audit (`packages/core/scripts/repro-build-audit.js`) gated on every commit

See [Reproducible Builds](Reproducible_Builds.md) for the run-twice-and-compare verification protocol.

## URI scheme handling

Registered handlers across all three shells for:

- `bitcoin:` / `dogecoin:` / `litecoin:`; BIP21 payment URIs
- `xchain:`: XChain-specific URIs (e.g. action-share links)

The Chrome extension registers via the manifest; the desktop app via electron's `setAsDefaultProtocolClient`; the web app via the modern Web `registerProtocolHandler` API.

## Connected sites + permissions

Every dApp grant is persisted in the vault's `connectedSites` collection:

- **Per-origin grant**: origin, granted methods, granted addresses, granted-at, last-used-at
- **Action-level policy**: `always` / `ask` / `never` per action
- **Surfacing**: Settings → Connected Sites for revoke; approval popup for new requests; per-action review on every privileged call (regardless of policy)
- **Revocation**: single-click; immediate effect; the dApp's next call surfaces a fresh approval prompt

## Notifications

- **In-app**: toast notifications on action submission, broadcast, indexed
- **Browser**: optional desktop notification on indexed action completion (extension + desktop)
- **WebSocket-driven**: hooks into the SDK's `onAction(address)` and `onCoinpayRequired()` for live updates without polling

## Developer mode

Settings → Developer enables:

- Network override per chain (e.g. point Bitcoin at testnet or regtest)
- Custom RPC endpoint per service (encoder, explorer, hub)
- Diagnostic dump (`core/src/flows/diagnosticDump.js`), anonymized state snapshot for bug reports
- Verbose action-decoder output

Developer mode is off by default. Enabling it surfaces a banner in every shell so the user remembers they're not on the default network.

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
