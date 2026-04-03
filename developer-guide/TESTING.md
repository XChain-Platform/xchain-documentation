<!-- SPDX-License-Identifier: LicenseRef-Dankest-Community -->
<!-- Copyright © 2025 Dankest, LLC -->

# Testing

## Philosophy

Software that handles financial assets — token balances, DEX orders, cross-chain swaps — has no room for "it works on my machine." A single uncaught edge case in the indexer's ledger logic could silently misattribute tokens. A missed validation in the explorer's SQL could expose data it shouldn't. A race condition in the decoder's reorg handling could corrupt an entire chain's state.

The XChain Platform treats testing as a first-class engineering requirement, not an afterthought. Every component that processes, stores, or serves token data maintains a comprehensive test suite spanning multiple testing disciplines. We believe that thorough testing before release is not just a good idea — it is a necessity for any system that people trust with real value.

Our testing strategy is built on a simple principle: **different types of bugs require different types of tests to find them.** Unit tests catch logic errors. Integration tests catch interface mismatches. Fuzz tests catch assumptions you didn't know you made. Chaos tests catch failures you assumed wouldn't happen. No single testing technique is sufficient on its own — together, they form a defense-in-depth strategy that gives us confidence in every release.

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

Smoke tests are fast, lightweight checks that verify a service is fundamentally operational — it starts, connects to its dependencies, and responds to basic requests. Smoke tests run in seconds and are designed for use in CI pipelines, deployment verification, and health monitoring.

**What they catch:** Broken imports, missing dependencies, configuration errors, services that crash on startup, basic connectivity failures.

**Example:** Verifying the explorer starts without errors, connects to the database, and returns a 200 status on the health endpoint.

### Boundary Tests

Boundary tests target the exact edges of valid input ranges — maximum and minimum values, length limits, precision thresholds, and off-by-one conditions. They test the specific points where behavior should change: the last valid input, the first invalid input, and the values immediately adjacent to every limit.

**What they catch:** Off-by-one errors in length checks, integer overflow, precision loss in BigNumber arithmetic, incorrect greater-than vs greater-than-or-equal comparisons, edge cases at maximum supply or minimum amounts.

**Example:** Testing that a token ticker of exactly 250 characters is accepted while 251 is rejected, or that `sanitizeInt()` handles `Number.MAX_SAFE_INTEGER` and `-1` correctly.

### Fuzz Tests

Fuzz tests (property-based tests) generate large volumes of random, semi-random, and adversarial inputs to find bugs that hand-written tests miss. Rather than testing specific cases, fuzz tests define invariants — properties that must always hold — and then try thousands of inputs to find violations.

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

Chaos tests intentionally inject failures into the system — database disconnections, network latency, resource exhaustion, dependency outages — and verify that the service degrades gracefully rather than crashing or corrupting data. Chaos tests use tools like Toxiproxy to simulate realistic infrastructure failures.

**What they catch:** Ungraceful failure modes, missing error handling, connection pool behavior under failure, cascade failures, data corruption during partial outages, recovery behavior after failures resolve.

**Example:** Severing the database connection mid-query and verifying the explorer returns a proper error response (not a stack trace), reconnects automatically when the database recovers, and serves correct data after recovery.

### Mutation Tests

Mutation tests evaluate the quality of the existing test suite by making small, systematic changes (mutations) to the source code — flipping operators, changing constants, removing conditions — and checking whether the test suite detects each change. A mutation that passes all tests is a "survived mutant," indicating a gap in test coverage.

**What they catch:** Weak assertions that pass regardless of behavior, missing test cases for specific code paths, tests that verify structure but not semantics, coverage gaps where code is executed but not meaningfully verified.

**Example:** Changing `>=` to `>` in a balance check and verifying that at least one test fails, or replacing a `+` with `-` in a fee calculation and confirming the test suite catches it.

### Regression Tests

Regression tests are a curated subset of tests across all disciplines, organized into priority tiers for fast verification. They protect against re-introducing bugs that have been fixed and ensure that critical paths remain functional after every change. Regression suites are designed to run quickly enough for every commit or PR.

**What they catch:** Re-introduced bugs, broken critical paths after refactoring, unintended side effects of changes, regressions in core functionality.

**Tier structure:**
- **P0 (Critical path)** — Core logic and security baselines. Runs in seconds. Every commit.
- **P1 (High priority)** — API contracts, market data, secondary features. Runs in under 2 minutes. Every PR.
- **P2 (Medium priority)** — Cross-endpoint consistency, edge cases. Runs in under 10 minutes. Nightly.

## Platform Test Coverage

The XChain Platform maintains over **4,700 tests** across its five primary components, with the dedicated `xchain-e2e-test` service providing full-stack integration testing across all services.

### By Component

| Component | Total Tests | Test Types |
|---|---|---|
| [xchain-indexer](../components/indexer/) | ~958 | Unit, Integration, E2E, Fuzz, Chaos, Mutation, Smoke, Performance, Boundary, Regression |
| [xchain-explorer](../components/explorer/) | ~1,285 | Unit, Integration, E2E, Boundary, Security, Chaos, Mutation, Smoke, Performance, Regression |
| [xchain-encoder](../components/encoder/) | ~769 | Unit, Integration, E2E, Boundary, Chaos, Mutation, Smoke, Performance, Regression |
| [xchain-vm](../components/vm/) | 974 | Unit, E2E, Security, Boundary, Fuzz, Chaos, Mutation, Smoke, Regression |
| [xchain-sdk](../components/sdk/) | 551 | Unit, Boundary, Fuzz, Chaos, Round-trip, Smoke |
| [xchain-e2e-test](../components/e2e-test/) | — | Full-stack E2E across all services on regtest |

### By Test Type

| Test Type | Indexer | Explorer | Encoder | VM | SDK |
|---|---|---|---|---|---|
| Unit | ~530 | ~583 | 114 | 580 | ~391 |
| Integration | ~929 | ~83 | 108 | — | — |
| E2E | 43 | 49 | ~80 | 64 | — |
| Smoke | ~10 | ~40 | ~10 | 10 | 11 |
| Boundary | ~100 | ~211 | ~120 | 106 | 36 |
| Fuzz | ~50 | — | — | 86 | 56 |
| Security | ~60 | ~104 | — | 72 | — |
| Performance | 5 suites | 15 | 3 suites | 5 scenarios | — |
| Chaos | ~30 | ~56 | 61 | 92 | 28 |
| Mutation | ~30 | StrykerJS | StrykerJS | StrykerJS + custom | — |
| Regression | ~18 | 144 | 196 | 152 | — |
| Round-trip | — | — | — | — | 29 |

### Testing Infrastructure

All XChain Platform tests use the following infrastructure:

| Tool | Purpose |
|---|---|
| **Mocha** | Test runner across all components |
| **Sinon** | Mocks, stubs, and spies for isolation |
| **Chai** | Assertion library (explorer, SDK) |
| **Supertest** | HTTP endpoint testing (explorer) |
| **Nock** | HTTP request mocking (SDK, explorer) |
| **fast-check** | Property-based / fuzz testing (indexer, VM) |
| **StrykerJS** | Mutation testing framework (explorer, encoder, VM) |
| **Toxiproxy** | Network fault injection for chaos tests (explorer) |
| **Docker Compose** | Test environment orchestration (integration, chaos, E2E) |

### Running Tests

Each component provides granular npm scripts for running specific test types. See the component README for the full list:

- [Indexer test scripts](../components/indexer/README.md)
- [Explorer test scripts](../components/explorer/README.md)
- [Encoder test scripts](../components/encoder/README.md)
- [VM test scripts](../components/vm/README.md)
- [SDK test scripts](../components/sdk/README.md)

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

- **New feature** — Unit tests for the new logic, plus integration tests if it touches the database or API surface.
- **Bug fix** — A regression test that reproduces the bug and verifies the fix. This test should fail without the fix and pass with it.
- **Security fix** — A security test that attempts the exploit and verifies it is blocked.
- **Performance change** — Update or add performance baselines to reflect the new expected behavior.

Tests should be deterministic, isolated, and fast. Avoid sleeps, network calls to external services, and dependencies on test execution order.

---

**Copyright &copy; 2025 Dankest, LLC**

**Based on XChain Platform by Dankest, LLC &ndash; https://dankest.llc**

Licensed under the **Dankest Community License**
(based on the Apache License 2.0 with additional non-commercial and network-disclosure terms).

You may not use, modify, or distribute this material except in compliance with the License.
See [LICENSE](../LICENSE.md) and [NOTICE](../NOTICE.md) for full terms.
A full copy of the License is also available at: [https://dankest.llc/license](https://dankest.llc/license)
