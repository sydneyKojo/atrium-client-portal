import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileList, money, StatusProgress, Timeline } from "@/components/blocks";
import { Icon } from "@/components/icons";
import { Badge, dateLabel, dueLabel, Empty, Flash, Kpi, PageHead } from "@/components/ui";
import { listActivity } from "@/lib/activity";
import { invoiceState, stripeEnabled } from "@/lib/billing";
import { clientDashboard, getWorkspace } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Overview · Atrium" };

export default async function PortalHome({ searchParams }: { searchParams: Promise<{ paid?: string; err?: string; ok?: string }> }) {
  const user = await requireUser();
  if (user.role === "admin") redirect("/admin");
  const [data, workspace, activity, { paid, err, ok }] = await Promise.all([
    clientDashboard(user.clientId!),
    getWorkspace(),
    listActivity(user, { limit: 6 }),
    searchParams,
  ]);
  if (!data) notFound();
  const toPay = data.invoices.filter((i) => i.status === "open").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const active = data.projects.filter((p) => p.status !== "done");
  const recentFiles = data.projects.flatMap((p) => p.files.map((f) => ({ ...f, project: p }))).sort((a, b) => +b.createdAt - +a.createdAt).slice(0, 5);

  return (
    <>
      <PageHead
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        lead={`Your workspace with ${workspace.name}: project progress, shared files and invoices for ${data.client.name}.`}
      />
      <Flash ok={paid ? `Thank you. Payment for ${paid} has been received and a receipt recorded.` : ok} err={err} />

      <section className="kpis">
        <Kpi label="Amount due" value={money(data.outstandingCents)} hint={data.nextDue ? `Next: ${data.nextDue.number}, ${dueLabel(data.nextDue.dueDate).toLowerCase()}` : "You're all paid up"} alert={data.overdueCents > 0} />
        <Kpi label="Active projects" value={String(active.length)} hint={`${data.projects.length - active.length} delivered`} />
        <Kpi label="Shared files" value={String(data.projects.reduce((s, p) => s + p.files.length, 0))} hint="Across all projects" />
        <Kpi label="Paid to date" value={money(data.paidCents)} hint="Thank you!" />
      </section>

      {toPay.length > 0 && (
        <section className="card">
          <div className="card-head">
            <div>
              <h2>Invoices to pay</h2>
              <p>Pay securely by card. {stripeEnabled() ? "Payments are processed by Stripe; we never see your card details." : "Demo mode: payments are simulated."}</p>
            </div>
            <Link href="/portal/invoices" className="btn ghost sm">All invoices <Icon name="arrowRight" size="sm" /></Link>
          </div>
          <ul className="list">
            {toPay.map((inv) => (
              <li key={inv.id}>
                <span className="grow">
                  <Link href={`/invoices/${inv.id}`} className="title">{inv.number} · {inv.description}</Link>
                  <span className="tiny" style={{ color: invoiceState(inv) === "overdue" ? "var(--danger)" : "var(--muted)" }}>
                    Due {dateLabel(inv.dueDate)} · {dueLabel(inv.dueDate)}
                  </span>
                </span>
                <span className="strong num">{money(inv.amountCents)}</span>
                <form action={`/api/invoices/${inv.id}/pay`} method="post">
                  <button className="btn sm"><Icon name="card" size="sm" /> {stripeEnabled() ? "Pay now" : "Pay (demo)"}</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-main">
        <section className="card" style={{ alignSelf: "start" }}>
          <div className="card-head">
            <div><h2>Your projects</h2><p>Where each piece of work stands.</p></div>
            <Link href="/portal/projects" className="btn ghost sm">All projects</Link>
          </div>
          {data.projects.length === 0 ? (
            <Empty icon="folder" title="No projects yet">When {workspace.name} starts work for you, it appears here with its files and progress.</Empty>
          ) : (
            <ul className="list">
              {data.projects.map((p) => (
                <li key={p.id}>
                  <span className="grow">
                    <Link href={`/projects/${p.id}`} className="title">{p.name}</Link>
                    <span className="muted tiny">
                      {p.files.length} file{p.files.length === 1 ? "" : "s"}{p.dueDate ? ` · Target ${dateLabel(p.dueDate)}` : ""}
                    </span>
                    <div style={{ maxWidth: 240, marginTop: 6 }}><StatusProgress status={p.status} /></div>
                  </span>
                  <Badge status={p.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid" style={{ alignContent: "start" }}>
          <section className="card">
            <div className="card-head"><div><h2>Latest files</h2></div><Link href="/portal/files" className="btn ghost sm">All files</Link></div>
            <FileList
              files={recentFiles.map((f) => ({ ...f, context: <Link href={`/projects/${f.project.id}`}>{f.project.name}</Link> }))}
              empty={<Empty icon="file" title="No files shared yet">Deliverables and briefs appear here once they&apos;re uploaded.</Empty>}
            />
          </section>
          <section className="card">
            <div className="card-head"><div><h2>Recent updates</h2></div><Link href="/portal/activity" className="btn ghost sm">All</Link></div>
            <Timeline rows={activity} />
          </section>
        </div>
      </div>
    </>
  );
}
