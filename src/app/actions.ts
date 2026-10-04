"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_DAYS, login, logout } from "@/lib/auth";

export async function loginAction(form: FormData) {
  const email = String(form.get("email") ?? "");
  const res = await login(email, String(form.get("password") ?? ""));
  if (!res) redirect(`/login?error=1&email=${encodeURIComponent(email.trim().slice(0, 200))}`);
  (await cookies()).set(SESSION_COOKIE, res.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect(res.user.role === "admin" ? "/admin" : "/portal");
}

export async function logoutAction() {
  const jar = await cookies();
  await logout(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  redirect("/login?signedOut=1");
}
