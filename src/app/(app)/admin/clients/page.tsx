import Link from "next/link";
import { money } from "@/components/blocks";
import { SubmitButton } from "@/components/client";
import { Icon } from "@/components/icons";
import { dateLabel, Empty, Flash, PageHead, SearchBox } from "@/components/ui";
import { listClients } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { createClientAction } from "../actions";

export const metadata = { title: "Clients · Atrium" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; err?: string }> }) {
  await requireAdmin();
  const { q = "", ok, err } = await searchParams;
  const clients = await listClients(q.trim());

  return (
    <>
      <PageHead
        title="Clients"
        lead="Each client gets a private portal with their own projects, files and invoices. Open a client to manage their work and team access."
        actions={<a href="#new" className="btn"><Icon name="plus" size="sm" /> Add client</a>}
      />
      <Flash ok={ok} err={err} />

      <section className="card">
        <div className="toolbar">
          <SearchBox action="/admin/clients" q={q} placeholder="Search by company, contact or email" />
          <span className="muted small">{clients.length} client{clients.length === 1 ? "" : "s"}{q && ` matching “${q}”`}</span>
        </div>
        {clients.length === 0 ? (
          q ? (
            <Empty icon="search" title="No matching clients" action={<Link href="/admin/clients" className="btn secondary sm">Clear search</Link>}>
              Nothing matches “{q}”. Try part of the company name or the contact&apos;s email.
            </Empty>
          ) : (
            <Empty icon="users" title="Add your first client" action={<a href="#new" className="btn sm">Add client</a>}>
              A client is a company you work for. Once added, you can create projects, share files, issue invoices and invite their team.
            </Empty>
          )
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Billing contact</th>
                  <th className="r">Active projects</th>
                  <th className="r">Portal users</th>
                  <th className="r">Outstanding</th>
                  <th>Client since</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/admin/clients/${c.id}`} className="row-link">{c.name}</Link></td>
                    <td>
                      {c.contactName ?? <span className="muted">No name</span>}
                      <span className="sub">{c.contactEmail}</span>
                    </td>
                    <td className="r">{c.activeProjects}</td>
                    <td className="r">{c.users === 0 ? <span className="muted" title="Nobody from this client can sign in yet">None</span> : c.users}</td>
                    <td className="r">
                      <span className="strong">{money(c.outstandingCents)}</span>
                      {c.overdueCents > 0 && <span className="sub" style={{ color: "var(--danger)" }}>{money(c.overdueCents)} overdue</span>}
                    </td>
                    <td className="nowrap muted">{dateLabel(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" id="new">
        <div className="card-head">
          <div>
            <h2>Add a client</h2>
            <p>Invoices are addressed to the billing contact. You can invite more people from their page afterwards.</p>
          </div>
        </div>
        <form action={createClientAction} className="card-body form">
          <div className="form-row">
            <label>Company name<input name="name" required maxLength={120} placeholder="e.g. Northwind Bakery" /></label>
            <label>Billing contact name <span className="hint">Optional</span><input name="contactName" maxLength={120} placeholder="e.g. Nora Lind" /></label>
            <label>Billing contact email<input name="email" type="email" required placeholder="accounts@client.com" /></label>
          </div>
          <div className="form-actions"><SubmitButton pending="Adding…">Add client</SubmitButton></div>
        </form>
      </section>
    </>
  );
}
