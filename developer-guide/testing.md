<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright © 2025–2026 Dankest, LLC -->

# Testing

## Philosophy

Software that handles financial assets (token balances, DEX orders, cross-chain swaps) has no room for "it works on my machine." A single uncaught edge case in the indexer's ledger logic could silently misattribute tokens. A missed validation in the explorer's SQL could expose data it shouldn't. A race condition in the decoder's reorg handling could corrupt an entire chain's state.

The XChain Platform treats testing as a first-class engineering requirement, not an afterthought. Every component that processes, stores, or serves token data maintains a comprehensive test suite spanning multiple testing disciplines. We believe that thorough testing before release is not just a good idea; it is a necessity for any system that people trust with real value.

Our testing strategy is built on a simple principle: **different types of bugs require different types of tests to find them.** Unit tests catch logic errors. Integration tests catch interface mismatches. Fuzz tests catch assumptions you didn't know you made. Chaos tests catch failures you assumed wouldn't happen. No single testing technique is sufficient on its own, together, they form a defense-in-depth strategy that gives us confidence in every release.

## Test Types

The XChain Platform employs 11 distinct testing disciplines across its components. Each serves a specific purpose and catches a category of bugs that the others cannot.

### Unit Tests

Unit tests verify individual functions, methods, and classes in complete isolation. Dependencies are mocked or stubbed so that each test exercises exactly one unit of logic. Unit tests are fast (typically milliseconds per test), deterministic, and require no external services.

**What they catch:** Logic errors in calculations, incorrect branching, off-by-one errors, wrong return values, missing null checks.

**Example:** Testing that the indexer's `sanitizeInt()` returns `null` for non-numeric input, or that the explorer's `escapeLike()` properly escapes SQL wildcard characters.

### Integration Tests

Integration tests verify that multiple components work correctly together through real interfaces. In the XChain Platform, this typically means testing API endpoints against a real MariaDB database seeded with known data. Integration tests confirm that SQL queries return correct results, that request routing maps to the right handlers, and that response formats match expectations.

**What they catch:** SQL errors, schema mismatches, incorrect JOIN logic, pagination bugs, response format regressions, database connection handling issues.

**Example:** Seeding a test database with known sends, then verifying that `GET /BTC/api/sends/address123/address` returns the correct records with proper pagination.

### End-to-End (E2E) Tests

E2E tests exercise the full system from input to output, verifying that data flows correctly through the entire pipeline. For the XChain Platform, this means testing the path from a decoded transaction in the decoder database, through indexer processing, to the explorer API response. E2E tests run against a live (regtest) stack and validate cross-service correctness.

**What they catch:** Pipeline breaks, data transformation errors between services, missing or incorrect cross-service contracts, deployment configuration issues.

**Example:** Creating a token via the encoder, mining a block, waiting for the decoder and indexer to process it, then querying the explorer to verify the token appears with correct metadata.

### Smoke Tests

Smoke tests are fast, lightweight checks that verify a service is fundamentally operational; it starts, connects to its dependencies, and responds to basic requests. Smoke tests run in seconds and are designed for use in CI pipelines, deployment verification, and health monitoring.

**What they catch:** Broken imports, missing dependencies, configuration errors, services that crash on startup, basic connectivity failures.

**Example:** Verifying the explorer starts without errors, connects to the database, and returns a 200 status on the health endpoint.

### Boundary Tests

Boundary tests target the exact edges of valid input ranges: maximum and minimum values, length limits, precision thresholds, and off-by-one conditions. They test the specific points where behavior should change: the last valid input, the first invalid input, and the values immediately adjacent to every limit.

**What they catch:** Off-by-one errors in length checks, integer overflow, precision loss in BigNumber arithmetic, incorrect greater-than vs greater-than-or-equal comparisons, edge cases at maximum supply or minimum amounts.

**Example:** Testing that a token ticker of exactly 250 characters is accepted while 251 is rejected, or that `sanitizeInt()` handles `Number.MAX_SAFE_INTEGER` and `-1` correctly.

### Fuzz Tests

Fuzz tests (property-based tests) generate large volumes of random, semi-random, and adversarial inputs to find bugs that hand-written tests miss. Rather than testing specific cases, fuzz tests define invariants (properties that must always hold) and then try thousands of inputs to find violations.

**What they catch:** Crashes on unexpected input types, unicode handling errors, prototype pollution, assumptions about input format, mathematical properties that break at extreme values.

**Example:** Generating 10,000 random strings and verifying that `escapeLike()` never produces output that could alter SQL semantics, or that BigNumber addition is always commutative regardless of the input values.

### Security Tests

Security tests specifically target common vulnerability classes: SQL injection, cross-site scripting (XSS), server-side request forgery (SSRF), path traversal, information leakage, and input validation bypasses. These tests attempt to exploit the application using known attack patterns and verify that defenses hold.

**What they catch:** SQL injection through unsanitized input, SSRF via the relay endpoint, directory traversal in file serving, sensitive information in error messages, missing rate limiting, header injection.

**Example:** Sending `'; DROP TABLE sends; --` as an address parameter and verifying the query is safely parameterized, or attempting to access `/../../../etc/passwd` through the icon endpoint.

### Performance and Load Tests

Performance tests establish baseline response times and throughput, then verify the system meets its performance targets under increasing load. Load tests simulate concurrent users and sustained traffic to find bottlenecks, connection pool exhaustion, memory leaks, and degradation patterns.

**What they catch:** Slow queries, connection pool exhaustion under concurrency, memory leaks over sustained load, response time regressions, throughput bottlenecks.

**Example:** Measuring baseline response time for the `getBalances` endpoint, then ramping to 100 concurrent requests to verify response times stay under the target threshold and the connection pool recovers.

### Chaos Engineering Tests

Chaos tests intentionally inject failures into the system: database disconnections, network latency, resource exhaustion, dependency outages; and verify that the service degrades gracefully rather than crashing or corrupting data. Chaos tests use tools like Toxiproxy to simulate realistic infrastructure failures.

**What they catch:** Ungraceful failure modes, missing error handling, connection pool behavior under failure, cascade failures, data corruption during partial outages, recovery behavior after failures resolve.

**Example:** Severing the database connection mid-query and verifying the explorer returns a proper error response (not a stack trace), reconnects automatically when the database recovers, and serves correct data after recovery.

### Mutation Tests

Mutation tests evaluate the quality of the existing test suite by making small, systematic changes (mutations) to the source code (flipping operators, changing constants, removing conditions) and checking whether the test suite detects each change. A mutation that passes all tests is a "survived mutant," indicating a gap in test coverage.

**What they catch:** Weak assertions that pass regardless of behavior, missing test cases for specific code paths, tests that verify structure but not semantics, coverage gaps where code is executed but not meaningfully verified.

**Example:** Changing `>=` to `>` in a balance check and verifying that at least one test fails, or replacing a `+` with `-` in a fee calculation and confirming the test suite catches it.

### Regression Tests

Regression tests are a curated subset of tests across all disciplines, organized into priority tiers for fast verification. They protect against re-introducing bugs that have been fixed and ensure that critical paths remain functional after every change. Regression suites are designed to run quickly enough for every commit or PR.

**What they catch:** Re-introduced bugs, broken critical paths after refactoring, unintended side effects of changes, regressions in core functionality.

**Tier structure:**
- **P0 (Critical path)**: Core logic and security baselines. Runs in seconds. Every commit.
- **P1 (High priority)**: API contracts, market data, secondary features. Runs in under 2 minutes. Every PR.
- **P2 (Medium priority)**: Cross-endpoint consistency, edge cases. Runs in under 10 minutes. Nightly.

## Platform Test Coverage

The XChain Platform maintains roughly **33,000 tests** across its fifteen test-bearing repositories, with the dedicated `xchain-e2e-test` service providing both full-stack integration testing across all services and comprehensive self-validation of its own test infrastructure.

### By Component

Counts below were measured on 2026-07-27 by enumerating every test each repository's suite tree defines. They are re-measured periodically; treat them as a snapshot, not a contract.

| Component | Total Tests | Test Types |
|---|---|---|
| [xchain-indexer](../components/indexer/) | 5,571 | Unit, Integration, E2E, Fuzz, Chaos, Mutation, Smoke, Performance, Boundary, Regression |
| [xchain-wallet](../components/wallet/) | 4,825 | Unit, Smoke, Integration, Boundary, Chaos, Fuzz, Regression, Security, Accessibility |
| [xchain-hub](../components/hub/) | 3,638 | Unit, Integration, E2E, Boundary, Fuzz, Chaos, Smoke, Security, Performance, Regression |
| [xchain-sdk](../components/sdk/) | 3,219 | Unit, Integration, Boundary, Fuzz, Chaos, Security, Smoke, Performance, Regression |
| [xchain-explorer](../components/explorer/) | 2,839 | Unit, Integration, E2E, Boundary, Security, Chaos, Mutation, Smoke, Performance, Regression, Conformance |
| [xchain-vm](../components/vm/) | 2,028 | Unit, E2E, Security, Boundary, Fuzz, Chaos, Mutation, Smoke, Determinism, Regression |
| [xchain-node](../components/node/) | 1,922 | Unit, Integration, E2E, Boundary, Fuzz, Chaos, Smoke, Security, Regression, Benchmarks |
| [xchain-sync](../components/sync/) | 1,756 | Unit, Integration, E2E, Boundary, Fuzz, Chaos, Mutation, Security, Smoke, Performance, Regression |
| [xchain-e2e-test](../components/e2e-test/) | 1,700+ | Unit, Integration, E2E, Smoke, Boundary, Fuzz, Chaos, Regression, Mutation, Performance, Actions |
| [xchain-encoder](../components/encoder/) | 1,342 | Unit, Integration, E2E, Boundary, Chaos, Mutation, Smoke, Performance, Security, Regression, Conformance |
| [xchain-decoder](../components/decoder/) | 1,333 | Unit, Integration, E2E, Fuzz, Chaos, Security, Smoke, Benchmarks, Mutation, Regression |
| [xchain-utxo-tracker](../components/utxo-tracker/) | 1,015 | Unit, Integration, E2E, Boundary, Fuzz, Chaos, Mutation, Security, Smoke, Performance, Regression |
| [xchain-regtest-miner](../components/regtest-miner/) | 1,007 | Unit, Integration, E2E, Boundary, Fuzz, Chaos, Mutation, Security, Smoke, Performance, Regression |
| xchain-dashboard | 547 | Unit, Integration, Security, Monitor, CI-status |
| [xchain-contracts](../components/contracts/) | 269 | Template execution under the real VM, pattern lint-gate, policy generator, dependency advisories |

The `xchain-e2e-test` total is given as a floor rather than an exact figure: its suites read chain and service configuration at load time, so the tree cannot be enumerated without a live regtest stack. 1,700+ counts the test declarations in the source.

### By Test Type

Per-discipline counts for the five component libraries whose suite trees enumerate offline. Blank means the component has no suite of that type.

| Test Type | Indexer | Explorer | Encoder | SDK | Sync |
|---|---|---|---|---|---|
| Unit | 4,977 | 1,977 | 472 | 2,942 | 1,372 |
| Integration | 213 | 158 | 112 | 103 | 85 |
| E2E | 43 | 49 | 164 | None | 64 |
| Smoke | 21 | 38 | 52 | 11 | 17 |
| Boundary | in unit | 226 | 100 | 36 | 7 |
| Fuzz | 122 | 10 | 6 | 65 | 55 |
| Security | in unit | 141 | 46 | 18 | 135 |
| Performance | 26 | 33 | None | 3 | None |
| Chaos | 44 | 54 | 62 | 28 | 38 |
| Mutation | 125 | StrykerJS | StrykerJS | None | StrykerJS |
| Regression | tagged | 148 | 263 | 13 | 4 |
| Conformance | None | 5 | 60 | None | None |

The indexer keeps its boundary and security suites inside `test/unit/`, and selects its regression tier by `@regression` tag across the whole tree rather than by directory, so those cells do not resolve to a directory count.

### Testing Infrastructure

All XChain Platform tests use the following infrastructure:

| Tool | Purpose |
|---|---|
| **Mocha** | Test runner for every component except the wallet |
| **Vitest** | Test runner for the wallet, whose suites need a DOM environment |
| **Playwright** | Browser-driven end-to-end tests (wallet) |
| **Sinon** | Mocks, stubs, and spies for isolation |
| **Chai** | Assertion library (explorer, hub, SDK, sync, node, utxo-tracker, e2e-test) |
| **Supertest** | HTTP endpoint testing (explorer, utxo-tracker) |
| **Nock** | HTTP request mocking (SDK, hub) |
| **proxyquire** | Dependency injection at require time (explorer, hub, node, sync) |
| **fast-check** | Property-based / fuzz testing (indexer, VM, hub, sync, utxo-tracker, regtest-miner, wallet, e2e-test) |
| **StrykerJS** | Mutation testing framework (decoder, encoder, explorer, hub, node, sync, utxo-tracker, VM, regtest-miner, e2e-test) |
| **Toxiproxy** | Network fault injection for chaos tests (explorer) |
| **Docker Compose** | Test environment orchestration (integration, chaos, E2E) |

All suites require **Node 22 exactly**. Node 18 fails outright; Node 24 cannot build the `isolated-vm` native module, and on some suites an unsupported Node silently skips tests rather than failing, which reads as a false green.

### Running Tests

Each component provides granular npm scripts for running specific test types. See the component README for the full list:

- [Indexer test scripts](../components/indexer/README.md)
- [Explorer test scripts](../components/explorer/README.md)
- [Encoder test scripts](../components/encoder/README.md)
- [Decoder test scripts](../components/decoder/README.md)
- [VM test scripts](../components/vm/README.md)
- [SDK test scripts](../components/sdk/README.md)
- [Hub test scripts](../components/hub/README.md)
- [Sync test scripts](../components/sync/README.md)
- [Wallet test scripts](../components/wallet/testing.md)
- [Node test scripts](../components/node/README.md)
- [UTXO tracker test scripts](../components/utxo-tracker/README.md)
- [E2E Test Suite scripts](../components/e2e-test/README.md)

Common patterns across all components:

```bash
# Run all tests
npm test

# Run a specific test type
npm run test:integration
npm run test:security
npm run test:chaos

# Run fast regression checks (suitable for CI)
npm run test:regression        # Full regression suite
npm run test:regression:p0     # Critical path only (<1s)
npm run test:smoke             # Basic operational health
```

## Contributing Tests

When contributing to the XChain Platform, new features and bug fixes should include appropriate tests:

- **New feature**: Unit tests for the new logic, plus integration tests if it touches the database or API surface.
- **Bug fix**: A regression test that reproduces the bug and verifies the fix. This test should fail without the fix and pass with it.
- **Security fix**: A security test that attempts the exploit and verifies it is blocked.
- **Performance change**: Update or add performance baselines to reflect the new expected behavior.

Tests should be deterministic, isolated, and fast. Avoid sleeps, network calls to external services, and dependencies on test execution order.

---

**Copyright &copy; 2025–2026 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **GNU Affero General Public License v3.0** (AGPL-3.0-or-later)
with a commercial license available for proprietary use.

You may use, modify, and distribute this material under the terms of the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
See the [licensing overview](https://docs.xchain.io/legal/LICENSING.html).
