import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function create() {
  const client = postgres(process.env.DATABASE_URL ?? "postgres://localhost:5432/client_portal", { onnotice: () => {} });
  return { client, db: drizzle(client, { schema }) };
}

// One pool per process, reused across Next.js hot reloads in development.
const g = globalThis as unknown as { __portalDb?: ReturnType<typeof create> };
const conn = g.__portalDb ?? create();
if (process.env.NODE_ENV !== "production") g.__portalDb = conn;

export const db = conn.db;
export const sqlClient = conn.client;
export * as t from "./schema";
