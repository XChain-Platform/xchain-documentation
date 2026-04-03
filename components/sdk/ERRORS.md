<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# XChain Platform SDK — Error Reference

This document covers all error classes thrown by the XChain Platform SDK, their codes, and how to handle them in application code.

---

## Error Hierarchy

All SDK errors extend a common base class:

```
Error
  └── SDKError
        ├── SDKValidationError
        ├── SDKFormatError
        ├── SDKEncoderError
        ├── SDKExplorerError
        ├── SDKHubError
        ├── SDKConfigError
        └── SDKContractError
```

Every error instance carries four properties:

| Property  | Type   | Description |
|-----------|--------|-------------|
| `name`    | string | Class name (e.g. `"SDKValidationError"`) |
| `code`    | string | Machine-readable error code (see below) |
| `message` | string | Human-readable description |
| `details` | object | Extra context (field name, rejected value, etc.) — may be empty `{}` |

---

## Error Classes

| Class | When thrown |
|-------|-------------|
| `SDKValidationError` | Invalid input, missing required fields, bad field values |
| `SDKFormatError` | No format version can represent the provided fields |
| `SDKEncoderError` | Encoder RPC or network errors |
| `SDKExplorerError` | Explorer HTTP or network errors |
| `SDKHubError` | Hub unreachable |
| `SDKConfigError` | Missing required configuration (encoder URL, explorer URL, etc.) |
| `SDKContractError` | Contract-specific errors: code too large, invalid hex, bad contract index, etc. |

---

## Error Codes Reference

### SDKValidationError

Thrown during action validation before any network call is made.

| Code | Details properties | Description |
|------|--------------------|-------------|
| `MISSING_ACTION` | — | No `action` field was provided in the request |
| `UNKNOWN_ACTION` | — | The action name is not a recognized XChain ACTION type |
| `MISSING_REQUIRED_FIELD` | `field` | A field required for this action was not provided |
| `INVALID_FIELD_VALUE` | `field`, `value`, `constraint` | A field value is out of range or the wrong type |
| `INVALID_TICK_NAME` | — | TICK name violates naming rules (length, characters, reserved names) |
| `INVALID_TICK_ID` | — | A `^ID` reference is not a valid numeric index |
| `FORBIDDEN_CHARACTER` | — | A text field contains a `|` or `;` character, which would corrupt the pipe-delimited format |
| `BATCH_CONSTRAINT` | `count` (for MINT/ISSUE violations) | A BATCH protocol rule was violated (nested BATCH, FILE action, more than 1 MINT, more than 1 ISSUE) |
| `BATCH_EMPTY` | — | A batch was built with no actions queued |
| `ENCODING_DATA_TOO_LARGE` | `suggestion` | The serialized action string exceeds 76 bytes and cannot fit in an OP_RETURN output |
| `MISSING_COMPRESSED_PUBKEY` | — | A MULTISIGN encoding was requested without providing a `compressedPubKey` |

### SDKFormatError

Thrown by the format selector when it cannot choose a format version for the action.

| Code | Details properties | Description |
|------|--------------------|-------------|
| `UNKNOWN_ACTION` | `action` | The action name has no registered formats |
| `NO_MATCHING_FORMAT` | `action`, `populatedFields`, `availableFormats` | None of the available format versions can represent all the provided fields. `availableFormats` is an object keyed by version, each entry listing the version's fields and which of the developer's fields did not fit |

### SDKEncoderError

Thrown when communication with the xchain-encoder service fails.

| Code | Description |
|------|-------------|
| `ENCODER_RPC_ERROR` | The encoder returned a JSON-RPC error response |
| `ENCODER_HTTP_{status}` | The encoder returned an unexpected HTTP status code (e.g. `ENCODER_HTTP_500`) |
| `ENCODER_TIMEOUT` | The request to the encoder timed out |
| `ENCODER_NETWORK` | A network-level connection failure (ECONNREFUSED, etc.) |
| `MISSING_DATA` | `createTx` was called without providing the action data payload |
| `MISSING_PUBKEY` | `createTx` was called without providing the sender's public key |
| `MISSING_P2SH_HASH` | `spendP2sh` was called without the P2SH script hash |
| `MISSING_P2SH_HEX` | `spendP2sh` was called without the redeem script hex |

### SDKExplorerError

Thrown when communication with the xchain-explorer service fails.

| Code | Description |
|------|-------------|
| `EXPLORER_HTTP_{status}` | The explorer returned an unexpected HTTP status code (e.g. `EXPLORER_HTTP_404`) |
| `EXPLORER_TIMEOUT` | The request to the explorer timed out |
| `EXPLORER_NETWORK` | A network-level connection failure |
| `INVALID_NETWORK` | The configured network string is not recognized |

### SDKHubError

Thrown when the xchain-hub config oracle cannot be reached.

| Code | Description |
|------|-------------|
| `HUB_UNAVAILABLE` | The hub did not respond or returned an error |

### SDKConfigError

Thrown at call time when a required service URL has not been configured.

| Code | Description |
|------|-------------|
| `EXPLORER_NOT_CONFIGURED` | An explorer operation was attempted but no explorer URL is set |
| `ENCODER_NOT_CONFIGURED` | An encoder operation was attempted but no encoder URL is set |
| `HUB_NOT_CONFIGURED` | A hub operation was attempted but no hub URL is set |

### SDKContractError

Thrown for contract-specific issues during DEPLOY, EXECUTE, DEPOSIT, or WITHDRAW operations.

| Code | Details properties | Description |
|------|--------------------|-------------|
| `CODE_TOO_LARGE` | `bytes`, `limit` | Contract source exceeds the 64KB size limit |
| `CODE_SYNTAX_ERROR` | — | acorn parse failure during pre-validation |
| `CODE_ENCODING_FAILED` | — | Hex encoding or decoding failure |
| `INVALID_CONTRACT_INDEX` | — | CONTRACT_ACTION_INDEX is not a positive integer |
| `INVALID_METHOD_NAME` | — | METHOD is empty or contains forbidden characters |
| `INVALID_PARAM_VALUE` | `field`, `index`, `value` | A parameter contains pipe or semicolon characters |
| `CONTRACT_NOT_FOUND` | — | Explorer lookup returned no contract for the given index |
| `CONTRACT_DISABLED` | — | Contract is disabled (for execute/deposit operations) |

---

## Catching Errors

Import the error classes you need and use `instanceof` checks in your catch block. Check `error.code` for fine-grained handling and `error.details` for additional context.

```js
const {
    SDKValidationError,
    SDKFormatError,
    SDKEncoderError,
    SDKConfigError,
    SDKContractError
} = require('@xchain/sdk/src/errors');

try {
    let result = await sdk.createAction({
        action: 'SEND',
        params: { tick: 'DOGE.TOKEN', amount: 100, destination: 'abc123' }
    });
    console.log(result.actionString);

} catch (err) {

    if (err instanceof SDKValidationError) {
        // Input was rejected before any network call
        console.error('Validation failed:', err.code, err.message);

        if (err.code === 'MISSING_REQUIRED_FIELD') {
            console.error('Missing field:', err.details.field);
        }
        if (err.code === 'INVALID_FIELD_VALUE') {
            console.error('Bad value for', err.details.field, ':', err.details.value);
            console.error('Constraint:', err.details.constraint);
        }
        if (err.code === 'BATCH_CONSTRAINT') {
            console.error('BATCH rule violated:', err.message);
        }

    } else if (err instanceof SDKFormatError) {
        // No format version fits the provided fields
        console.error('Format selection failed:', err.code);

        if (err.code === 'NO_MATCHING_FORMAT') {
            console.error('Provided fields:', err.details.populatedFields);
            console.error('Available formats:', JSON.stringify(err.details.availableFormats, null, 2));
        }

    } else if (err instanceof SDKEncoderError) {
        // Encoder RPC or network problem
        console.error('Encoder error:', err.code, err.message);

    } else if (err instanceof SDKConfigError) {
        // Service URL not configured
        console.error('Configuration error:', err.code);

    } else if (err instanceof SDKContractError) {
        // Contract-specific error (code too large, bad hex, etc.)
        console.error('Contract error:', err.code, err.message);

    } else {
        // Unexpected error — rethrow
        throw err;
    }
}
```

---

## Validation Dry-Run

Use `sdk.validateAction()` to check an action's fields before constructing a transaction. This runs the full validation and format-selection pipeline but does not call the encoder. It is useful for pre-flight checks in forms or CLI wizards.

```js
try {
    sdk.validateAction({
        action: 'ISSUE',
        params: {
            tick: 'MY.TOKEN',
            maxSupply: 21000000,
            decimals: 8
        }
    });
    console.log('Action is valid — ready to submit');

} catch (err) {
    if (err instanceof SDKValidationError || err instanceof SDKFormatError) {
        console.error('Will not encode:', err.message);
    }
}
```

`validateAction()` throws the same `SDKValidationError` and `SDKFormatError` instances that `createAction()` would throw, so the same catch logic applies.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../../LICENSE.md) and [NOTICE](../../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
