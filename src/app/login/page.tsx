import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitButton, ThemeToggle } from "@/components/client";
import { Icon, Logo } from "@/components/icons";
import { currentUser } from "@/lib/session";
import { loginAction } from "../actions";

export const metadata = { title: "Sign in · Atrium" };

const DEMO = [
  { email: "admin@demo.test", who: "Agency admin", what: "Run the studio: clients, billing, projects" },
  { email: "client@demo.test", who: "Client · Northwind Bakery", what: "Has an unpaid invoice and an active project" },
  { email: "client2@demo.test", who: "Client · Bluebird Fitness", what: "A newer client in the planning stage" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; email?: string; signedOut?: string }> }) {
  const user = await currentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/portal");
  const { error, email, signedOut } = await searchParams;
  const demo = process.env.DEMO_MODE === "true";

  return (
    <div className="auth">
      <aside className="auth-side photo">
        <Link href="/" aria-label="Atrium home"><Logo onDark /></Link>
        <div style={{ display: "grid", gap: 24 }}>
          <h2>Every client&apos;s projects, files and invoices, in one private place.</h2>
          <ul>
            <li><Icon name="layers" /> <span>Clients see exactly where their project stands, without another status email.</span></li>
            <li><Icon name="card" /> <span>Invoices are paid by card in two clicks and reconciled automatically.</span></li>
            <li><Icon name="shield" /> <span>Each client sees only their own work. Every change is on record.</span></li>
          </ul>
        </div>
        <p style={{ fontSize: 13, opacity: 0.8 }}>Built for agencies, studios and freelancers.</p>
      </aside>

      <main className="auth-main" style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: 20, right: 20 }}><ThemeToggle /></div>
        <div className="auth-card">
          <div>
            <h1>Sign in</h1>
            <p className="muted">Use the email your agency invited you with.</p>
          </div>
          {error && <div className="flash err" role="alert"><Icon name="alert" size="sm" /><span>That email and password don&apos;t match an account. Check for typos, or ask your account manager to resend your invite.</span></div>}
          {signedOut && !error && <div className="flash ok" role="status"><Icon name="checkCircle" size="sm" /><span>You&apos;ve been signed out.</span></div>}
          <form action={loginAction} className="form card card-pad">
            <label>Work email<input name="email" type="email" autoComplete="email" required defaultValue={email} autoFocus /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
            <SubmitButton className="btn lg" pending="Signing in…">Sign in</SubmitButton>
            <p className="muted tiny">Forgot your password? Your account manager can reset it from your client page.</p>
          </form>

          {demo && (
            <section className="demo-accounts" aria-labelledby="demo-h">
              <h2 id="demo-h" className="small muted" style={{ fontWeight: 600 }}>Explore the demo: sign in as</h2>
              {DEMO.map((d) => (
                <form key={d.email} action={loginAction}>
                  <input type="hidden" name="email" value={d.email} />
                  <input type="hidden" name="password" value="demo-password" />
                  <button className="btn secondary" style={{ width: "100%", justifyContent: "space-between", textAlign: "left" }}>
                    <span><span className="strong" style={{ display: "block" }}>{d.who}</span><span className="muted tiny" style={{ fontWeight: 400 }}>{d.what}</span></span>
                    <Icon name="arrowRight" size="sm" />
                  </button>
                </form>
              ))}
            </section>
          )}
          <p className="muted tiny" style={{ textAlign: "center" }}><Link href="/">← About Atrium</Link></p>
        </div>
      </main>
    </div>
  );
}
