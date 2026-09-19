// Enforces the AGENTS.md invariant "no model calls in tests": any test that
// reaches the network through the global fetch fails here. Tests that need a
// fetch inject their own (see jev.test.ts).
import { beforeAll } from "vitest";

beforeAll(() => {
  globalThis.fetch = ((input: Parameters<typeof globalThis.fetch>[0]) => {
    throw new Error(
      `Test attempted a network call to ${String(input)}. Inject evaluate or fetch instead.`
    );
  }) as typeof globalThis.fetch;
});
