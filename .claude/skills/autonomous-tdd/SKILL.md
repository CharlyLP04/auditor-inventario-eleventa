---
name: autonomous-tdd
description: >-
  Autonomous Test-Driven Development (TDD) workflow and verification loop for coding agents like GPT-6 Astra and Gemini.
  Enforces writing tests first or concurrently, executing test suites in the terminal, diagnosing failures,
  and iterating autonomously until all tests pass with zero regressions.
---

# Autonomous TDD & Verification Workflow

You are an expert software engineer operating in an autonomous agentic loop. When implementing features, bugfixes, or refactoring, you must never consider a task complete without empirical test verification.

## Core Philosophy
1. **Never Assume Code Works:** Always prove it through automated tests.
2. **Red-Green-Refactor:**
   - **Red:** Define specifications via tests that fail initially.
   - **Green:** Implement the minimal code required to satisfy the tests.
   - **Refactor:** Clean up code, remove duplication, and optimize without breaking tests.
3. **Zero Regressions:** Run existing test suites to guarantee no existing behavior is altered.

---

## The 5-Step Execution Cycle

### Step 1: Test Discovery & Planning
- Locate existing tests in the project (e.g., `tests/`, `__tests__/`, `*.spec.ts`, `*_test.go`, `test_*.py`).
- Identify the test runner:
  - Node/TS: `npm test`, `pnpm test`, `bun test`, `vitest`, `jest`
  - Python: `pytest`, `python -m unittest`
  - Go: `go test ./...`
  - Rust: `cargo test`
  - Java/Kotlin: `./gradlew test`, `mvn test`
  - C#/.NET: `dotnet test`
- Identify edge cases: empty inputs, boundary values, network timeouts, invalid types, and error conditions.

### Step 2: Write or Update Test Cases
- Add test cases covering both expected behavior (happy path) and failure modes.
- Keep tests isolated, fast, and deterministic (mock external I/O if needed).

### Step 3: Run the Tests (Red Phase)
- Execute the specific new test file or test case in the terminal.
- Verify that the test fails for the *expected* reason (e.g., function not defined, return value mismatch).

### Step 4: Implement Minimal Solution (Green Phase)
- Write the cleanest, most idiomatic implementation to pass the tests.
- Avoid premature over-engineering; focus on the requirement.

### Step 5: Regression & Coverage Check
- Run the full test suite (or affected module suite).
- If any test fails:
  - Do NOT modify the test to artificially pass unless the requirements have changed.
  - Read the stack trace, diagnose the failure, and fix the implementation.
  - Repeat until exit code is 0.
