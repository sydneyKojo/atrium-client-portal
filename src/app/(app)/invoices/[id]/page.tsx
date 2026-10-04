import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton, PrintButton } from "@/components/client";
import { Icon } from "@/components/icons";
import { Badge, dateLabel, dueLabel, Flash, PageHead } from "@/components/ui";
import { formatMoney, invoiceState, stripeEnabled } from "@/lib/billing";
import { getInvoice, getWorkspace } from "@/lib/queries";
import { requireClientAccess, requireUser } from "@/lib/session";
import { voidInvoiceAction } from "../../admin/actions";

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  const row = Number.isInteger(id) ? await getInvoice(id) : null;
  if (!row) notFound();
  const user = await requireClientAccess(row.invoice.clientId);
  const isAdmin = user.role === "admin";
  const [workspace, { ok, err }] = await Promise.all([getWorkspace(), searchParams]);
  const { invoice: inv, client } = row;
  const state = invoiceState(inv);
  const amount = formatMoney(inv.amountCents, inv.currency);

  return (
    <>
      <div className="no-print">
        <PageHead
          crumbs={isAdmin ? [{ href: "/admin/invoices", label: "Invoices" }, { href: `/admin/clients/${client.id}`, label: client.name }] : [{ href: "/portal/invoices", label: "Invoices" }]}
          title={`Invoice ${inv.number}`}
          lead={
            state === "paid"
              ? `Paid ${inv.paidAt ? dateLabel(inv.paidAt, true) : ""}${inv.stripeSessionId ? " by card via Stripe" : ""}.`
              : state === "void"
                ? "Voided. Kept for your records; it can no longer be paid."
                : `${amount} · ${dueLabel(inv.dueDate)}`
          }
          actions={
            <>
              <PrintButton />
              {!isAdmin && inv.status === "open" && (
                <form action={`/api/invoices/${inv.id}/pay`} method="post">
                  <button className="btn"><Icon name="card" size="sm" /> {stripeEnabled() ? `Pay ${amount}` : `Pay ${amount} (demo)`}</button>
                </form>
              )}
              {isAdmin && inv.status === "open" && (
                <form action={voidInvoiceAction}>
                  <input type="hidden" name="invoiceId" value={inv.id} />
                  <ConfirmButton
                    label="Void invoice"
                    className="btn secondary"
                    title={`Void ${inv.number}?`}
                    body={`${client.name} will no longer be able to pay this ${amount} invoice. It stays in your records and the activity log. This can't be undone; issue a new invoice if needed.`}
                    confirm="Void invoice"
                  />
                </form>
              )}
            </>
          }
        />
      </div>
      <div className="no-print"><Flash ok={ok} err={err} /></div>

      <article className="card doc" aria-label={`Invoice ${inv.number}`}>
        <header className="doc-head">
          <div>
            <div className="doc-brand">{workspace.name}</div>
            <div className="muted small">{workspace.supportEmail}</div>
          </div>
          <div className="doc-title">
            <div className="muted small">INVOICE</div>
            <div className="big">{inv.number}</div>
            <div style={{ marginTop: 6 }}><Badge status={state} /></div>
          </div>
        </header>

        <div className="grid grid-2">
          <dl className="dl">
            <dt>Billed to</dt>
            <dd>
              {client.name}
              {client.contactName && <><br />{client.contactName}</>}
              <br /><span className="muted">{client.contactEmail}</span>
            </dd>
          </dl>
          <dl className="dl">
            <dt>Issued</dt><dd>{dateLabel(inv.createdAt)}</dd>
            <dt>Due</dt><dd>{dateLabel(inv.dueDate)}</dd>
            {inv.paidAt && (<><dt>Paid</dt><dd>{dateLabel(inv.paidAt)}</dd></>)}
          </dl>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Description</th><th className="r">Qty</th><th className="r">Amount</th></tr></thead>
            <tbody><tr><td className="strong">{inv.description}</td><td className="r">1</td><td className="r">{amount}</td></tr></tbody>
          </table>
        </div>

        <div className="doc-total">
          <table>
            <tbody>
              <tr><td className="muted">Subtotal</td><td className="r">{amount}</td></tr>
              <tr className="grand"><td>{state === "paid" ? "Total paid" : "Total due"}</td><td className="r">{amount}</td></tr>
            </tbody>
          </table>
        </div>

        <footer className="muted small" style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          {workspace.invoiceNote && <p style={{ marginBottom: 6 }}>{workspace.invoiceNote}</p>}
          <p>Pay online by card from your client portal. Questions about this invoice: {workspace.supportEmail}. Amounts in {inv.currency.toUpperCase()}.</p>
        </footer>
      </article>

      <p className="muted small no-print">
        <Link href={isAdmin ? "/admin/invoices" : "/portal/invoices"}>← Back to invoices</Link>
      </p>
    </>
  );
}
