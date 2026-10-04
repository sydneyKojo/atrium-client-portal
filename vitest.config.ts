import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], fileParallelism: false, env: { DATABASE_URL: "postgres://localhost:5432/client_portal_test" } },
});
