import "dotenv/config";
import postgres from "postgres";
import { DDL } from "../src/db/schema";

const sql = postgres(process.env.DATABASE_URL ?? "postgres://localhost:5432/client_portal", { onnotice: () => {} });
await sql.unsafe(DDL);
await sql.end();
console.log("Database ready.");
