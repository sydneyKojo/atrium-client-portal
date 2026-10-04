import { ProjectsPage } from "@/components/lists-pages";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Projects · Atrium" };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requireAdmin();
  return <ProjectsPage user={user} base="/admin/projects" {...await searchParams} />;
}
