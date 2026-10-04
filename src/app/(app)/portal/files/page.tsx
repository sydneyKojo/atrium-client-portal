import { redirect } from "next/navigation";
import { FilesPage } from "@/components/lists-pages";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Files · Atrium" };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requireUser();
  if (user.role === "admin") redirect("/admin/files");
  return <FilesPage user={user} base="/portal/files" q={(await searchParams).q} />;
}
