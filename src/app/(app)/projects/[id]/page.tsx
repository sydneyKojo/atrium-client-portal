import { notFound } from "next/navigation";
import { FileList, StatusProgress, Timeline, UploadForm } from "@/components/blocks";
import { SubmitButton } from "@/components/client";
import { Badge, dateLabel, dueLabel, Empty, Flash, PageHead, STATUS_LABEL } from "@/components/ui";
import { listActivity } from "@/lib/activity";
import { getProject, getWorkspace, PROJECT_STATUSES } from "@/lib/queries";
import { requireClientAccess, requireUser } from "@/lib/session";
import { setProjectStatusAction } from "../../admin/actions";

const STAGE_HELP: Record<string, string> = {
  planning: "Scope, timeline and inputs are being agreed.",
  in_progress: "The team is actively working on it.",
  review: "Ready for your feedback before final delivery.",
  done: "Delivered. Final files are attached below.",
};

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  const data = Number.isInteger(id) ? await getProject(id) : null;
  if (!data) notFound();
  const user = await requireClientAccess(data.project.clientId);
  const isAdmin = user.role === "admin";
  const { project: p, clientName } = data;
  const [{ ok, err }, history, workspace] = await Promise.all([searchParams, listActivity(user, { clientId: p.clientId, limit: 40 }), getWorkspace()]);
  const projectHistory = history.filter((h) => h.summary.includes(p.name));

  return (
    <>
      <PageHead
        crumbs={isAdmin ? [{ href: "/admin/clients", label: "Clients" }, { href: `/admin/clients/${p.clientId}`, label: clientName }] : [{ href: "/portal/projects", label: "Projects" }]}
        title={p.name}
        lead={p.description ?? (isAdmin ? "No summary yet." : undefined)}
        actions={<Badge status={p.status} />}
      />
      <Flash ok={ok} err={err} />

      <div className="grid grid-main">
        <div className="grid" style={{ alignContent: "start" }}>
          <section className="card">
            <div className="card-head">
              <div><h2>Files</h2><p>{isAdmin ? `Shared with everyone at ${clientName}.` : "Download deliverables or upload anything we need from you."}</p></div>
              <span className="muted small">{data.files.length} file{data.files.length === 1 ? "" : "s"}</span>
            </div>
            <FileList
              files={data.files.map((f) => ({ ...f.file, uploader: f.uploaderRole === "client" ? `${f.uploader} (${clientName})` : f.uploader }))}
              empty={<Empty icon="file" title="No files yet">{isAdmin ? "Upload briefs, drafts and final deliverables here." : "Upload briefs, logins or content we've asked for; we're notified straight away."}</Empty>}
            />
            <div className="card-foot"><UploadForm projectId={p.id} projectName="this project" /></div>
          </section>
        </div>

        <div className="grid" style={{ alignContent: "start" }}>
          <section className="card">
            <div className="card-head"><div><h2>Stage</h2><p>{STAGE_HELP[p.status]}</p></div></div>
            <div className="card-body form">
              <StatusProgress status={p.status} />
              <div className="legend" style={{ marginTop: 0, justifyContent: "space-between" }}>
                {PROJECT_STATUSES.map((s) => <span key={s} className={s === p.status ? "strong" : "muted"}>{STATUS_LABEL[s]}</span>)}
              </div>
              <dl className="dl">
                <dt>Client</dt><dd>{clientName}</dd>
                <dt>Target date</dt>
                <dd>{p.dueDate ? <>{dateLabel(p.dueDate)} {p.status !== "done" && <span className="muted">({dueLabel(p.dueDate).replace("overdue", "late")})</span>}</> : "Not set"}</dd>
                <dt>Started</dt><dd>{dateLabel(p.createdAt)}</dd>
              </dl>
              {isAdmin && (
                <form action={setProjectStatusAction} className="form" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                  <input type="hidden" name="projectId" value={p.id} />
                  <label>
                    Move to stage
                    <select name="status" defaultValue={p.status}>
                      {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                    <span className="hint">{clientName} is notified of the change.</span>
                  </label>
                  <SubmitButton className="btn secondary">Update stage</SubmitButton>
                </form>
              )}
            </div>
          </section>
          <section className="card">
            <div className="card-head"><div><h2>Project history</h2></div></div>
            <Timeline rows={projectHistory} emptyText="Updates to this project will appear here." />
          </section>
          {!isAdmin && (
            <p className="muted small">
              Questions about this project? Email <a href={`mailto:${workspace.supportEmail}?subject=${encodeURIComponent(p.name)}`}>{workspace.supportEmail}</a>.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
