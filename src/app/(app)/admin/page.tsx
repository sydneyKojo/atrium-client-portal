import Link from "next/link";
import { money, Timeline } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Badge, dueLabel, Empty, Help, Kpi, PageHead, STATUS_LABEL } from "@/components/ui";
import { listActivity } from "@/lib/activity";
import { invoiceState } from "@/lib/billing";
import { adminOverview, PROJECT_STATUSES } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";

export const metadata = { title: "Overview · Atrium" };

const STAGE_COLOR: Record<string, string> = { planning: "var(--idle)", in_progress: "var(--info)", review: "#d99a2b", done: "var(--ok)" };

export default async function AdminOverview() {
  const user = await requireAdmin();
  const [{ totals, projectCounts, dueSoon, clientCount }, activity] = await Promise.all([adminOverview(), listActivity(user, { limit: 8 })]);
  const aging = [
    { label: "Not yet due", cents: totals.aging_current!, tone: "" },
    { label: "1–30 days late", cents: totals.aging_1_30!, tone: "warn" },
    { label: "31–60 days late", cents: totals.aging_31_60!, tone: "danger" },
    { label: "60+ days late", cents: totals.aging_60_plus!, tone: "danger" },
  ];
  const agingMax = Math.max(1, ...aging.map((a) => a.cents));
  const projectTotal = Object.values(projectCounts).reduce((a, b) => a + b, 0);
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHead
        title={`Good to see you, ${firstName}`}
        lead="Money owed, work in flight and what your clients did recently, across every client."
        actions={
          <>
            <Link href="/admin/invoices" className="btn secondary"><Icon name="receipt" size="sm" /> All invoices</Link>
            <Link href="/admin/clients#new" className="btn"><Icon name="plus" size="sm" /> Add client</Link>
          </>
        }
      />

      <section className="kpis" aria-label="Key figures">
        <Kpi label="Outstanding" value={money(totals.outstanding!)} hint={`${totals.open_count} open invoice${totals.open_count === 1 ? "" : "s"}`} help="Total of all open invoices, whether or not they are due yet. Paid and voided invoices are excluded." />
        <Kpi label="Overdue" value={money(totals.overdue!)} hint={totals.overdue ? "Past the due date" : "Nothing overdue"} help="Open invoices whose due date has passed. Chase these first." alert={totals.overdue! > 0} />
        <Kpi label="Collected this month" value={money(totals.paid_this_month!)} hint="Payments received since the 1st" help="Invoices marked paid this calendar month, by card through Stripe or recorded payments." />
        <Kpi label="Active clients" value={String(clientCount)} hint={`${projectTotal - projectCounts.done} projects in progress`} help="Clients in this workspace, and projects not yet delivered." />
      </section>

      <div className="grid grid-main">
        <div className="grid">
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Receivables ageing <Help id="aging-help">How long open invoices have been unpaid, grouped by days past their due date.</Help></h2>
                <p>Where your unpaid money sits today.</p>
              </div>
              <Link href="/admin/invoices?status=overdue" className="btn ghost sm">See overdue <Icon name="arrowRight" size="sm" /></Link>
            </div>
            <div className="card-body bars">
              {aging.map((a) => (
                <div className="bar-row" key={a.label}>
                  <span className="muted">{a.label}</span>
                  <span className="bar-track"><span className={`bar-fill ${a.tone}`} style={{ width: `${(a.cents / agingMax) * 100}%`, display: "block" }} /></span>
                  <span className="r strong num" style={{ textAlign: "right" }}>{money(a.cents)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Next payments due</h2>
                <p>Open invoices, soonest first.</p>
              </div>
            </div>
            {dueSoon.length === 0 ? (
              <Empty icon="receipt" title="Nothing waiting to be paid">Issue an invoice from a client&apos;s page; it appears here until it is paid.</Empty>
            ) : (
              <ul className="list">
                {dueSoon.map(({ invoice: inv, clientName }) => (
                  <li key={inv.id}>
                    <span className="grow">
                      <Link href={`/invoices/${inv.id}`} className="title">{inv.number} · {clientName}</Link>
                      <span className="muted tiny">{inv.description}</span>
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <span className="strong num" style={{ display: "block" }}>{money(inv.amountCents)}</span>
                      <span className="tiny" style={{ color: invoiceState(inv) === "overdue" ? "var(--danger)" : "var(--muted)" }}>{dueLabel(inv.dueDate)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid" style={{ alignContent: "start" }}>
          <section className="card">
            <div className="card-head">
              <div>
                <h2>Projects by stage</h2>
                <p>{projectTotal} project{projectTotal === 1 ? "" : "s"} across all clients</p>
              </div>
            </div>
            <div className="card-body">
              <div className="stack-bar" role="img" aria-label={PROJECT_STATUSES.map((s) => `${STATUS_LABEL[s]}: ${projectCounts[s]}`).join(", ")}>
                {PROJECT_STATUSES.map((s) => projectCounts[s] > 0 && (
                  <span key={s} style={{ width: `${(projectCounts[s] / Math.max(1, projectTotal)) * 100}%`, background: STAGE_COLOR[s] }} />
                ))}
              </div>
              <div className="legend">
                {PROJECT_STATUSES.map((s) => (
                  <Link key={s} href={`/admin/projects?status=${s}`} style={{ color: "inherit" }}>
                    <i style={{ background: STAGE_COLOR[s] }} />{STATUS_LABEL[s]} <strong>{projectCounts[s]}</strong>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Recent activity</h2>
                <p>Latest across all clients.</p>
              </div>
              <Link href="/admin/activity" className="btn ghost sm">Full log</Link>
            </div>
            <Timeline rows={activity} showClient />
          </section>
        </div>
      </div>

      <p className="muted tiny">
        Figures update live. Statuses: <Badge status="open" /> due later, <Badge status="overdue" /> past due, <Badge status="paid" /> settled.
      </p>
    </>
  );
}
