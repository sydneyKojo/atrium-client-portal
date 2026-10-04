import Link from "next/link";
import type { User } from "@/db/schema";
import { formatMoney, invoiceState, stripeEnabled } from "@/lib/billing";
import { listInvoices } from "@/lib/queries";
import { InvoiceTable } from "./blocks";
import { Icon } from "./icons";
import { Empty, Flash, Kpi, PageHead, SearchBox, Segmented } from "./ui";

// One invoice list for both roles; the query is scoped to the user, so a client only ever sees their own.
export async function InvoicesPage({ user, base, status = "all", q = "", ok, err }: { user: User; base: string; status?: string; q?: string; ok?: string; err?: string }) {
  const isAdmin = user.role === "admin";
  const all = await listInvoices(user, {});
  const rows = await listInvoices(user, { status, q: q.trim() });
  const state = (k: string) => all.filter((r) => (k === "all" ? true : invoiceState(r.invoice) === k)).length;
  const sum = (k: string) => all.filter((r) => invoiceState(r.invoice) === k).reduce((s, r) => s + r.invoice.amountCents, 0);
  const link = (s: string) => `${base}?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageHead
        title="Invoices"
        lead={
          isAdmin
            ? "Every invoice across all clients. Clients pay by card from their portal; payments are confirmed by Stripe and recorded here automatically."
            : "Your invoices from us. Pay open invoices by card; a receipt is recorded as soon as the payment clears."
        }
        actions={
          <a href={`/api/export/invoices?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="btn secondary">
            <Icon name="download" size="sm" /> Export CSV
          </a>
        }
      />
      <Flash ok={ok} err={err} />
      <section className="kpis">
        <Kpi label={isAdmin ? "Unpaid" : "To pay"} value={formatMoney(sum("open") + sum("overdue"))} hint={`${state("open") + state("overdue")} invoice(s)`} />
        <Kpi label="Overdue" value={formatMoney(sum("overdue"))} alert={sum("overdue") > 0} hint={state("overdue") ? `${state("overdue")} past due date` : "None"} />
        <Kpi label="Paid" value={formatMoney(sum("paid"))} hint={`${state("paid")} invoice(s)`} />
        <Kpi label="Voided" value={String(state("void"))} hint="Cancelled, kept for records" />
      </section>
      <section className="card">
        <div className="toolbar">
          <Segmented
            current={status}
            items={["all", "open", "overdue", "paid", "void"].map((k) => ({
              key: k,
              href: link(k),
              label: { all: "All", open: "Not yet due", overdue: "Overdue", paid: "Paid", void: "Voided" }[k]!,
              n: state(k),
            }))}
          />
          <SearchBox action={base} q={q} placeholder={isAdmin ? "Number, description or client" : "Number or description"} hidden={{ status }} />
        </div>
        <InvoiceTable
          rows={rows}
          showClient={isAdmin}
          canPay={!isAdmin}
          stripe={stripeEnabled()}
          empty={
            q || status !== "all" ? (
              <Empty icon="search" title="No invoices match" action={<Link href={base} className="btn secondary sm">Show all invoices</Link>}>
                Try another status or search term.
              </Empty>
            ) : (
              <Empty icon="receipt" title="No invoices yet">
                {isAdmin ? "Issue invoices from a client's page. They appear here and in the client's portal." : "When we bill you, the invoice appears here and you can pay it by card."}
              </Empty>
            )
          }
        />
      </section>
    </>
  );
}
