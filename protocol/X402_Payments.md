<!--
Copyright © 2025–2026 Dankest, LLC
SPDX-License-Identifier: AGPL-3.0-or-later
Licensed under the GNU Affero GPL v3.0 or later; see LICENSE.md.
A commercial license is available — contact legal@dankest.llc.
-->

# x402 Payments (HTTP 402 over XChain)

Wire specification for charging HTTP clients — typically AI agents — in XChain tokens, using an HTTP 402 challenge → on-chain payment → retry loop. The flow is shaped like the x402 convention (status 402, an `accepts` array, an `X-Payment` request header, an `X-Payment-Response` response header) but settles natively on XChain rails; it is **not** compatible with stablecoin x402 facilitators. Reference implementation: `xchain-sdk` (`X402Gateway` server side, `X402Client` client side).

This is an **off-chain HTTP convention over existing on-chain actions**. It introduces no new ACTION types and no consensus changes.

## Flow

```
Client                          Server (gateway)                 Chain
  | GET /resource                  |                               |
  |------------------------------->|                               |
  |   402 {accepts:[...]}          |                               |
  |<-------------------------------|                               |
  |  SEND tick/amount -> payTo, MEMO = invoice nonce               |
  |---------------------------------------------------------------->
  | GET /resource  X-Payment: <proof>                              |
  |------------------------------->| verify via explorer ----------|
  |   200 + X-Payment-Response     |   (mempool 0-conf / indexed)  |
  |<-------------------------------|                               |
```

## Challenge (HTTP 402 response body)

```json
{
  "x402Version": 1,
  "error": "Payment required",
  "resource": "/api/report",
  "accepts": [
    { "scheme": "xchain-send", "coin": "DOGE", "tick": "MYTOKEN",
      "amount": "5", "payTo": "D...", "invoice": "<32 lowercase hex chars>",
      "expiresAt": 1765500000000, "minConfirmations": 0 },
    { "scheme": "xchain-dispenser", "coin": "DOGE", "holdTick": "ACCESS",
      "minBalance": "1", "dispenserIndex": 4201, "dispenserAddress": "D..." },
    { "scheme": "xchain-deposit", "coin": "DOGE", "tick": "MYTOKEN",
      "depositAddress": "D...", "pricePerCall": "1" }
  ]
}
```

- `amount`, `minBalance`, `pricePerCall` — arbitrary-precision decimal **strings** (plain decimal; no exponents).
- `invoice` — a server-generated single-use nonce (16 random bytes, 32 lowercase hex chars). The payer embeds it **verbatim** as the SEND `MEMO`.
- `expiresAt` — Unix milliseconds; servers honor a small grace window (reference: 10 s).
- `minConfirmations` — `0` means the server will grant **provisionally** on mempool visibility (see Trust model); `1+` requires indexed, valid rows.

## Proof (`X-Payment` request header)

`X-Payment: base64url(JSON)`:

```json
{ "x402Version": 1, "scheme": "xchain-send", "coin": "DOGE",
  "txid": "…", "invoice": "<nonce>", "payer": "<payer address>" }
```

`xchain-dispenser` and `xchain-deposit` proofs carry only `{x402Version, scheme, coin, payer}` — the server checks chain state (balance / confirmed deposits minus its spend ledger) directly.

## Receipt (`X-Payment-Response` response header)

`base64url(JSON)`: `{x402Version, status, txid, blockIndex, provisional, remaining?}` where `status` ∈ `confirmed | provisional_0conf | dispenser_verified | deposit_debited`.

## Verification rules (normative for servers)

A SEND satisfies an `xchain-send` invoice iff **all** of:

1. The on-chain `source` equals the proof's `payer` (front-runners who copy a mempool memo cannot claim someone else's payment).
2. An output of the SEND pays `payTo` with `tick` equal (ticks compare uppercased) and `amount >=` the invoice amount, compared as exact decimals — never floats, never with an epsilon.
3. That same output's `MEMO` equals the invoice nonce, strict equality after trimming (SEND v3 carries per-group memos — the memo of the **matched** output group counts).
4. The invoice is unexpired and has never been claimed. Claims are atomic and single-use.
5. For `minConfirmations >= 1`: the row is indexed with status `valid`. For `0`: a decoder-mempool row suffices, but the grant is **provisional**.

Multi-output SEND (v1–v3) must be parsed with tick/amount/destination/memo kept **paired per output** — matching `payTo` against one output and an amount from another is the classic implementation bug; field counts are strict per version (a `|` smuggled into a memo changes the count and the parse must fail).

## Trust model for 0-conf

Decoder mempool rows are **pre-validation**: the decoder records whatever parses out of an unconfirmed transaction; the indexer can still reject the action at confirmation (e.g. insufficient token balance). A 0-conf grant is therefore weaker than coin-level 0-conf and must be treated as provisional:

- The reference gateway re-checks provisional grants against indexed rows and either promotes them to `confirmed` or marks them failed after a window (default 10 minutes), notifying the operator.
- Serve only low-value or revocable resources at `minConfirmations: 0`; for anything irrevocable (e.g. handing over a decryption key), require `1+` — and on BTC consider more, per the value at stake. Reorg re-verification beyond this is out of scope for v1.

## Replay and state rules

- Invoice nonces are single-use, claimed under mutual exclusion; the claiming `txid` is recorded.
- The deposit scheme's spend ledger debits under per-payer mutual exclusion. A file-backed store is sound only for a **single-node** server; multi-node deployments must use a shared atomic store.
- A corrupt invoice/ledger state file must fail closed (block verification), never silently reset.

## Endpoints used

- Mempool (0-conf): `GET /{COIN}/api/mempool/{payTo}/address` — rows carry the raw decoded action string in `data`; the verifier parses it.
- Confirmed: `GET /{COIN}/api/sends/{payTo}/destination` — rows carry `source`, `tick`, `amount`, `memo`, `status`.
- Dispenser scheme: `GET /{COIN}/api/balances/{payer}`.

See also: [Token_Gated_Content.md](Token_Gated_Content.md) (selling decryption keys through this flow), [Error_Codes.md](Error_Codes.md), and the plain-language guide at [../ai-agents/Charging_Agents.md](../ai-agents/Charging_Agents.md).
