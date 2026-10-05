// Runs before each deploy: creates or updates tables, loads demo data into an empty database,
// and restores the demo files (the server's disk is reset on every deploy).
import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";
import { DDL } from "../src/db/schema";
import { DEMO_FILES } from "./demo-files";

const sql = postgres(process.env.DATABASE_URL ?? "postgres://localhost:5432/client_portal", { onnotice: () => {} });
await sql.unsafe(DDL);
const [row] = await sql<{ n: number }[]>`select count(*)::int as n from clients`;
const n = row?.n ?? 0;
await sql.end();

if (n === 0) {
  console.log("Empty database: loading demo data.");
  await import("./seed");
} else {
  const dir = join(process.cwd(), "uploads");
  await mkdir(dir, { recursive: true });
  const db = postgres(process.env.DATABASE_URL ?? "postgres://localhost:5432/client_portal", { onnotice: () => {} });
  const rows = await db<{ id: string; name: string }[]>`select id, name from files`;
  let restored = 0;
  for (const r of rows) {
    const body = DEMO_FILES[r.name];
    if (body !== undefined && !existsSync(join(dir, r.id))) {
      await writeFile(join(dir, r.id), body);
      restored++;
    }
  }
  await db.end();
  console.log(`Database ready (${n} clients). Restored ${restored} demo file(s).`);
}
