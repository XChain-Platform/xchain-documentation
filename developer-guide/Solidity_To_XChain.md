# Solidity to XChain

**Audience:** developers who know Solidity/EVM and want to write XChain contracts.

You already know 80% of this. An XChain contract is a deterministic JavaScript
program that custodies tokens and emits validated protocol actions. The hard part
is not new syntax; it is three model shifts (below). Learn those and the rest is
translation.

XChain does not run EVM bytecode, and that is deliberate: the two execution models
are incompatible (account vs UTXO, `msg.value` vs deposits, synchronous returns vs
deferred emissions), and a leaky "EVM compatibility" layer would break money code
subtly. Instead, contracts are plain JavaScript, so your editor, type checker, test
runner, and LLM codegen all work on them natively.

## The three shifts that matter

1. **Contracts orchestrate; they do not mutate the ledger.** In Solidity you write
   `balances[x] += n`. On XChain you cannot touch a balance. You `emit.send(...)`
   and the protocol's audited handler moves the tokens. A contract can only emit
   the same ACTIONs a user could.
2. **There is no `msg.value`.** Value does not ride a call. Tokens enter a contract
   through a separate `DEPOSIT` action to the contract's address; logic runs through
   `EXECUTE`. To make funding atomic, the caller submits both in one transaction
   with `BATCH`. Your contract trusts its **own balance** (`getBalance`), never a
   caller-supplied amount.
3. **Emissions are deferred (snapshot semantics).** Emitted actions apply only after
   your method returns. A contract cannot observe the effects of its own emissions
   mid-call, and `getBalance` / `getTokenInfo` reflect state at the start of
   execution. One happy consequence: classic reentrancy is largely a non-issue.

## Reach for native primitives before writing a contract

The biggest mistake an EVM dev makes on XChain is writing a contract for something
that is already a first-class protocol action:

| You want | Solidity reflex | XChain native (no contract) |
|---|---|---|
| A fungible token | write an ERC-20 contract | `ISSUE` action (token is first-class) |
| Transfer a token | `transfer()` on your ERC-20 | `SEND` action |
| Check a balance | `balanceOf()` | explorer/SDK balance query; in-contract `getBalance(addr, tick)` |
| An NFT | write an ERC-721 | `ISSUE` with `DECIMALS=0` + `LOCK_MAX_SUPPLY=1` |
| Token sale | write a crowdsale | `DISPENSER` action, or the `crowdsale` template |
| Swap two tokens | write a DEX pair | `ORDER` / `SWAP` actions, or the `amm` template |
| Pay dividends | loop transfers | `DIVIDEND` action |
| Airdrop | loop transfers | `AIRDROP` action over a `LIST` |
| Enforced royalties / transfer rules | ERC-20 hooks / ERC-2981 | **controller-bound token** (`ISSUE` v6 binding a guard contract) |

Write a contract when you need custom logic, custody, or composition that the actions
do not express directly (escrow, vesting, an AMM with bespoke rules, a policy guard).

## Contract shape

A contract is a module of methods. Each method receives the `xchain` gateway.
`initialize` runs once at deploy (your constructor). Parameters arrive as strings
via `getInputParam(i)`.

```javascript
// SPDX-License-Identifier: MIT
/** @param {import('xchain-vm/src/gateway').XChainGateway} xchain */
module.exports = {
    initialize: function (xchain) {            // constructor
        var owner = xchain.getInputParam(0);   // params are strings
        xchain.require(owner, 'owner required');
        xchain.state.set('owner', owner);
    },
    ping: function (xchain) {                   // a public method
        xchain.require(xchain.getSourceAddress() === xchain.state.get('owner'), 'not owner');
        xchain.state.set('pinged', String(xchain.getBlockHeight()));
    }
};
```

The `@param` JSDoc line is optional but recommended: it points your editor at the
typed gateway definitions (`xchain-vm/src/gateway.d.ts`), giving autocomplete,
type-checking, and inline docs for the entire `xchain` API while you author, with no
build step and nothing to install (contracts stay single-file and import-free).

## Concept map

| Solidity | XChain | Notes |
|---|---|---|
| `constructor` | `initialize(xchain)` | runs once at deploy |
| `function f() public` | `f: function (xchain) { ... }` | invoked by name via `EXECUTE` |
| function arguments | `xchain.getInputParam(i)`, `getInputParamCount()` | all params are strings |
| `msg.sender` | `xchain.getSourceAddress()` | the calling address |
| `address(this)` | `xchain.getContractAddress()` | contract address `C:CHAIN:index` |
| `msg.value` | (none) | use `DEPOSIT` + `BATCH`; read `getBalance(getContractAddress(), tick)` |
| `block.number` | `xchain.getBlockHeight()` | |
| `block.timestamp` | `xchain.getBlockTimestamp()` | |
| `blockhash(n)` | `xchain.getBlockHash()` | current block |
| storage variable | `xchain.state.set/get/has/delete` | flat k/v; values are strings (JSON for structs) |
| `mapping(k => v)` | key convention, e.g. `state.set('bal:' + addr, amt)` | no native map type; compose keys |
| `struct` | JSON string in one key | `state.set('cfg', JSON.stringify(obj))` |
| `require(c, "m")` | `xchain.require(c, 'm')` | reverts the whole execution + emissions |
| `revert("m")` | `xchain.revert('m')` | |
| `emit Event(...)` | `xchain.emit.broadcast(...)` | or rely on the indexer action log + explorer |
| `uint` math / SafeMath | `xchain.math.add/subtract/multiply/divide/compare/gt/gte/lt/lte/eq/...` | bignumber, no overflow, **floats are rejected at deploy** |
| `transfer` / `send` value | `xchain.emit.send({ ... })` | emits a SEND; applied after return |
| external call (returns a value) | `xchain.emit.execute({ contractIndex, method, params, gasLimit })` | **async, no return value**; respond via a callback method |
| cross-chain call | `xchain.emit.crossExecute({ targetChain, contractIndex, method, params, callbackMethod, callbackParams, deadlineBlocks })` | bridgeless; target must export `crossCallable` |
| `modifier onlyOwner` | a guard helper from `patterns/` | check `getSourceAddress()` against stored owner |
| `Ownable` / `AccessControl` | `patterns/` access control | OZ-equivalent, audited |
| `Pausable` | `patterns/` pausable (or token-level `SLEEP`) | |
| `ReentrancyGuard` | usually unnecessary | snapshot semantics; still keep state-before-emit discipline |
| `view` / `pure` | a method that only reads | just do not write state or emit |
| oracle price feed (Chainlink) | `xchain.oracle.getPrice(coinPair)` | validator-attested, built in |
| external data / API | `xchain.attestation.request(providerId, payload, callbackMethod, callbackParams, opts)` | PBFT-certified; `http_get` and `llm` providers |
| `payable receive()` | (none) | `DEPOSIT` |
| `selfdestruct` / `delegatecall` | (none) | not in the model |
| gas limit | `GAS_LIMIT` on deploy/execute; `sdk.suggestGasLimit(...)` | metered per the gas schedule |

The `patterns/` column maps to the pattern library in `xchain-contracts/patterns/`,
which ships an [OpenZeppelin alias table](../../xchain-contracts/patterns/README.md#coming-from-openzeppelin)
so you can find each building block by the OZ name you already know.

## Worked example 1: an ERC-20 is not a contract

Solidity:

```solidity
contract MyToken is ERC20 {
    constructor() ERC20("MyToken", "MTK") { _mint(msg.sender, 1000000e18); }
}
```

XChain: do not write a contract. Issue the token.

```javascript
// via the SDK; the token is a first-class protocol object
await sdk.issue({ TICK: 'MTK', MAX_SUPPLY: '1000000', DECIMALS: '8' }, encoder);
// holders transfer with SEND; balances are queryable directly. No contract, no gas-per-transfer logic.
```

Need a transfer hook (allowlist, royalty, freeze)? That is a **controller-bound
token**: deploy a guard contract and bind it at issue time, so the rule is enforced
by the protocol on every transfer and cannot be bypassed by any marketplace.

```javascript
// guard contract: the indexer calls guard(...) before a guarded action settles
module.exports = {
    guard: function (xchain) {
        var actionType = xchain.getInputParam(0);   // e.g. 'transfer'
        var to         = xchain.getInputParam(2);
        // deny transfers to a blocked address
        if (xchain.state.get('blocked:' + to) === '1') xchain.revert('recipient blocked');
        // (optional) return a royalty split via payoutLegs for 'trade'
    }
};
// bound with ISSUE v6: CONTROLLER = <guard contract index>, ACTION_CLASS = 'transfer' (or 'all')
```

## Worked example 2: Ownable counter, side by side

Solidity:

```solidity
contract Counter {
    address owner; uint256 count;
    constructor() { owner = msg.sender; }
    function inc() external { require(msg.sender == owner, "not owner"); count += 1; }
}
```

XChain:

```javascript
module.exports = {
    initialize: function (xchain) {
        xchain.state.set('owner', xchain.getSourceAddress());
        xchain.state.set('count', '0');
    },
    inc: function (xchain) {
        xchain.require(xchain.getSourceAddress() === xchain.state.get('owner'), 'not owner');
        xchain.state.set('count', xchain.math.add(xchain.state.get('count'), '1'));
    }
};
```

## Worked example 3: taking a deposit (the `msg.value` shift)

Solidity:

```solidity
function deposit() external payable { balances[msg.sender] += msg.value; }
```

XChain: there is no `payable`. The caller funds the contract with a `DEPOSIT` and
triggers logic with `EXECUTE`, atomically via `BATCH`. The contract reads its own
balance as the source of truth.

```javascript
// caller submits, in ONE transaction:
//   BATCH( DEPOSIT(thisContract, 'MTK', '100'), EXECUTE(thisContract, 'onDeposit', []) )
module.exports = {
    onDeposit: function (xchain) {
        var tick = 'MTK';
        var held = xchain.getBalance(xchain.getContractAddress(), tick) || '0';
        xchain.require(xchain.math.gt(held, '0'), 'no funds received');
        // credit the depositor in contract state (the LEDGER move already happened via DEPOSIT)
        var key = 'bal:' + xchain.getSourceAddress();
        xchain.state.set(key, xchain.math.add(xchain.state.get(key) || '0', held));
    }
};
```

Note the pattern from the audited `escrow` template: settlement sends the contract's
**entire** balance of the tick to the payee, which avoids stranded dust and
"overfund then under-pay" gaps. Only ever deposit the configured tick; other ticks
sent to a single-tick contract are not recoverable by that template.

## Gotchas an EVM dev will hit

- **Floats are rejected at deploy.** No `1.5`, no `Math.pow`/`sqrt`/`log` (stripped
  for cross-CPU determinism). Use `xchain.math.*` for all arithmetic. The linter
  (`sdk.validateContract` / `npx xchain-contracts lint`) catches this before you spend
  a transaction.
- **Everything is a string.** Params and state values are strings; convert with
  `parseInt` for small counters, use `xchain.math` for token amounts (never native
  float math on amounts).
- **No return values from calls.** `emit.execute` does not return; if you need a
  result back, the callee calls you back via its own `emit.execute` (the callback
  pattern). Cross-chain `emit.crossExecute` takes an explicit `callbackMethod`.
- **You cannot see your own emissions.** Compute everything from start-of-call state;
  do not `emit.send` then expect `getBalance` to reflect it in the same method.
- **Banned globals.** `Date`, `setTimeout`, `fetch`, `eval`, `Function`, `Proxy`,
  `Reflect`, `RegExp` constructor, and prototype `.constructor` are stripped. Use the
  `xchain` context accessors for time and determinism.
- **Tooling you already know works.** It is JavaScript/TypeScript: your editor, type
  checker, test runner, and LLM codegen all apply. Scaffold with
  `npx xchain-contracts scaffold`, lint with `npx xchain-contracts lint`, and reuse
  `patterns/` for access control, pausing, and safe transfers.

## Where to go next

- Full contract authoring guide: [Smart_Contract_Development.md](./Smart_Contract_Development.md).
- Templates: 13 audited, forkable contracts in `xchain-contracts/`. The custody and finance set is `escrow`, `escrowDelivery`, `vesting`, `crowdsale`, `amm`, `stableVault`, `treasury`; the auction set is `englishAuction` and `dutchAuction`; the oracle-consuming set is `priceBet`, `priceBetTimed`, and `urlOracle`; plus `cardDispenser` for randomized inventory draws.
- Building blocks + OpenZeppelin aliases: `xchain-contracts/patterns/`.
- Typed gateway (editor autocomplete): `xchain-vm/src/gateway.d.ts`.
- The full gateway API and gas schedule: the developer guide on docs.xchain.io.
