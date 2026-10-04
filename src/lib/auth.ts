import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, ne } from "drizzle-orm";
import { db, t } from "@/db";
import type { User } from "@/db/schema";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "portal_session";
export const SESSION_DAYS = 14;

// scrypt from Node's standard library: no native add-on, safe defaults.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

// Only a hash of the token is stored, so a database leak can't be replayed as a login.
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function login(email: string, password: string): Promise<{ token: string; user: User } | null> {
  const user = await db.query.users.findFirst({ where: eq(t.users.email, email.trim().toLowerCase()) });
  // Hash anyway when the user doesn't exist, so response time doesn't reveal which emails are registered.
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await hashPassword(password), false);
  if (!user || !ok) return null;
  const token = randomBytes(32).toString("base64url");
  await db.insert(t.sessions).values({
    tokenHash: hashToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
  });
  return { token, user };
}

export async function userForToken(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const rows = await db
    .select({ user: t.users })
    .from(t.sessions)
    .innerJoin(t.users, eq(t.users.id, t.sessions.userId))
    .where(and(eq(t.sessions.tokenHash, hashToken(token)), gt(t.sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
}

// After a password change: every other device has to sign in again.
export async function endOtherSessions(userId: number, keepToken: string | undefined): Promise<void> {
  const keep = keepToken ? hashToken(keepToken) : "";
  await db.delete(t.sessions).where(and(eq(t.sessions.userId, userId), ne(t.sessions.tokenHash, keep)));
}

export async function logout(token: string | undefined): Promise<void> {
  if (token) await db.delete(t.sessions).where(eq(t.sessions.tokenHash, hashToken(token)));
}

// The single rule for who sees what: admins see every client, a client user sees only their own company.
export function canAccessClient(user: Pick<User, "role" | "clientId">, clientId: number): boolean {
  return user.role === "admin" || user.clientId === clientId;
}
