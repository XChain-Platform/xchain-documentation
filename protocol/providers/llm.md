<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# XChain Attestation Provider: `llm`

The `llm` provider lets a contract delegate a prompt to a governance-approved large language model. It's a thin specialization of the External Attestation Framework: payloads are JSON envelopes, consensus uses a judge-model strategy, and the chosen model is recorded in the on-chain response's `META` field.

For the framework itself see `actions/ATTEST.md` (covers v0=request, v1=response, v2=expire).

## Request

A contract calls the standard attestation gateway with `'llm'` as the provider:

```js
xchain.attestation.request(
    'llm',
    JSON.stringify({ prompt: 'What is the capital of France?', max_tokens: 16 }),
    'handleResponse',
    [],
    { redundancy: 1, deadlineBlocks: 20 }
);
```

To include a paid-attestation fee (E1), pass `feeTick` and `feeAmount` in the options object:

```js
xchain.attestation.request(
    'llm',
    JSON.stringify({ prompt: 'What is the capital of France?', max_tokens: 16 }),
    'handleResponse',
    [],
    { redundancy: 3, deadlineBlocks: 20, feeTick: 'XCHAIN', feeAmount: '0.5' }
);
```

`feeAmount > 0` escrows the fee from the calling contract at request time. On fulfillment the fee is split among the responsible validators; on expiry or provider error it is refunded in full to the caller.

The `REQUEST_PAYLOAD` is a JSON-encoded **prompt envelope**:

| Field              | Type             | Notes                                                                                  |
| ------------------ | ---------------- | -------------------------------------------------------------------------------------- |
| `prompt`           | string           | Required. The user-facing prompt.                                                      |
| `system`           | string           | Optional system message.                                                               |
| `max_tokens`       | integer          | Optional. Capped at the provider's `max_completion_tokens` (default 1024).             |
| `temperature`      | number           | Optional. Capped at the provider's `default_temperature` (default 0).                  |
| `format`           | `text`\|`json_object` | Optional hint.                                                                    |
| `envelope_version` | integer          | Optional. Validators reject envelopes above the registered `prompt_envelope_version`.  |

Envelope size is bounded by the registry's `max_request_bytes` (8192).

## Approved Models

`approved_models` is governance-controlled. Defaults at launch:

- `claude-sonnet-4-6`
- `claude-opus-4-7`

The fetch model is resolved from the block-anchored provider config at the request's block (the `pinnedModel` supplied by the leader), ensuring every validator uses the same model for the same request. When no pinned value is present (non-consensus callers), the first entry of the allow-list is used. There is no `LLM_DEFAULT_MODEL` env override in the consensus fetch path; that env var was removed to eliminate per-operator divergence. The selected model is echoed back in the response's `META` field for audit.

The `judge_model` (default `claude-haiku-4-5`) is also block-anchored. The leader resolves `pinnedJudgeModel` from the same provider config snapshot used for the fetch model (the `judge_model` key in the governance-controlled `additional_config` at the request's block). This means a governance change to `judge_model` activated after the request's block cannot alter an in-flight round. The judge runs at `temperature=0` to evaluate semantic equivalence across candidate responses. When no pinned value is available, the provider module's compiled-in `JUDGE_MODEL` constant (`claude-haiku-4-5`) is used as a fallback.

## Consensus

| Redundancy | Strategy                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `1`        | No consensus. The single responsible validator's response is final after the deadline window. The responsible validator is still selected deterministically: all validators with the `attestation` capability are sorted by SHA-256(request_id \|\| pubkey) and only the top-1 entry serves the request. |
| `3` / `5`  | `judge_model` strategy. Validators fetch independently; the judge picks the canonical response. The top-REDUNDANCY entries by the same SHA-256 sort form the responsible set, with the lowest-hash validator acting as leader. |

LLM responses won't be byte-identical even at `temperature=0` (whitespace, occasional rerouting). The judge call decides whether they're *semantically* equivalent; if so, it returns a `canonical_index` and that proposal becomes the on-chain response. If not, the round emits no-quorum and the request expires on its deadline (callback fires with `status='expired'`).

## Auth & Transport (operator-managed)

Each validator's hub picks a transport per `xchain-hub/src/lib/hub-credentials.js`. Both transports return `{ body, meta: <model> }`; the choice is invisible to contracts and to other validators (only response bytes feed PBFT).

| Transport       | Auth source                                                                                         | Cost model                       | Determinism                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| `claude_spawn`  | `CLAUDE_CONFIG_DIR` (auto-refreshing token from `claude login`) or `CLAUDE_CODE_OAUTH_TOKEN`        | Claude Code subscription (flat) | CLI doesn't expose temperature; `judge_model` absorbs spread for redundancy≥3.       |
| `anthropic_api` | `ANTHROPIC_API_KEY`                                                                                 | Pay-per-token API billing        | Explicit `temperature=0`. Higher byte-equality rate but still gated by `judge_model`.|

Resolution order (first match wins):
1. `HUB_CLAUDE_CONFIG_DIR`
2. `CLAUDE_CONFIG_DIR`
3. `HUB_CLAUDE_CODE_OAUTH_TOKEN`
4. `CLAUDE_CODE_OAUTH_TOKEN`
5. `ANTHROPIC_API_KEY`
6. Default `~/.claude-xchain` if pre-populated.

A mixed-transport quorum still converges because `judge_model` evaluates semantic equivalence, not byte equality.

### Operator setup (`claude_spawn`)

One-time, on each validator:

```bash
CLAUDE_CONFIG_DIR=~/.claude-xchain claude login
```

Then start the hub with `HUB_CLAUDE_CONFIG_DIR=~/.claude-xchain` in the environment. The CLI's `.credentials.json` carries a refresh token that the spawned CLI auto-renews on every call. No rotation needed unless the operator logs out.

### Operator setup (`anthropic_api`)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

No other state needed. The hub bills per token directly through the Anthropic API.

## Cost

| Component                  | Default        | Notes                                                                          |
| -------------------------- | -------------- | ------------------------------------------------------------------------------ |
| `per_call_base_fee_xchain` | `0.50`         | Higher than `http_get` (`0.01`); each call has a real upstream cost.          |
| `min_stake_xchain`         | `25000`        | Higher than `http_get` (`10000`): reflects larger trust + ongoing API spend.  |
| `min_fee_xchain`           | `0`            | Governance-configurable hub-local floor on the optional paid-attestation fee. Requests whose on-chain `FEE_AMOUNT` is below this value are skipped by validators and the request expires, refunding the caller. |

Validators on `claude_spawn` amortize their subscription across requests they serve; validators on `anthropic_api` pay-as-they-go and rely on the base fee + escrow reimbursement to make the call profitable.

## Recommendations

- **Constrain the prompt.** Ask for short, deterministic answers (e.g. "Reply with only a number") to maximize semantic-equivalence rates for `redundancy>=3`.
- **Use `redundancy=1`** when the contract is comfortable with a single attestation (cheap path, no PBFT round). Use `redundancy>=3` when the contract needs cross-validator agreement.
- **Set a tight `max_tokens`.** Smaller responses converge faster and cost less.
- **Don't rely on freshness**: model knowledge cutoffs apply; for live data, use `http_get` against a known endpoint instead.

## References

- Spec: `claude/reports/specs/2026-05-24_llm-attestation-provider.md`
- Framework: `claude/reports/specs/2026-05-24_external-attestation-framework.md`
- Provider def: `xchain-hub/src/ProviderRegistry.js` (DEFAULTS.llm)
- Provider module: `xchain-hub/src/providers/llm.js`
- Auth resolver: `xchain-hub/src/lib/hub-credentials.js`
- CLI wrapper: `xchain-hub/src/lib/claude-spawn.js`
