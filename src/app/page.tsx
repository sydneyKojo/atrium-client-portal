import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/client";
import { Icon, Logo, type IconName } from "@/components/icons";
import { currentUser } from "@/lib/session";

export const metadata = { title: "Atrium · The client portal for agencies and studios" };

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: "layers", title: "Live project status", body: "Every project moves through Planning, In progress, In review and Delivered. Clients see the stage and target date without asking." },
  { icon: "file", title: "Files that stay with the work", body: "Upload drafts and deliverables to the project they belong to. Clients upload briefs and assets back, and you're notified." },
  { icon: "card", title: "Invoices paid by card", body: "Issue an invoice in seconds. Clients pay through Stripe Checkout, and it's marked paid the moment Stripe confirms." },
  { icon: "receipt", title: "Receivables at a glance", body: "Outstanding, overdue and collected this month, plus an ageing view that shows which money is late and by how long." },
  { icon: "bell", title: "Notified, never chased", body: "Clients hear about new invoices, files and stage changes. You hear when they pay or upload. Everything is on record." },
  { icon: "shield", title: "Private by design", body: "Each client sees only their own company. Unknown links return nothing, and files are always downloaded, never run." },
];

const AUDIENCE: { title: string; body: string }[] = [
  { title: "Design and web studios", body: "Share drafts and final files per project, and bill deposits and final payments against them." },
  { title: "Marketing agencies", body: "Run retainers for many clients at once and see who owes what on one screen." },
  { title: "Independent consultants", body: "Look as organised as a large firm, with a private portal instead of scattered threads." },
];

const FAQ = [
  { q: "Do my clients need to install anything?", a: "No. They sign in from any browser, on desktop or phone, with the email you invite them with." },
  { q: "How do card payments work?", a: "Atrium uses Stripe Checkout. Your client pays on Stripe's secure page, Stripe sends a signed confirmation, and the invoice is marked paid. Card details never touch Atrium. Standard Stripe fees apply." },
  { q: "Can one client see another client's work?", a: "No. Every page, file download and payment link checks that the signed-in person belongs to the client it's for. Anything else returns “not found”." },
  { q: "Where is the data stored?", a: "Atrium is a self-hosted Next.js application backed by PostgreSQL, so your data lives in your own database and hosting account." },
  { q: "Can I export my data?", a: "Yes. Invoices and the full activity log export to CSV, and every invoice prints or saves to PDF." },
];

function ProductStage() {
  const bars = [
    { l: "Not yet due", v: "$4,750", w: 93 },
    { l: "1–30 days late", v: "$5,100", w: 100, tone: "var(--warn)" },
    { l: "31–60 days late", v: "$0", w: 0 },
    { l: "60+ days late", v: "$600", w: 12, tone: "var(--danger)" },
  ];
  return (
    <div className="stage" aria-hidden="true">
      <div className="stage-frame">
        <div className="preview">
          <div className="preview-bar"><i /><i /><i /></div>
          <div className="preview-app">
            <div className="side">
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 14px" }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--ink)", color: "var(--ink-text)", display: "grid", placeItems: "center", fontFamily: "var(--serif)", fontSize: 14, flex: "none" }}>BS</span>
                <span><span className="strong" style={{ display: "block", fontSize: 13 }}>Brightline Studio</span><span className="muted tiny">Agency workspace</span></span>
              </div>
              {["Overview", "Clients", "Projects", "Invoices", "Files", "Activity log"].map((n, i) => (
                <span key={n} className={i === 0 ? "on" : undefined}>{n}</span>
              ))}
            </div>
            <div className="body">
              <div>
                <div className="serif" style={{ fontSize: 30, lineHeight: 1.1 }}>Good to see you, Alex</div>
                <div className="muted small" style={{ marginTop: 6 }}>Money owed, work in flight and what your clients did recently.</div>
              </div>
              <div className="kpis">
                {[["Outstanding", "$10,450", "6 open invoices"], ["Overdue", "$5,700", "Past the due date"], ["Collected this month", "$4,800", "Since the 1st"], ["Active clients", "4", "4 projects in progress"]].map(([l, v, h], i) => (
                  <div key={l} className={`card kpi${i === 1 ? " alert" : ""}`}>
                    <div className="label">{l}</div>
                    <div className="value" style={{ fontSize: 28 }}>{v}</div>
                    <div className="hint">{h}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-2" style={{ gap: 16 }}>
                <div className="card card-pad bars">
                  <div className="strong small">Receivables ageing</div>
                  {bars.map((b) => (
                    <div key={b.l} className="bar-row" style={{ gridTemplateColumns: "110px 1fr 56px" }}>
                      <span className="muted">{b.l}</span>
                      <span className="bar-track"><span className="bar-fill" style={{ width: `${b.w}%`, display: "block", background: b.tone }} /></span>
                      <span className="strong" style={{ textAlign: "right" }}>{b.v}</span>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <ul className="list">
                    <li><span className="grow"><span className="title">INV-0006 · Harbor &amp; Pine</span><span className="muted tiny">2 days overdue</span></span><span className="badge overdue">Overdue</span></li>
                    <li><span className="grow"><span className="title">Online ordering website</span><span className="muted tiny">Northwind Bakery</span></span><span className="badge in_progress">In progress</span></li>
                    <li><span className="grow"><span className="title">INV-0003 · Cobalt Labs</span><span className="muted tiny">Paid by card, 1 d ago</span></span><span className="badge paid">Paid</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const user = await currentUser();
  const dashboard = user ? (user.role === "admin" ? "/admin" : "/portal") : null;

  return (
    <>
      <header className="mk-nav">
        <div className="inner">
          <Link href="/" aria-label="Atrium home" style={{ color: "inherit" }}><Logo /></Link>
          <nav className="links" aria-label="Product">
            <a href="#features">Product</a>
            <a href="#how">How it works</a>
            <a href="#security">Security</a>
            <a href="#faq">FAQ</a>
          </nav>
          <span style={{ flex: 1 }} />
          <ThemeToggle />
          {dashboard ? (
            <Link href={dashboard} className="btn">Open dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn ghost">Sign in</Link>
              <Link href="/login" className="btn">Explore the demo</Link>
            </>
          )}
        </div>
      </header>

      <main>
        <div className="mk-wrap">
          <section className="mk-hero">
            <h1>Your clients&apos; work, <em>in one private place.</em></h1>
            <p className="sub">
              Atrium gives every client a calm, private portal for project progress, shared files and invoices they can pay by card,
              so your team stops writing status emails and chasing payments.
            </p>
            <div className="cta">
              <Link href={dashboard ?? "/login"} className="btn lg">{dashboard ? "Open your dashboard" : "Explore the live demo"} <Icon name="arrowRight" size="sm" /></Link>
              <a href="#how" className="btn secondary lg">See how it works</a>
            </div>
            <p className="fine">Sample data included. Sign in as the agency, or as one of its clients.</p>
          </section>
        </div>
        <ProductStage />

        <section className="mk-section">
          <div className="mk-wrap grid grid-2" style={{ gap: 48, alignItems: "start" }}>
            <div>
              <span className="kicker">The problem</span>
              <h2>Client work shouldn&apos;t live in your inbox.</h2>
            </div>
            <div className="compare" style={{ gridTemplateColumns: "1fr" }}>
              <p className="muted" style={{ fontSize: 17 }}>
                Status updates, file links and invoice reminders scattered across email and chat cost hours every week, and clients still ask where things stand.
              </p>
              <ul>
                {[
                  ["Clients check the project stage themselves, any time", "“Any update on the site?” emails every few days"],
                  ["Every file sits with its project, one click to download", "Final files lost in long threads and expired links"],
                  ["Invoices paid by card and marked paid automatically", "PDF invoices chased by hand"],
                  ["A complete history for every client", "No record of who changed what, or when"],
                ].map(([yes, no]) => (
                  <li key={yes} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 10 }}>
                    <span style={{ color: "var(--ok)" }}><Icon name="check" size="sm" /></span>
                    <span>{yes}<span className="muted small" style={{ display: "block", textDecoration: "line-through", textDecorationColor: "var(--line-strong)" }}>{no}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="photo-band" aria-label="An open arched doorway">
          <Image src="/images/arch-window.jpg" alt="" fill sizes="100vw" style={{ objectFit: "cover" }} />
          <div className="photo-band-text mk-wrap">
            <p>A front door your clients<br /><em>actually use.</em></p>
          </div>
        </section>

        <section className="mk-section alt" id="features">
          <div className="mk-wrap">
            <div className="intro">
              <span className="kicker">Product</span>
              <h2>Everything a client relationship needs. Nothing it doesn&apos;t.</h2>
              <p>Six capabilities that cover the whole cycle, from kickoff to final payment.</p>
            </div>
            <div className="features">
              {FEATURES.map((f) => (
                <div key={f.title} className="feature">
                  <span className="fi"><Icon name={f.icon} /></span>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mk-section" id="how">
          <div className="mk-wrap">
            <div className="intro">
              <span className="kicker">How it works</span>
              <h2>From new client to paid invoice, in four steps.</h2>
            </div>
            <ol className="steps" style={{ padding: 0, margin: 0 }}>
              <li><h3>Add the client</h3><p>Enter the company and billing contact, then invite their team. Each person gets their own sign-in.</p></li>
              <li><h3>Open a project</h3><p>Describe the scope and target date. The client sees it straight away and is told as it moves through each stage.</p></li>
              <li><h3>Share the work</h3><p>Upload drafts and deliverables to the project. Clients upload briefs back, and you&apos;re notified.</p></li>
              <li><h3>Get paid</h3><p>Issue an invoice with your standard terms. The client pays by card, and your receivables update themselves.</p></li>
            </ol>
          </div>
        </section>

        <section className="mk-section alt">
          <div className="mk-wrap grid grid-2" style={{ gap: 48 }}>
            <div>
              <span className="kicker">Who it&apos;s for</span>
              <h2>Built for teams who bill for expertise.</h2>
              <figure className="photo-card">
                <Image src="/images/studio-team.jpg" alt="Two colleagues reviewing work on a laptop" width={1400} height={788} sizes="(max-width: 720px) 100vw, 560px" />
              </figure>
            </div>
            <div style={{ display: "grid", gap: 0 }}>
              {AUDIENCE.map((a) => (
                <div key={a.title} style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
                  <h3 className="serif" style={{ fontSize: 23, fontWeight: 400 }}>{a.title}</h3>
                  <p className="muted" style={{ marginTop: 6 }}>{a.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mk-section" id="security">
          <div className="mk-wrap grid grid-2" style={{ gap: 48, alignItems: "center" }}>
            <div>
              <span className="kicker">Security</span>
              <h2>Your clients trust you with their work. Atrium keeps it that way.</h2>
            </div>
            <ul className="card list">
              <li><Icon name="shield" /><span className="grow"><span className="title">Strict client separation</span><span className="muted tiny">Every request checks the client it belongs to.</span></span></li>
              <li><Icon name="lock" /><span className="grow"><span className="title">Hashed passwords and sessions</span><span className="muted tiny">scrypt passwords; session tokens stored only as hashes.</span></span></li>
              <li><Icon name="card" /><span className="grow"><span className="title">Payments confirmed by Stripe</span><span className="muted tiny">Signed webhooks, never the browser, mark invoices paid.</span></span></li>
              <li><Icon name="activity" /><span className="grow"><span className="title">Full audit trail</span><span className="muted tiny">Who did what and when, exportable to CSV.</span></span></li>
            </ul>
          </div>
        </section>

        <section className="mk-section alt" id="faq">
          <div className="mk-wrap grid grid-2" style={{ gap: 48, alignItems: "start" }}>
            <div>
              <span className="kicker">FAQ</span>
              <h2>Questions agencies ask.</h2>
            </div>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <div className="mk-wrap" style={{ paddingTop: 88 }}>
          <section className="mk-cta">
            <h2>See it from both sides.</h2>
            <p style={{ maxWidth: 520 }}>Sign in as the agency to run billing, or as a client to see exactly what they see.</p>
            <Link href={dashboard ?? "/login"} className="btn lg">{dashboard ? "Open dashboard" : "Explore the demo"}</Link>
          </section>
        </div>
      </main>

      <footer className="mk-foot">
        <div className="mk-wrap inner">
          <Logo />
          <span>Client portal, file sharing and invoicing for agencies. Demo data is fictional.<br />
            Photos on Unsplash by Victoriano Izquierdo, Luca Severin and Vitaly Gariev.</span>
          <Link href="/login">Sign in</Link>
        </div>
      </footer>
    </>
  );
}
