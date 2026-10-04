import { redirect } from "next/navigation";
import { InvoicesPage } from "@/components/invoices-page";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Invoices · Atrium" };

export default async function PortalInvoices({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; ok?: string; err?: string }> }) {
  const user = await requireUser();
  if (user.role === "admin") redirect("/admin/invoices");
  return <InvoicesPage user={user} base="/portal/invoices" {...await searchParams} />;
}
