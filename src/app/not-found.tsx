import Link from "next/link";
import { Logo } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="auth-main" style={{ minHeight: "100vh" }}>
      <div className="auth-card" style={{ textAlign: "center", justifyItems: "center" }}>
        <Logo />
        <h1>We couldn&apos;t find that page</h1>
        <p className="muted">It may have been moved, or you may not have access to it. If someone sent you this link, check you&apos;re signed in with the right account.</p>
        <Link href="/login" className="btn">Go to your dashboard</Link>
      </div>
    </main>
  );
}
