import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integração: roda contra o Supabase local (`npx supabase start`).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/support/local-supabase.ts"],
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
