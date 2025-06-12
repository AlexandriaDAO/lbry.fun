# PRD: A Resilient Backend Integration Testing Architecture

## 1. Objective

To establish a reliable, long-term, and fully-automated **backend integration testing** solution for the `lbryfun` project. This suite must be capable of testing complex, multi-canister interactions by executing Rust tests against the *actual compiled canister WASM*.

## 2. The Core Challenge: Decoupling Testing from DFX

Our core challenge is not a bug or a version conflict, but a fundamental architectural principle: for robust, automated testing, the test environment should be independent of the `dfx` local replica.

While `dfx start` is excellent for local development and manual testing, a programmatic testing suite requires a more controlled, deterministic environment. This is precisely what the standalone `pocket-ic` server is designed for.

Our initial confusion stemmed from trying to make the `pocket-ic` Rust client library compatible with the server *bundled inside `dfx`*. This is the wrong approach. The modern, correct approach is to use the standalone `pocket-ic` server, which completely decouples our test environment from `dfx`'s internal dependencies.

## 3. The Chosen Architecture: Standalone `pocket-ic` Server

This architecture uses the `pocket-ic` Rust client library in combination with the standalone `pocket-ic` server binary. This is the official, recommended approach for automated testing.

### How It Works:

1.  **Standalone Server:** We use a specific, downloaded `pocket-ic` server binary (located in the `/bin` directory). This binary provides a controllable, simulated IC environment via a REST API.
2.  **Rust Test Client:** Our `tests` crate will use the `pocket-ic` Rust library. We will configure this library to communicate with our standalone server binary.
3.  **No More Dependency Conflicts:** Because we are no longer tied to the `dfx` environment, our test crate can use the **latest** versions of `pocket-ic` and `ic-cdk`, completely eliminating the versioning conflicts we previously faced.
4.  **Black-Box Testing:** The test crate will not reference your application's source code. It will load and test the final compiled `.wasm` files, which is the most realistic and reliable form of integration testing.

## 4. Implementation Plan

The following steps will establish a "Hello, World" foundation for your backend integration tests, using the correct, modern architecture.

1.  **Reformat the Test Project:**
    *   **Location:** We will use the existing `tests` directory at the project root. There is no need to create or modify anything inside the main `src/` directory.
    *   **Action 1: Clean Up Old Configuration.** The first step is to delete the `tests/.cargo` directory. Its `[patch]` configuration is the source of our old problems and is no longer needed with the standalone server architecture.
    *   **Action 2: Update Dependencies.** The `tests/Cargo.toml` file will be updated to use the latest versions of `pocket-ic` and other dependencies, removing the pinned, older versions.
    *   **Rationale:** This completely purges the old, complex workarounds and aligns the test crate with the new, simpler architecture.

2.  **Implement the "Hello, World" Backend Test:**
    *   **Action:** The test file `tests/src/main.rs` will be updated.
    *   **Logic:** The test will:
        a. Set the `POCKET_IC_BIN` environment variable to point to the `bin/pocket-ic` binary.
        b. Use `pocket_ic::PocketIc::new()` to start a new instance of the standalone server.
        c. Deploy a canister's compiled WASM (e.g., `icp_swap.wasm`) to the simulator.
        d. Call a public function on the deployed canister (e.g., `get_config`).
        e. Assert that the call was successful and the response is correct.

3.  **Create the Orchestration Script:**
    *   **Action:** A new script, `run_tests.sh`, will be created at the project root.
    *   **Logic:**
        ```bash
        #!/bin/bash
        set -e

        echo "--> Building main application canisters..."
        cargo build --release --target wasm32-unknown-unknown -p icp_swap

        echo "--> Running backend integration tests..."
        cd tests
        cargo test -- --nocapture
        ```

## 5. Definition of Done

This project is complete when the `bash run_tests.sh` command executes successfully, which means:
1.  The target canister (`icp_swap`) is compiled without error.
2.  The `tests` crate successfully builds and runs its test against the compiled `.wasm` file, using the standalone `pocket-ic` server.
3.  There are no dependency conflicts, and the test passes, proving the architecture is sound.
4.  You have a stable, working foundation on which to build all future complex integration tests.