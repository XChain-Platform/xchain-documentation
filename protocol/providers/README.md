<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Attestation Providers

Attestation **providers** are the named services that the validator network can query on a smart contract's behalf through the [attestation framework](../actions/ATTEST.md). A contract emits an `ATTEST v0` request naming a provider; validators holding the `attestation` capability fetch the answer through that provider, agree on a canonical result, and write it back on-chain as an `ATTEST v1` response.

The provider determines two things: how the request payload is interpreted, and how validators decide that independent answers agree (the consensus strategy). The contract-facing API is identical across providers; only the payload format and trust model differ.

The set of providers is **governance-controlled**; new providers can be added without changing the contract API.

Each provider also carries a **`min_fee_xchain`** setting; a governance-configurable floor on the optional paid-attestation fee (`feeTick`/`feeAmount` in the request). Requests whose on-chain `FEE_AMOUNT` falls below the provider's floor are skipped by validators: the request expires on its deadline and the fee is refunded to the caller rather than being served.

## Available providers

| Provider | Purpose | Payload | Consensus |
|---|---|---|---|
| `http_get` | Fetch an HTTPS URL and return the response body | A URL string | Exact byte-equality across validators |
| [`llm`](./llm.md) | Send a prompt to an approved language model | JSON prompt envelope | A judge model decides semantic equivalence |

### `http_get`: the endpoint must be stable

`http_get` reaches agreement on the **exact response bytes and HTTP status code** returned to each validator. Because the status code is part of what validators agree on, the target endpoint must answer every validator with the same body and the same status during the request's lifetime. Endpoints that vary per request break agreement silently:

- conditional caching that returns `200` to one validator and `304` to another,
- rate limiting that returns `429` or `503` to a subset,
- load-balanced backends whose bodies differ byte-for-byte,
- any content that changes between fetches (timestamps, random ordering, session tokens).

When validators land on different answers, no group reaches quorum. The request does not raise a retryable error; it stays pending until its deadline block and then **expires** (the contract receives a `status='expired'` response with an empty payload, and any attestation fee is refunded). Point `http_get` at a stable, deterministic URL (for example a pinned data snapshot or a versioned API path) rather than a live, cache-fronted, or rate-limited endpoint. For answers that legitimately vary across validators, use a provider whose consensus tolerates variance, such as [`llm`](./llm.md).

See [`ATTEST`](../actions/ATTEST.md) for the request/response/expire wire lifecycle, and [Smart Contracts](../../concepts/Smart_Contracts.md) for the contract-side `xchain.attestation.*` API.

---

**Copyright © 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC – https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later) with a commercial license available for proprietary use.
