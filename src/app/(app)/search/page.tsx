import Link from "next/link";
import { money } from "@/components/blocks";
import { Badge, dateLabel, Empty, PageHead } from "@/components/ui";
import { invoiceState } from "@/lib/billing";
import { search } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Search · Atrium" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const r = await search(user, q);
  const total = r.clients.length + r.projects.length + r.invoices.length + r.files.length;

  return (
    <>
      <PageHead title={q ? `Results for “${q}”` : "Search"} lead={q ? `${total} result${total === 1 ? "" : "s"}` : "Type at least two characters in the search bar above."} />
      <form action="/search" className="card card-pad form-row" role="search" style={{ alignItems: "end" }}>
        <label>Search everything<input name="q" defaultValue={q} autoFocus placeholder="Client, project, invoice number or file name" /></label>
        <div><button className="btn">Search</button></div>
      </form>
      {q.length >= 2 && total === 0 && (
        <section className="card"><Empty icon="search" title="Nothing found">Check the spelling, or search by invoice number (e.g. INV-0002), project or file name.</Empty></section>
      )}
      {r.clients.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Clients</h2></div>
          <ul className="list">
            {r.clients.map((c) => (
              <li key={c.id}><span className="grow"><Link href={`/admin/clients/${c.id}`} className="title">{c.name}</Link><span className="muted tiny">{c.contactEmail}</span></span><span className="strong num">{money(c.outstandingCents)} due</span></li>
            ))}
          </ul>
        </section>
      )}
      {r.projects.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Projects</h2></div>
          <ul className="list">
            {r.projects.map(({ project: p, clientName }) => (
              <li key={p.id}><span className="grow"><Link href={`/projects/${p.id}`} className="title">{p.name}</Link><span className="muted tiny">{clientName}</span></span><Badge status={p.status} /></li>
            ))}
          </ul>
        </section>
      )}
      {r.invoices.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Invoices</h2></div>
          <ul className="list">
            {r.invoices.map(({ invoice: i, clientName }) => (
              <li key={i.id}><span className="grow"><Link href={`/invoices/${i.id}`} className="title">{i.number} · {i.description}</Link><span className="muted tiny">{clientName} · due {dateLabel(i.dueDate)}</span></span><span className="strong num">{money(i.amountCents)}</span><Badge status={invoiceState(i)} /></li>
            ))}
          </ul>
        </section>
      )}
      {r.files.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Files</h2></div>
          <ul className="list">
            {r.files.map((f) => (
              <li key={f.file.id}><span className="grow"><a href={`/api/files/${f.file.id}`} className="title">{f.file.name}</a><span className="muted tiny"><Link href={`/projects/${f.projectId}`}>{f.projectName}</Link> · {f.clientName}</span></span></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
