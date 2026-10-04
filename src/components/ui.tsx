import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  in_progress: "In progress",
  review: "In review",
  done: "Delivered",
  open: "Open",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
};

export function Badge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status] ?? status}</span>;
}

// Hover or focus to read; keyboard reachable, announced to screen readers through aria-describedby.
export function Help({ children, id }: { children: ReactNode; id: string }) {
  return (
    <span className="help" tabIndex={0} aria-describedby={id}>
      <Icon name="help" size="sm" />
      <span className="tip" role="tooltip" id={id}>{children}</span>
    </span>
  );
}

export function Kpi({ label, value, hint, help, alert }: { label: string; value: string; hint?: string; help?: string; alert?: boolean }) {
  const id = `kpi-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className={`card kpi${alert ? " alert" : ""}`}>
      <div className="label">
        {label}
        {help && <Help id={id}>{help}</Help>}
      </div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function PageHead({
  title,
  lead,
  crumbs,
  actions,
}: {
  title: string;
  lead?: ReactNode;
  crumbs?: { href: string; label: string }[];
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {crumbs && (
          <nav className="crumbs" aria-label="Breadcrumb">
            {crumbs.map((c) => (
              <span key={c.href} className="crumbs">
                <Link href={c.href}>{c.label}</Link>
                <span aria-hidden="true">/</span>
              </span>
            ))}
          </nav>
        )}
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="glyph"><Icon name={icon} /></div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return (
    <div className={`flash ${err ? "err" : "ok"}`} role={err ? "alert" : "status"}>
      <Icon name={err ? "alert" : "checkCircle"} size="sm" />
      <span>{err ?? ok}</span>
    </div>
  );
}

// Filter tabs as plain links, so filters are shareable URLs and work without JavaScript.
export function Segmented({ items, current }: { items: { href: string; label: string; key: string; n?: number }[]; current: string }) {
  return (
    <nav className="segmented" aria-label="Filter">
      {items.map((i) => (
        <Link key={i.key} href={i.href} aria-current={i.key === current ? "true" : undefined}>
          {i.label}
          {i.n !== undefined && <span className="n">{i.n}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function SearchBox({ action, q, placeholder, hidden }: { action: string; q?: string; placeholder: string; hidden?: Record<string, string> }) {
  return (
    <form action={action} role="search">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} />
      <button className="btn secondary">Search</button>
    </form>
  );
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

export function fileKind(name: string): string {
  const ext = name.split(".").pop()?.toUpperCase() ?? "";
  return ext.length > 0 && ext.length <= 4 && ext !== name.toUpperCase() ? ext : "FILE";
}

export function dateLabel(d: Date | string, withTime = false): string {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00Z`) : d;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: typeof d === "string" ? "UTC" : undefined,
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function relative(d: Date): string {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} d ago`;
  return dateLabel(d);
}

export function dueLabel(dueDate: string, today = new Date().toISOString().slice(0, 10)): string {
  const days = Math.round((Date.parse(dueDate) - Date.parse(today)) / 86_400_000);
  if (days === 0) return "Due today";
  if (days > 0) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  return `${-days} day${days === -1 ? "" : "s"} overdue`;
}
