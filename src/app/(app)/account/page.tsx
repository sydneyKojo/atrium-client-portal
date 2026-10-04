import { SubmitButton } from "@/components/client";
import { Flash, PageHead } from "@/components/ui";
import { getClient } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { changePasswordAction, updateProfileAction } from "./actions";

export const metadata = { title: "Account · Atrium" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireUser();
  const [{ ok, err }, company] = await Promise.all([searchParams, user.clientId ? getClient(user.clientId) : null]);
  return (
    <>
      <PageHead title="Account & security" lead="Your profile and sign-in details. Changes apply only to you." />
      <Flash ok={ok} err={err} />
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <section className="card">
          <div className="card-head"><div><h2>Profile</h2><p>Shown to {user.role === "admin" ? "clients on invoices and in activity" : "the agency in activity and uploads"}.</p></div></div>
          <form action={updateProfileAction} className="card-body form">
            <label>Full name<input name="name" required maxLength={120} defaultValue={user.name} autoComplete="name" /></label>
            <label>Email <span className="hint">Your sign-in. Ask {user.role === "admin" ? "another admin" : "your account manager"} to change it.</span><input value={user.email} disabled /></label>
            <dl className="dl">
              <dt>Role</dt><dd>{user.role === "admin" ? "Agency admin: full access to every client" : `Client user at ${company?.name ?? ""}`}</dd>
              <dt>Member since</dt><dd>{user.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</dd>
            </dl>
            <div className="form-actions"><SubmitButton>Save profile</SubmitButton></div>
          </form>
        </section>
        <section className="card">
          <div className="card-head"><div><h2>Password</h2><p>At least 10 characters. Changing it signs you out on every other device.</p></div></div>
          <form action={changePasswordAction} className="card-body form">
            <label>Current password<input name="current" type="password" required autoComplete="current-password" /></label>
            <label>New password<input name="next" type="password" required minLength={10} autoComplete="new-password" /></label>
            <label>Confirm new password<input name="confirm" type="password" required minLength={10} autoComplete="new-password" /></label>
            <div className="form-actions"><SubmitButton pending="Updating…">Change password</SubmitButton></div>
          </form>
        </section>
      </div>
    </>
  );
}
