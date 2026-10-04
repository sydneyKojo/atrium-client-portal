// Dev helper for scripted checks: prints a session token for a seeded user.
import { sqlClient } from "../src/db";
import { login } from "../src/lib/auth";

const res = await login(process.argv[2] ?? "", process.argv[3] ?? "demo-password");
console.log(res?.token ?? "");
await sqlClient.end();
