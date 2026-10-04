import { ActivityPage } from "@/components/lists-pages";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Activity log · Atrium" };

export default async function Page({ searchParams }: { searchParams: Promise<{ action?: string; client?: string }> }) {
  const user = await requireAdmin();
  const { action, client } = await searchParams;
  const clientId = Number(client);
  return <ActivityPage user={user} base="/admin/activity" action={action} clientId={Number.isInteger(clientId) && clientId > 0 ? clientId : undefined} />;
}
