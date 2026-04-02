<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform E2E Test Suite

## What is xchain-e2e-test

xchain-e2e-test is the end-to-end Mocha test suite for the XChain Platform. It exercises the full platform stack — encoder, decoder, indexer, explorer, hub, UTXO tracker, and regtest miner — against a live regtest deployment. Tests are not mocked; they broadcast real transactions to a regtest coin node and verify that the platform processes them correctly end to end.

## How It Works

Each test follows the same pattern:

1. **Create wallets** — BIP39 mnemonics and BIP32 derivation paths generate deterministic test wallets programmatically
2. **Fund addresses** — the regtest miner's `send_funds` JSON-RPC method sends coins to the test wallet addresses
3. **Construct and broadcast** — the encoder builds a PSBT for the desired XChain action; the test signs and broadcasts it via the coin node
4. **Mine** — the regtest miner detects the mempool transaction and mines a block (with a configurable delay to batch related transactions)
5. **Poll and verify** — the test polls the indexer or explorer API until the action appears, then asserts the expected token state, balances, or transaction status

## Test Structure

Tests are ordered and stateful. Later tests depend on wallets, tokens, and actions created by earlier tests. Running tests out of order will produce failures. The suite is designed to run as a single sequential pass from start to finish.

Test files are organized by action type:

- ISSUE, MINT, SEND, DESTROY
- ORDER, DISPENSER, SWAP
- DIVIDEND, AIRDROP
- FILE, MESSAGE, BROADCAST
- ADDRESS, LINK, LIST, CALLBACK
- BATCH (multi-action combinations)
- SWEEP, SLEEP

## Running the Tests

The full regtest stack must be running before starting the test suite. This includes the coin node in regtest mode, xchain-regtest-miner, xchain-utxo-tracker, xchain-encoder, xchain-decoder, xchain-indexer, xchain-explorer, and xchain-hub.

```bash
cd xchain-e2e-test
npm install
npm test
```

Tests use `--timeout 0` because polling for on-chain confirmation has no fixed upper bound. Individual tests may take several seconds while waiting for the indexer to process a block.

## Configuration

The test suite reads from a local `config.json` or from xchain-hub. It needs:

- Coin node RPC connection details (for broadcasting transactions)
- Encoder API URL
- Explorer or indexer API URL
- Hub URL (for config discovery)

## Related

- [Regtest Development Guide](../../developer-guide/REGTEST_DEVELOPMENT.md) — setting up a local regtest environment
- [Regtest Miner](../regtest-miner/) — the auto-mining service the e2e suite depends on

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
A full copy of the License is available at: [https://dankest.llc/license](https://dankest.llc/license)
