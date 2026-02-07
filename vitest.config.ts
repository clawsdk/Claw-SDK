import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Default test run is unit-only (deterministic, no RPC).
    include: ['tests/unit/**/*.test.ts'],
    hookTimeout: 60_000,
    testTimeout: 60_000
  }
});
