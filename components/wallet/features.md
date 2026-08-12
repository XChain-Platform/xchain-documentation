<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# Features

This document walks the feature surfaces grouped by capability rather than by route. For the route-by-route walk see [UX Surfaces](ux.md).

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

## Betting (BET)

Parimutuel betting markets, offered on every chain whose descriptor advertises `BET`. The wallet
covers both roles: the bettor who backs an outcome, and the oracle who runs the market.

- **Markets list**: `BetFeedsList.jsx`. Discovery view with search, a network filter, and status
  pills that show the market's STORED status rather than one recomputed from the clock.
- **Market view**: `BetFeedDetail.jsx`. Pools per outcome and the place-bet flow itself. Note it does
  NOT project what a win would pay: `projectBetPayout` exists in `betQueries.js` but no screen calls it,
  so a bettor sees the current split and the round-down warning without the number itself.
- **Create a market**: `CreateBetFeedForm.jsx`. Label, 2 to 16 outcomes, wager token, oracle fee,
  deadline, refund window, optional minimum stake and allow/block lists.
- **My bets**: `MyBets.jsx`. Your wagers across every address, as open / won / lost / refunded.
- **Oracle console**: `OracleConsole.jsx`. The markets you run: Resolve (legal only between the
  deadline and the end of the refund window) and Cancel (legal only before a terminal state), both
  hidden in watcher mode. Markets are immutable once created, so the correction path is Cancel plus
  "Copy to a new market".
- **Oracle record**: `OracleRecord.jsx`. An oracle's history and fees earned, for judging a market
  before staking on it.

Composers live in `core/src/flows/betActions.js` (one per wire format) and read paths in
`core/src/flows/betQueries.js`. Creating a market and placing a bet are both fee-bearing and mount
`NativeFeeToggle`; resolve and cancel are not fee-bearing and deliberately do not.

Settlement is automatic: payouts credit the address that placed the bet, so there is no claim step
and no claim button.

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
- **Author utilities**: syntax validation, float detection (a non-blocking lint warning; prefer `xchain.math` arithmetic), base64 encoding, gas estimation. All exposed by the SDK; the wallet wraps them behind the form UI.
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

## Governance (VOTE)

Token-weighted governance polls, on every chain:

- **Browse polls**: `GovernancePolls.jsx` lists polls per chain with lifecycle status (open / finalized / failed quorum); `PollDetail.jsx` shows the question, options, tallies, and the caller's ballot.
- **Create poll**: `CreatePollForm.jsx`. Pick the weight token, end block, options, tally and weight modes, optional quorum / deposit, and the binding-poll callback fields.
- **Vote**: cast approval or split ballots from `PollDetail`; a later ballot replaces your earlier one.
- **Delegate**: `DelegateVoteForm.jsx` sets or clears a standing per-token delegation of voting weight.
- **Availability guard**: `useGovernanceAddressesPresent` hides the whole feature where the wallet has no addresses on a governance-capable chain.

## Multisig

See [Multisig](multisig.md) for the full state machine. The wallet supports:

- **Classical n-of-m**: every cosigner produces a partial PSBT; coordinator finalizes via `xchain-sdk`'s `wallet.signMultisigPsbt`. Today: software signer is the path of least resistance; hardware signers surface a deferral with a fallback.
- **MuSig2**: two-round protocol per BIP327 (round 1: collect public nonces; round 2: collect partial signatures) producing a single Schnorr signature indistinguishable from a single-signer transaction. Software-signer-only today; hardware-signer support is firmware-gated.
- **Per-address multi-config**: schema v2 supports more than one multisig config per address, useful for rolling key rotation.
- **Transport**: paste-inbox + camera scanner + AnimatedQrFrames for offline cosigner round-trips. See [URI Schemes](uri-schemes.md) for the encoded envelope.

## Cross-chain flows

- **Cross-chain swap**: `CrossChainSwapForm.jsx`. SWAP action across chains (BTC ↔ LTC ↔ DOGE) coordinated by `xchain-hub`.
- **Cross-chain templates**: `CrossChainTemplates.jsx`. Pre-built parallel-composer presets like "issue token on BTC + seed dispenser on LTC atomically".
- **Parallel composer**: `ParallelComposer.jsx`. Custom multi-chain action sequence with per-chain SDK instances and atomic-or-rollback semantics where the protocol allows.
- **Per-chain SDK registry**: `core/src/sdk/SDKRegistry.js`. The wallet keeps a registered SDK instance per chain so cross-chain flows can call into multiple chains in one user-confirmed step.

## Proof verification (SPV)

The wallet does not take displayed balances and history on trust from the explorer. It verifies them against a quorum-signed checkpoint using the SDK light client (`sdk.light`), so a compromised server can withhold data but cannot make a forged balance or fabricated action verify.

- **Verified surfaces**: token balances (`BalanceList` / `HomeTabs` / `Home`) and history actions (`History` `EntryRow`). The native coin is not badged (it is not in the committed state tree).
- **Badges**: `VerifiedBadge.jsx` renders `verified` / `proof-failed` / `unverified` per row. `core/src/flows/verifyBalances.js` (`verifyAddressBalance` / `verifyAddressAction`) wraps `sdk.light` and normalizes to `{ status, amount, height, reason }`; it never throws. Only a concrete proof-versus-amount contradiction is `proof-failed`, quorum / checkpoint / transport problems degrade to `unavailable`.
- **Wiring**: `core/src/shared/hooks/useProofVerification.js` runs a bounded per-row fan-out and reduces verdicts (any contributing address failing fails the row). The `verifyProofs` setting (default on) gates it; background hosts expose `balances.verify` / `history.verify`.
- **Trust root**: the signer set comes from the SDK's pinned launch trust root and follows validator rotation forward, not from the explorer. See the SDK [Light Client](../sdk/light-client.md) reference and [Security](security.md#proof-verification-spv).

## dApp bridge

The wallet exposes `window.xchain` to dApps in browser tabs. See [Bridge](bridge.md) for the full API. Provided methods:

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
- **UR (Keystone / Passport) ingestion**: `core/src/uri/urPsbt.js` decodes `ur:crypto-psbt` animated-QR streams from UR-speaking hardware signers (bytewords + minimal CBOR + fountain-code reassembly), wired into the PSBT sign form's paste and camera-scan paths. See [URI Schemes](uri-schemes.md#ur-urcrypto-psbt-ingestion).
- **Cross-shell pairing**: `RemoteSigner` lets the offline shell sign for the online shell once the channel is established

## Onboarding & recovery

- **Create**: fresh BIP39 12-word mnemonic by default (24 words selectable), optional 25th-word passphrase, password-derived vault encryption
- **Import**: BIP39 (12 / 15 / 18 / 21 / 24 words), Counterwallet legacy, or single WIF
- **Migrate to BIP39**: one-way migration from Counterwallet legacy mnemonic; fresh BIP39 phrase, opt-in sweep flow to move balances
- **Discover used addresses**: gap-limit scan that populates already-used receive addresses on import
- **Dry-run restore**: verify a mnemonic + passphrase pair against the first N derived addresses without committing to a fresh wallet
- **Backup file**: full vault export, re-wrapped under a backup-specific KDF
- **Add address**: `AddAddressModal` batch-generates 1-25 addresses (Coin + Type picker), sequentially; hardware wallets prompt the device per address
- **View private key**: per-address WIF export; gated by a warning in an unlocked session (no password re-entry); requires unlock when the wallet is locked

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

See [Reproducible Builds](reproducible-builds.md) for the run-twice-and-compare verification protocol.

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
