import { invoiceState } from "@/lib/billing";
import { csvResponse, toCsv } from "@/lib/csv";
import { listInvoices } from "@/lib/queries";
import { currentUser } from "@/lib/session";

// Same filters as the invoices page, scoped to the signed-in user.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const url = new URL(req.url);
  const rows = await listInvoices(user, { status: url.searchParams.get("status") ?? "all", q: url.searchParams.get("q") ?? "" });
  const body = toCsv(
    ["Invoice", "Client", "Description", "Amount", "Currency", "Status", "Issued", "Due", "Paid"],
    rows.map(({ invoice: i, clientName }) => [
      i.number, clientName, i.description, (i.amountCents / 100).toFixed(2), i.currency.toUpperCase(), invoiceState(i),
      i.createdAt.toISOString().slice(0, 10), i.dueDate, i.paidAt?.toISOString().slice(0, 10) ?? "",
    ]),
  );
  return csvResponse(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, body);
}
