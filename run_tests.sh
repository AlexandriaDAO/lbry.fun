#!/bin/bash
set -e

echo "--> Building main application canisters..."
cargo build --release --target wasm32-unknown-unknown -p icp_swap

echo "--> Running backend integration tests..."
cd tests
cargo clean
cargo test -- --nocapture 