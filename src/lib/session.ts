import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { User } from "@/db/schema";
import { SESSION_COOKIE, canAccessClient, userForToken } from "./auth";

export async function currentUser(): Promise<User | null> {
  return userForToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/portal");
  return user;
}

// 404 rather than 403, so a client can't probe which ids exist.
export async function requireClientAccess(clientId: number): Promise<User> {
  const user = await requireUser();
  if (!canAccessClient(user, clientId)) notFound();
  return user;
}
