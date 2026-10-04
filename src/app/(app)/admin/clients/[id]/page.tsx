import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceTable, money, StatusProgress, Timeline } from "@/components/blocks";
import { SubmitButton } from "@/components/client";
import { Icon } from "@/components/icons";
import { Badge, dateLabel, Empty, Flash, Kpi, PageHead } from "@/components/ui";
import { listActivity } from "@/lib/activity";
import { addDays } from "@/lib/billing";
import { clientDashboard, getWorkspace } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { addUserAction, createInvoiceAction, createProjectAction, updateClientAction } from "../../actions";

export default async function ClientAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const user = await requireAdmin();
  const id = Number((await params).id);
  const data = Number.isInteger(id) ? await clientDashboard(id) : null;
  if (!data) notFound();
  const [{ ok: queryOk, err }, workspace, activity] = await Promise.all([searchParams, getWorkspace(), listActivity(user, { clientId: id, limit: 10 })]);
  const ok = queryOk ?? (await cookies()).get("portal_flash")?.value;
  const hidden = <input type="hidden" name="clientId" value={id} />;
  const { client } = data;

  return (
    <>
      <PageHead
        crumbs={[{ href: "/admin/clients", label: "Clients" }]}
        title={client.name}
        lead={
          <>
            Billing contact: {client.contactName ? `${client.contactName}, ` : ""}
            <a href={`mailto:${client.contactEmail}`}>{client.contactEmail}</a> · Client since {dateLabel(client.createdAt)}
          </>
        }
        actions={
          <>
            <a href="#invoice" className="btn secondary"><Icon name="receipt" size="sm" /> New invoice</a>
            <a href="#project" className="btn"><Icon name="plus" size="sm" /> New project</a>
          </>
        }
      />
      <Flash ok={ok} err={err} />

      <section className="kpis">
        <Kpi label="Outstanding" value={money(data.outstandingCents)} hint={!data.nextDue ? "Nothing due" : data.nextDue.dueDate < new Date().toISOString().slice(0, 10) ? `Oldest was due ${dateLabel(data.nextDue.dueDate)}` : `Next due ${dateLabel(data.nextDue.dueDate)}`} />
        <Kpi label="Overdue" value={money(data.overdueCents)} alert={data.overdueCents > 0} hint={data.overdueCents ? "Follow up with the billing contact" : "All on time"} />
        <Kpi label="Paid to date" value={money(data.paidCents)} hint="Lifetime payments received" />
        <Kpi label="Projects" value={String(data.projects.length)} hint={`${data.projects.filter((p) => p.status !== "done").length} in progress`} />
      </section>

      <div className="grid grid-main">
        <div className="grid" style={{ alignContent: "start" }}>
          <section className="card">
            <div className="card-head">
              <div><h2>Projects</h2><p>What {client.name} sees in their portal, with files and stage.</p></div>
            </div>
            {data.projects.length === 0 ? (
              <Empty icon="folder" title="No projects yet" action={<a href="#project" className="btn sm">Create a project</a>}>
                Projects hold the files and progress updates you share with {client.name}.
              </Empty>
            ) : (
              <ul className="list">
                {data.projects.map((p) => (
                  <li key={p.id}>
                    <span className="grow">
                      <Link href={`/projects/${p.id}`} className="title">{p.name}</Link>
                      <span className="muted tiny">
                        {p.files.length} file{p.files.length === 1 ? "" : "s"}
                        {p.dueDate && ` · Due ${dateLabel(p.dueDate)}`}
                      </span>
                      <div style={{ maxWidth: 220, marginTop: 6 }}><StatusProgress status={p.status} /></div>
                    </span>
                    <Badge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <div><h2>Invoices</h2><p>Every invoice issued to {client.name}. Open one to print, void or check payment.</p></div>
            </div>
            <InvoiceTable
              rows={data.invoices.map((invoice) => ({ invoice, clientName: client.name }))}
              empty={<Empty icon="receipt" title="No invoices yet">Issue the first one below; {client.name} can pay it by card from their portal.</Empty>}
            />
          </section>

          <section className="card" id="invoice">
            <div className="card-head">
              <div><h2>Issue an invoice</h2><p>The client is notified in their portal and can pay by card straight away.</p></div>
            </div>
            <form action={createInvoiceAction} className="card-body form">
              {hidden}
              <div className="form-row">
                <label>What it&apos;s for<input name="description" required maxLength={200} placeholder="Website build: 50% deposit" /></label>
                <label>Amount (USD)<input name="amount" required inputMode="decimal" placeholder="2,400.00" /></label>
                <label>
                  Due date
                  <input name="dueDate" type="date" required defaultValue={addDays(workspace.paymentTermsDays)} />
                  <span className="hint">Defaults to your {workspace.paymentTermsDays}-day payment terms.</span>
                </label>
              </div>
              <div className="form-actions"><SubmitButton pending="Issuing…">Issue invoice</SubmitButton></div>
            </form>
          </section>

          <section className="card" id="project">
            <div className="card-head">
              <div><h2>New project</h2><p>Visible to {client.name} immediately, starting at the Planning stage.</p></div>
            </div>
            <form action={createProjectAction} className="card-body form">
              {hidden}
              <div className="form-row">
                <label>Project name<input name="name" required maxLength={120} placeholder="Spring campaign landing page" /></label>
                <label>Target date <span className="hint">Optional</span><input name="dueDate" type="date" /></label>
              </div>
              <label>Summary <span className="hint">Optional. Shown to the client at the top of the project.</span>
                <textarea name="description" maxLength={600} placeholder="Scope, key milestones, or what you need from the client." />
              </label>
              <div className="form-actions"><SubmitButton pending="Creating…">Create project</SubmitButton></div>
            </form>
          </section>
        </div>

        <div className="grid" style={{ alignContent: "start" }}>
          <section className="card">
            <div className="card-head">
              <div><h2>Portal access</h2><p>People at {client.name} who can sign in.</p></div>
            </div>
            {data.users.length === 0 ? (
              <Empty icon="user" title="Nobody can sign in yet">Invite the billing contact so they can see projects and pay invoices.</Empty>
            ) : (
              <ul className="list">
                {data.users.map((u) => (
                  <li key={u.id}>
                    <span className="avatar" aria-hidden="true">{u.name.slice(0, 1)}</span>
                    <span className="grow"><span className="title">{u.name}</span><span className="muted tiny">{u.email}</span></span>
                  </li>
                ))}
              </ul>
            )}
            <form action={addUserAction} className="card-foot form">
              {hidden}
              <label>Name<input name="name" required maxLength={120} /></label>
              <label>Email<input name="email" type="email" required /></label>
              <SubmitButton className="btn secondary" pending="Inviting…">Invite to portal</SubmitButton>
              <p className="muted tiny">They get a temporary password, shown to you once.</p>
            </form>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Client details</h2><p>Used on invoices and notifications.</p></div></div>
            <form action={updateClientAction} className="card-body form">
              {hidden}
              <label>Company name<input name="name" required maxLength={120} defaultValue={client.name} /></label>
              <label>Billing contact name<input name="contactName" maxLength={120} defaultValue={client.contactName ?? ""} /></label>
              <label>Billing contact email<input name="email" type="email" required defaultValue={client.contactEmail} /></label>
              <div className="form-actions"><SubmitButton className="btn secondary">Save details</SubmitButton></div>
            </form>
          </section>

          <section className="card">
            <div className="card-head">
              <div><h2>History</h2><p>Changes on this account.</p></div>
              <Link href={`/admin/activity?client=${id}`} className="btn ghost sm">All</Link>
            </div>
            <Timeline rows={activity} />
          </section>
        </div>
      </div>
    </>
  );
}
