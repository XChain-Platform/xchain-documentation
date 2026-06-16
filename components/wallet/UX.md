<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2026 Dankest, LLC -->

# UX Surfaces

This document walks every primary route the wallet exposes. All routes live in `@xchain-wallet/core` (`packages/core/src/shared/routes/`) and render identically in the web SPA, the extension popup, the extension full-screen view, and the desktop renderer.

## Route map

| Route | Component | Purpose |
|---|---|---|
| Onboarding | `Onboarding.jsx` | First-run create / import / migrate / restore landing |
| Create wallet | `CreateWallet.jsx` | Generate BIP39 mnemonic, set password, optional 25th-word passphrase |
| Import wallet | `ImportWallet.jsx` | Restore from BIP39 or single WIF |
| Migrate to BIP39 | `MigrateToBip39.jsx` | One-way migration from Counterwallet legacy mnemonic |
| Locked | `Locked.jsx` | Password unlock screen |
| Loading | `Loading.jsx` | Vault decryption progress |
| Home | `Home.jsx` | Multi-chain balance dashboard, primary CTA hub |
| Send | `Send.jsx` | Single-asset send with review + sign |
| Receive | `Receive.jsx` | Address QR + label + chain picker |
| History | `History.jsx` | Per-address action history |
| Address list | `AddressList.jsx` | Standalone address browser with multisig badging + filter |
| Contacts | `ContactsList.jsx` | Saved address book with edit / remove |
| Actions menu | `ActionsMenu.jsx` | Indexed launcher for every supported action |
| Token wizard | `TokenWizard.jsx` | Guided issue + mint + distribute flow for new token issuers |
| Issue | `IssueTokenForm.jsx` | Raw ISSUE form with all parameters |
| Mint | `MintForm.jsx` | MINT form |
| Destroy | `DestroyForm.jsx` | DESTROY form |
| Token admin | `TokenAdminForm.jsx` | Owner-only token settings (lock supply, transfer ownership, etc.) |
| Dispenser | `DispenserForm.jsx` | Create dispenser flow |
| Dispensers list | `DispensersList.jsx` | Browse open dispensers |
| Dispenser detail | `DispenserDetail.jsx` | Buy / inspect / close a single dispenser |
| Dispenser explorer | `DispenserExplorer.jsx` | Cross-token dispenser discovery surface |
| Dividend | `DividendForm.jsx` | DIVIDEND form |
| Airdrop | `AirdropForm.jsx` | Multi-recipient airdrop with parsed-recipients preview |
| Markets list | `MarketsList.jsx` | DEX market discovery |
| Market view | `MarketView.jsx` | Per-market view: price chart, place order, orderbook, recent trades, open orders, trade history |
| Compose message | `ComposeMessage.jsx` | Encrypted-message compose (ECIES / ECDH / AES) |
| Messaging inbox | `MessagingInbox.jsx` | Decrypted message list with reply |
| Multisig create | `MultisigCreate.jsx` | n-of-m configuration setup |
| Multisig signing session | `MultisigSigningSession.jsx` | Active session view: round labels, paste inbox, partials, finalize |
| Pair signer | `PairSignerForm.jsx` | Pair a hardware or remote signer |
| Cross-chain swap | `CrossChainSwapForm.jsx` | SWAP coordinator view across chains |
| Cross-chain templates | `CrossChainTemplates.jsx` | Parallel composer presets (e.g. issue+seed dispenser on two chains atomically) |
| Parallel composer | `ParallelComposer.jsx` | Custom multi-chain action sequence |
| Stake | `StakeForm.jsx` | BTC STAKE form |
| Staking action | `StakingActionForm.jsx` | UNSTAKE / COLLECT form |
| Staking dashboard | `StakingDashboard.jsx` | Current stake + rewards + epoch view |
| Delegation | `DelegationActionForm.jsx` | DELEGATE (rotate + revoke) form |
| Operator dashboard | `OperatorDashboard.jsx` | Validator / operator view of delegations + uptime |
| Deploy contract | `DeployContractForm.jsx` | DEPLOY form with source review + gas estimate |
| Execute contract | `ExecuteContractForm.jsx` | EXECUTE method invocation |
| Contract funds | `ContractFundsForm.jsx` | DEPOSIT / WITHDRAW form |
| Contracts list | `ContractsList.jsx` | Per-chain deployed contracts |
| Contract detail | `ContractDetail.jsx` | Bytecode + state + recent calls |
| Coinpay | `CoinpayForm.jsx` | Native-coin payment leg of XChain action |
| Sweep | (in flow) | Send entire balance + dust to one destination |
| Link | `LinkForm.jsx` | LINK action: cross-chain anchor |
| Broadcast | `BroadcastForm.jsx` | BROADCAST action |
| Advanced action | `AdvancedActionsForm.jsx` | Catch-all power-user form for any registered action descriptor |
| Swap | `SwapForm.jsx` | SWAP action |
| View private key | `ViewPrivateKey.jsx` | Per-address WIF export, gated behind password re-entry |

## Onboarding

The first-run experience is one of:

- **Create new**: generate a fresh 24-word BIP39 mnemonic; user is required to acknowledge the phrase has been saved before the vault persists. Closing the tab at this stage leaves no persisted state.
- **Import existing**: paste a 12 / 15 / 18 / 21 / 24-word BIP39 mnemonic, with word-count + dictionary validation; or import a single WIF private key.
- **Restore from backup file**: re-wrap an exported vault under a fresh device password.
- **Counterwallet migration**: accept the legacy 12-word format, then optionally migrate to BIP39 from Settings later.

Optional 25th-word passphrase is offered on both Create and Import. The passphrase materially changes derived addresses; the wallet shows a pre-derivation preview to let the user confirm they've entered the correct passphrase.

## Lock / unlock / auto-lock

- **Manual lock**: accessible from the global menu and via keyboard shortcut. Zeroes the in-memory master key + session key.
- **Unlock**: password entry; on success, master key is derived (Argon2id) and the vault decrypts.
- **Foreground auto-lock**: configurable timeout in Settings. Default: 5 minutes idle. Lock fires on tab/window blur for the popup; on idle-detection for the desktop and full-screen views.
- **Browser-close lock**: extension session-key namespace clears automatically. Web shell drops in-memory keys when the tab unloads.
- **OS keychain auto-unlock**: desktop only, opt-in. Stores the session master key in the OS keychain (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux). Disabled by default; enabled via Settings → Security.

## Home

The home dashboard renders:

- A per-chain balance summary (`ChainBalanceCard`) with native-coin + token totals
- A primary CTA row: Send / Receive / Buy / Stake (chain-conditional)
- A secondary action grid surfacing the most-used actions (Issue / Dispenser / Order / Compose / Stake / Multisig)
- A history strip with the last 5 actions across the wallet
- A messaging-inbox unread-count badge linking to the inbox

The same Home renders in the popup (compact), the full-screen / desktop (expanded with charts), and the web app (responsive between popup-like and full-screen-like layouts).

## Send

The Send route is the canonical example of the sign-screen safety rail (see [Security & Threat Model; Sign-screen safety rails](SECURITY.md#sign-screen-safety-rails)):

1. **Form**: destination, amount, asset (native or token), optional memo, optional fee tier
2. **Review**: plain-English summary rendered alongside the encoded action string and the encoder's PSBT
3. **Sign**: signer-specific confirmation (in-vault password re-entry for software, device confirm for Trezor / Ledger)
4. **Broadcast**: wallet broadcasts via SDK; status surface streams encoder accept → mempool → confirmed → indexed
5. **Done**: txid + indexed action, with a link to History

Identical structure for every action form; only the form fields and review template differ.

## Receive

- Address QR for the active chain + address-type
- Per-address label
- Chain picker (`ChainBadge` + chain-icon-only buttons with `aria-label`)
- One-click copy for the address string (`CopyButton`)
- Optional BIP21 URI request (amount + label) for compatible payers

## History

Per-address history view. Each row renders the decoded action plus its on-chain status:

- Type; SEND / ISSUE / MINT / ORDER / DISPENSER / DIVIDEND / etc.
- Counterparty, destination or source address (with contact-list lookup)
- Amount + asset
- Fee
- Status, pending / mempool / confirmed / indexed / failed
- Block height + timestamp once indexed

History reads from `xchain-explorer` via the SDK. The wallet never re-derives state from raw blockchain data.

## Sign screens

Every action's sign screen renders three parallel views:

| Pane | Source | Trust |
|---|---|---|
| Form values | The user's own form input | Canonical |
| Decoded action summary | Re-decoded by the wallet from the action string | Canonical (deterministic decode) |
| Encoder PSBT | Returned from the encoder | Untrusted (encoder is a remote service) |

A discrepancy between the form pane and the decoded pane never happens unless the action descriptor or the decoder is buggy, both are tested by the same smoke suite. A discrepancy between either of those and the PSBT pane is what the user is being asked to catch by eye, and what the next-iteration byte-level cross-check will catch automatically.

## Multisig session view

`MultisigSigningSession.jsx` renders an active n-of-m or MuSig2 session:

- **Round label** (explicit "Round 1 of 3) commit", "Round 2 of 3 (reveal", "Round 3 of 3) sign" so the user knows where they are in the protocol
- **Paste inbox**: accepts cosigner partial PSBTs by paste or QR scan
- **Cosigner list**: green check / pending dot per cosigner
- **Camera scanner**: `QrScanner.jsx` reads chunked PSBT-QR via `core/src/uri/psbtQr.js`
- **Animated frames**: `AnimatedQrFrames.jsx` paints multi-frame QRs at 3 fps for the next cosigner; honors `prefers-reduced-motion: reduce` with manual prev / next stepping

See [Multisig](MULTISIG.md) for the full session state machine.

## Contacts

- Saved address book with edit / remove
- Removed-row buttons announce "Remove address N" rather than the `×` codepoint
- Contact lookup is integrated into Send (autocomplete) and History (counterparty resolution)

## QR scanner

`QrScanner.jsx` is the device-camera surface used by:

- Send (paste address from another device's QR)
- Multisig signing session (scan a cosigner's PSBT-QR frame stream)
- Pair signer (scan a remote-signer pair code)

The scanner runs through `getUserMedia`. The Chrome extension surfaces the runtime camera prompt only when the user explicitly clicks "Scan". No implicit camera grant.

## Command palette + keyboard shortcuts

Power users get:

- **Command palette**: Cmd/Ctrl + K opens an indexed launcher over every action route, settings panel, and help topic
- **Keyboard shortcuts**: Cmd/Ctrl + L (lock), Cmd/Ctrl + N (new send), Cmd/Ctrl + R (refresh balances), Esc (back / close), Tab/Shift+Tab focus order on every form

## Settings

Settings are organized under sections:

- **Security**: auto-lock timeout, OS-keychain auto-unlock (desktop), view private key, change password, export backup
- **Chains**: per-chain endpoint URLs (encoder / explorer / hub), default fee strategy, address-type preference
- **Accounts**: manage HD accounts under each wallet
- **Signers**: registered hardware + remote signers, pair-new, remove, firmware version
- **Connected sites**: per-origin dApp grants with revoke
- **Multisig**: registered n-of-m configs
- **Display**: locale (i18n), theme, reduced-motion override
- **Developer**: developer-mode toggle, network override, custom RPC, diagnostic dump
- **About**: `package.json.version`, build hash, license, third-party notices

## Automatic donation system (ADS)

Optional opt-in. When enabled, a configurable percentage of every action fee is routed to a user-chosen donation address (default: the platform's open-development fund). Off by default; surfaced in Settings → Display.

## Micro-UX polish

- `AddressText.jsx` truncates long addresses with a hover-revealed full string and a one-click copy
- `CopyButton.jsx` flashes a confirmation toast on copy
- `ChainBadge.jsx` color-codes each chain consistently across all surfaces
- `MultisigBadge.jsx` marks multisig addresses with a chip + `aria-label`
- `DispenserBadge.jsx` marks dispenser-source addresses
- `MnemonicGrid.jsx` renders the recovery phrase as a confirm-by-position grid on Create
- `DerivationPathCrossCheck.jsx` shows the derivation path next to each derived address so users can verify correct derivation across wallets

---

**Copyright &copy; 2026 Dankest, LLC**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later).
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
