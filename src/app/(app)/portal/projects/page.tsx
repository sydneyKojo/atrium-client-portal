import { redirect } from "next/navigation";
import { ProjectsPage } from "@/components/lists-pages";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Projects · Atrium" };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requireUser();
  if (user.role === "admin") redirect("/admin/projects");
  return <ProjectsPage user={user} base="/portal/projects" {...await searchParams} />;
}
