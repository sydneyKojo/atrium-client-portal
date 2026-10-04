"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, t } from "@/db";
import { markNotificationsSeen, record } from "@/lib/activity";
import { SESSION_COOKIE, endOtherSessions, hashPassword, verifyPassword } from "@/lib/auth";
import { requireUser } from "@/lib/session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function updateProfileAction(form: FormData) {
  const user = await requireUser();
  const name = str(form, "name").slice(0, 120);
  if (!name) redirect("/account?err=Enter your name.");
  await db.update(t.users).set({ name }).where(eq(t.users.id, user.id));
  revalidatePath("/", "layout");
  redirect("/account?ok=Profile saved.");
}

export async function changePasswordAction(form: FormData) {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (!(await verifyPassword(current, user.passwordHash))) redirect("/account?err=Your current password is not correct.");
  if (next.length < 10) redirect("/account?err=Choose a new password of at least 10 characters.");
  if (next !== confirm) redirect("/account?err=The new passwords don't match.");
  await db.update(t.users).set({ passwordHash: await hashPassword(next) }).where(eq(t.users.id, user.id));
  await endOtherSessions(user.id, (await cookies()).get(SESSION_COOKIE)?.value);
  await record(user.id, user.clientId, "account.password_changed", `${user.name} changed their password`);
  redirect("/account?ok=Password changed. Any other devices have been signed out.");
}

export async function markAllReadAction() {
  const user = await requireUser();
  await markNotificationsSeen(user.id);
  revalidatePath("/", "layout");
  redirect("/notifications");
}
