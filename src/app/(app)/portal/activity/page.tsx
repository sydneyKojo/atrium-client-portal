import { redirect } from "next/navigation";
import { ActivityPage } from "@/components/lists-pages";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Activity · Atrium" };

export default async function Page({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const user = await requireUser();
  if (user.role === "admin") redirect("/admin/activity");
  return <ActivityPage user={user} base="/portal/activity" action={(await searchParams).action} />;
}
