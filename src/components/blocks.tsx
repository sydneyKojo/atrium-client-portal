import Link from "next/link";
import type { Invoice } from "@/db/schema";
import { ACTIONS, type ActivityRow } from "@/lib/activity";
import { formatMoney, invoiceState } from "@/lib/billing";
import { formatBytes } from "@/lib/files";
import { Icon, type IconName } from "./icons";
import { Badge, dateLabel, dueLabel, Empty, fileKind, relative } from "./ui";

const NODE: Record<string, { icon: IconName; tone?: string }> = {
  "invoice.paid": { icon: "check", tone: "paid" },
  "invoice.created": { icon: "receipt" },
  "invoice.voided": { icon: "x", tone: "warn" },
  "file.uploaded": { icon: "file", tone: "file" },
  "project.created": { icon: "folder" },
  "project.status_changed": { icon: "layers" },
  "client.created": { icon: "users" },
  "client.updated": { icon: "users" },
  "user.added": { icon: "user" },
  "workspace.updated": { icon: "settings" },
  "account.password_changed": { icon: "lock" },
};

export function Timeline({
  rows,
  showClient,
  unreadSince,
  emptyText = "Activity will appear here as projects, files and invoices change.",
}: {
  rows: ActivityRow[];
  showClient?: boolean;
  unreadSince?: Date;
  emptyText?: string;
}) {
  if (rows.length === 0) return <Empty icon="activity" title="Nothing yet">{emptyText}</Empty>;
  return (
    <ul className="timeline">
      {rows.map((r) => {
        const n = NODE[r.action] ?? { icon: "activity" as IconName };
        const unread = unreadSince && r.createdAt > unreadSince;
        return (
          <li key={r.id} className={unread ? "unread" : undefined}>
            <span className={`node ${n.tone ?? ""}`}><Icon name={n.icon} size="sm" /></span>
            <div>
              <div className="strong small">{r.summary}</div>
              <div className="muted tiny">
                {ACTIONS[r.action as keyof typeof ACTIONS] ?? r.action}
                {" · "}
                {r.actorName ?? "System"}
                {showClient && r.clientName && r.clientId && (
                  <>
                    {" · "}
                    <Link href={`/admin/clients/${r.clientId}`}>{r.clientName}</Link>
                  </>
                )}
                {" · "}
                <time dateTime={r.createdAt.toISOString()} title={dateLabel(r.createdAt, true)}>{relative(r.createdAt)}</time>
                {unread && <span className="sr-only"> (new)</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function InvoiceTable({
  rows,
  showClient,
  canPay,
  stripe,
  empty,
}: {
  rows: { invoice: Invoice; clientName: string }[];
  showClient?: boolean;
  canPay?: boolean;
  stripe?: boolean;
  empty: React.ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Invoice</th>
            {showClient && <th>Client</th>}
            <th>Due</th>
            <th>Status</th>
            <th className="r">Amount</th>
            <th><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ invoice: inv, clientName }) => {
            const state = invoiceState(inv);
            return (
              <tr key={inv.id}>
                <td>
                  <Link href={`/invoices/${inv.id}`} className="row-link">{inv.number}</Link>
                  <span className="sub">{inv.description}</span>
                </td>
                {showClient && <td><Link href={`/admin/clients/${inv.clientId}`}>{clientName}</Link></td>}
                <td className="nowrap">
                  {dateLabel(inv.dueDate)}
                  {(state === "open" || state === "overdue") && <span className="sub">{dueLabel(inv.dueDate)}</span>}
                  {state === "paid" && inv.paidAt && <span className="sub">Paid {dateLabel(inv.paidAt)}</span>}
                </td>
                <td><Badge status={state} /></td>
                <td className="r strong">{formatMoney(inv.amountCents, inv.currency)}</td>
                <td className="r">
                  {canPay && inv.status === "open" ? (
                    <form action={`/api/invoices/${inv.id}/pay`} method="post">
                      <button className="btn sm">
                        <Icon name="card" size="sm" /> {stripe ? "Pay now" : "Pay (demo)"}
                      </button>
                    </form>
                  ) : (
                    <Link href={`/invoices/${inv.id}`} className="btn ghost sm">View</Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FileList({
  files,
  empty,
}: {
  files: { id: string; name: string; sizeBytes: number; createdAt: Date; uploader?: string | null; context?: React.ReactNode }[];
  empty: React.ReactNode;
}) {
  if (files.length === 0) return <>{empty}</>;
  return (
    <ul className="list">
      {files.map((f) => (
        <li key={f.id}>
          <span className="file-icon" aria-hidden="true">{fileKind(f.name)}</span>
          <span className="grow">
            <a href={`/api/files/${f.id}`} className="title">{f.name}</a>
            <span className="muted tiny">
              {formatBytes(f.sizeBytes)} · {f.uploader ? `${f.uploader}, ` : ""}{relative(f.createdAt)}
              {f.context && <> · {f.context}</>}
            </span>
          </span>
          <a href={`/api/files/${f.id}`} className="btn ghost sm" aria-label={`Download ${f.name}`}>
            <Icon name="download" size="sm" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function UploadForm({ projectId, projectName }: { projectId: number; projectName: string }) {
  return (
    <form action={`/api/projects/${projectId}/files`} method="post" encType="multipart/form-data" className="form" style={{ gap: 6 }}>
      <label htmlFor={`file-${projectId}`}>Add a file to {projectName}</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input id={`file-${projectId}`} type="file" name="file" required style={{ flex: "1 1 220px" }} aria-describedby={`file-hint-${projectId}`} />
        <button className="btn secondary"><Icon name="upload" size="sm" /> Upload</button>
      </div>
      <span className="hint muted small" id={`file-hint-${projectId}`}>Up to 20 MB. Everyone on this project can download it.</span>
    </form>
  );
}

const STEPS = ["planning", "in_progress", "review", "done"] as const;
export function StatusProgress({ status }: { status: string }) {
  const at = STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <div className="progress" role="img" aria-label={`Stage ${at + 1} of 4`}>
      {STEPS.map((s, i) => <span key={s} className={i <= at ? "on" : undefined} />)}
    </div>
  );
}

export function money(cents: number) {
  return formatMoney(cents);
}
