import { SubmitButton } from "@/components/client";
import { Icon } from "@/components/icons";
import { dateLabel, Flash, PageHead } from "@/components/ui";
import { stripeEnabled } from "@/lib/billing";
import { getWorkspace } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { updateWorkspaceAction } from "../actions";

export const metadata = { title: "Settings · Atrium" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireAdmin();
  const [ws, { ok, err }] = await Promise.all([getWorkspace(), searchParams]);
  const stripe = stripeEnabled();
  return (
    <>
      <PageHead title="Settings" lead="How your workspace appears to clients, and how invoices are issued and paid." />
      <Flash ok={ok} err={err} />
      <div className="grid grid-main" style={{ alignItems: "start" }}>
        <section className="card">
          <div className="card-head"><div><h2>Workspace &amp; invoicing</h2><p>Last changed {dateLabel(ws.updatedAt, true)}.</p></div></div>
          <form action={updateWorkspaceAction} className="card-body form">
            <div className="form-row">
              <label>Business name <span className="hint">Shown in the portal and at the top of invoices.</span><input name="name" required maxLength={80} defaultValue={ws.name} /></label>
              <label>Support &amp; billing email <span className="hint">Where clients send questions.</span><input name="supportEmail" type="email" required defaultValue={ws.supportEmail} /></label>
            </div>
            <label style={{ maxWidth: 260 }}>
              Default payment terms (days)
              <input name="paymentTermsDays" type="number" min={0} max={120} required defaultValue={ws.paymentTermsDays} />
              <span className="hint">Pre-fills the due date on new invoices. 0 means due on receipt.</span>
            </label>
            <label>
              Invoice footer note <span className="hint">Optional. Bank details, VAT number or a thank-you line.</span>
              <textarea name="invoiceNote" maxLength={300} defaultValue={ws.invoiceNote} />
            </label>
            <div className="form-actions"><SubmitButton>Save settings</SubmitButton></div>
          </form>
        </section>
        <div className="grid">
          <section className="card">
            <div className="card-head"><div><h2>Card payments</h2><p>Processed by Stripe Checkout.</p></div></div>
            <div className="card-body form">
              <div className={`flash ${stripe ? "ok" : "err"}`} style={stripe ? undefined : { background: "var(--warn-soft)", color: "var(--warn)" }}>
                <Icon name={stripe ? "checkCircle" : "info"} size="sm" />
                <span>{stripe ? "Connected. Clients pay invoices by card; payments are confirmed by Stripe's signed webhook." : "Demo mode. No Stripe keys are configured, so “Pay” marks invoices paid without charging."}</span>
              </div>
              <p className="muted small">
                To take real payments, set <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code>, and point a Stripe webhook for
                <code> checkout.session.completed</code> at <code>/api/stripe/webhook</code>.
              </p>
            </div>
          </section>
          <section className="card">
            <div className="card-head"><div><h2>Security</h2></div></div>
            <ul className="list small">
              <li><Icon name="lock" size="sm" /><span className="grow">Passwords hashed with scrypt; sessions expire after 14 days.</span></li>
              <li><Icon name="shield" size="sm" /><span className="grow">Clients only ever see their own company&apos;s data.</span></li>
              <li><Icon name="activity" size="sm" /><span className="grow">Every change is recorded in the activity log.</span></li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
