"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Sidebar link that marks itself as the current page.
export function NavLink({ href, exact, children }: { href: string; exact?: boolean; children: ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}

// Opens and closes the off-canvas sidebar on small screens; closes on navigation and Escape.
export function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="shell" data-nav={open ? "open" : "closed"} onClick={(e) => open && e.target === e.currentTarget && setOpen(false)}>
      <button
        type="button"
        className="icon-btn mobile-nav-toggle"
        style={{ position: "fixed", top: 10, left: 10, zIndex: 25 }}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
          <path d={open ? "M18 6 6 18M6 6l12 12" : "M3 6h18M3 12h18M3 18h18"} />
        </svg>
      </button>
      {children}
    </div>
  );
}

// Submit button that shows progress while its form's server action runs, and prevents double submits.
export function SubmitButton({ children, pending, className = "btn" }: { children: ReactNode; pending?: string; className?: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button className={className} disabled={busy} aria-busy={busy}>
      {busy ? (pending ?? "Saving…") : children}
    </button>
  );
}

// A destructive action asks first. The dialog submits the surrounding form only on confirm.
export function ConfirmButton({
  label,
  title,
  body,
  confirm,
  className = "btn secondary sm",
}: {
  label: ReactNode;
  title: string;
  body: string;
  confirm: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={btn} className={className} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog ref={ref} aria-labelledby={`${title}-t`}>
        <div className="dlg-body">
          <h2 id={`${title}-t`}>{title}</h2>
          <p className="muted">{body}</p>
        </div>
        <div className="dlg-foot">
          <button type="button" className="btn secondary" onClick={() => ref.current?.close()}>Cancel</button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              ref.current?.close();
              btn.current?.form?.requestSubmit();
            }}
          >
            {confirm}
          </button>
        </div>
      </dialog>
    </>
  );
}

export function PrintButton() {
  return (
    <button type="button" className="btn secondary" onClick={() => window.print()}>
      <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />
      </svg>
      Print or save PDF
    </button>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn secondary sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

// Light by default; the choice is saved in localStorage and applied before paint by the script in the root layout.
export function ThemeToggle() {
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Switch between light and dark mode"
      title="Light / dark mode"
      onClick={() => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("theme", next);
        } catch {}
      }}
    >
      <svg className="icon-sm moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      <svg className="icon-sm sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true"><path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>
    </button>
  );
}
