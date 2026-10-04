import { FilesPage } from "@/components/lists-pages";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Files · Atrium" };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requireAdmin();
  return <FilesPage user={user} base="/admin/files" q={(await searchParams).q} />;
}
