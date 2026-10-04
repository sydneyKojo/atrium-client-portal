import Link from "next/link";
import type { User } from "@/db/schema";
import { ACTIONS, listActivity } from "@/lib/activity";
import { listFiles, listProjects, PROJECT_STATUSES } from "@/lib/queries";
import { FileList, StatusProgress, Timeline } from "./blocks";
import { Icon } from "./icons";
import { Badge, dateLabel, dueLabel, Empty, PageHead, SearchBox, Segmented, STATUS_LABEL } from "./ui";

export async function ProjectsPage({ user, base, status = "all", q = "" }: { user: User; base: string; status?: string; q?: string }) {
  const isAdmin = user.role === "admin";
  const all = await listProjects(user, {});
  const rows = await listProjects(user, { status: status === "all" ? undefined : status, q: q.trim() });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHead
        title="Projects"
        lead={
          isAdmin
            ? "Every engagement across your clients. Move a project through its stages from the project page; the client sees each change."
            : "Work we're doing for you, its current stage and the files we've shared."
        }
      />
      <section className="card">
        <div className="toolbar">
          <Segmented
            current={status}
            items={[
              { key: "all", href: base, label: "All", n: all.length },
              ...PROJECT_STATUSES.map((s) => ({ key: s, href: `${base}?status=${s}`, label: STATUS_LABEL[s]!, n: all.filter((r) => r.project.status === s).length })),
            ]}
          />
          <SearchBox action={base} q={q} placeholder={isAdmin ? "Project or client name" : "Project name"} hidden={status !== "all" ? { status } : undefined} />
        </div>
        {rows.length === 0 ? (
          q || status !== "all" ? (
            <Empty icon="search" title="No projects match" action={<Link href={base} className="btn secondary sm">Show all</Link>}>Try another stage or search term.</Empty>
          ) : (
            <Empty icon="folder" title="No projects yet">
              {isAdmin ? "Create projects from a client's page." : "Projects we start for you will appear here."}
            </Empty>
          )
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  {isAdmin && <th>Client</th>}
                  <th>Stage</th>
                  <th>Progress</th>
                  <th>Target date</th>
                  <th className="r">Files</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ project: p, clientName, fileCount }) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/projects/${p.id}`} className="row-link">{p.name}</Link>
                      {p.description && <span className="sub" style={{ maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.description}</span>}
                    </td>
                    {isAdmin && <td><Link href={`/admin/clients/${p.clientId}`}>{clientName}</Link></td>}
                    <td><Badge status={p.status} /></td>
                    <td style={{ minWidth: 120 }}><StatusProgress status={p.status} /></td>
                    <td className="nowrap">
                      {p.dueDate ? dateLabel(p.dueDate) : <span className="muted">Not set</span>}
                      {p.dueDate && p.status !== "done" && (
                        <span className="sub" style={p.dueDate < today ? { color: "var(--danger)" } : undefined}>{dueLabel(p.dueDate).replace("overdue", "late")}</span>
                      )}
                    </td>
                    <td className="r">{fileCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export async function FilesPage({ user, base, q = "" }: { user: User; base: string; q?: string }) {
  const isAdmin = user.role === "admin";
  const files = await listFiles(user, { q: q.trim() });
  return (
    <>
      <PageHead
        title="Files"
        lead={
          isAdmin
            ? "Everything shared with or uploaded by clients, newest first. Files live inside projects; upload from a project page."
            : "Deliverables we've shared and files your team has uploaded. To add a file, open the project it belongs to."
        }
      />
      <section className="card">
        <div className="toolbar">
          <SearchBox action={base} q={q} placeholder={isAdmin ? "File, project or client name" : "File or project name"} />
          <span className="muted small">{files.length} file{files.length === 1 ? "" : "s"}</span>
        </div>
        <FileList
          files={files.map((f) => ({
            ...f.file,
            uploader: f.uploader,
            context: (
              <Link href={`/projects/${f.projectId}`}>
                {isAdmin ? `${f.clientName} · ` : ""}
                {f.projectName}
              </Link>
            ),
          }))}
          empty={
            q ? (
              <Empty icon="search" title="No files match" action={<Link href={base} className="btn secondary sm">Clear search</Link>}>Try part of the file name or the project.</Empty>
            ) : (
              <Empty icon="file" title="No files yet">Upload briefs, assets and deliverables from a project page. Everyone on that account can download them.</Empty>
            )
          }
        />
      </section>
    </>
  );
}

export async function ActivityPage({ user, base, action = "", clientId }: { user: User; base: string; action?: string; clientId?: number }) {
  const isAdmin = user.role === "admin";
  const rows = await listActivity(user, { limit: 200, action: action || undefined, clientId });
  const actions = isAdmin
    ? (Object.keys(ACTIONS) as (keyof typeof ACTIONS)[])
    : (["invoice.created", "invoice.paid", "project.status_changed", "file.uploaded"] as const);
  return (
    <>
      <PageHead
        title={isAdmin ? "Activity log" : "Activity"}
        lead={
          isAdmin
            ? "A permanent record of who did what and when, across the workspace. Use it to answer “when was this sent?” or “who changed that?”."
            : "Everything that happened on your account: invoices, payments, project updates and files."
        }
        actions={
          isAdmin ? (
            <a href={`/api/export/activity${action ? `?action=${action}` : ""}`} className="btn secondary"><Icon name="download" size="sm" /> Export CSV</a>
          ) : undefined
        }
      />
      <section className="card">
        <div className="toolbar">
          <form action={base} className="form-row" style={{ maxWidth: 520 }}>
            {clientId && <input type="hidden" name="client" value={clientId} />}
            <label className="sr-only" htmlFor="action-filter">Event type</label>
            <select id="action-filter" name="action" defaultValue={action}>
              <option value="">All events</option>
              {actions.map((a) => <option key={a} value={a}>{ACTIONS[a]}</option>)}
            </select>
            <button className="btn secondary">Filter</button>
          </form>
          {(action || clientId) && <Link href={base} className="btn ghost sm">Clear filters</Link>}
          <span className="muted small">Showing {rows.length} most recent</span>
        </div>
        <Timeline rows={rows} showClient={isAdmin} emptyText="No events match this filter yet." />
      </section>
    </>
  );
}
