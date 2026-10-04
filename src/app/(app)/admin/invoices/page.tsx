import { InvoicesPage } from "@/components/invoices-page";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Invoices · Atrium" };

export default async function AdminInvoices({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; ok?: string; err?: string }> }) {
  const user = await requireAdmin();
  return <InvoicesPage user={user} base="/admin/invoices" {...await searchParams} />;
}
