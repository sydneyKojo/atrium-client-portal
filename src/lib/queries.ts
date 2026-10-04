import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, t } from "@/db";
import type { User, Workspace } from "@/db/schema";

export const PROJECT_STATUSES = ["planning", "in_progress", "review", "done"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const INVOICE_FILTERS = ["all", "open", "overdue", "paid", "void"] as const;

const today = () => new Date().toISOString().slice(0, 10);
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function getWorkspace(): Promise<Workspace> {
  const ws = await db.query.workspace.findFirst();
  return ws ?? { id: 1, name: "Your Studio", supportEmail: "billing@example.com", paymentTermsDays: 14, invoiceNote: "", updatedAt: new Date() };
}

export async function getClient(id: number) {
  return db.query.clients.findFirst({ where: eq(t.clients.id, id) });
}

export async function clientDashboard(clientId: number) {
  const client = await getClient(clientId);
  if (!client) return null;
  const projects = await db
    .select()
    .from(t.projects)
    .where(eq(t.projects.clientId, clientId))
    .orderBy(asc(sql`${t.projects.status} = 'done'`), asc(t.projects.dueDate));
  const fileRows = projects.length
    ? await db
        .select({ file: t.files, uploader: t.users.name })
        .from(t.files)
        .leftJoin(t.users, eq(t.users.id, t.files.uploadedBy))
        .where(inArray(t.files.projectId, projects.map((p) => p.id)))
        .orderBy(desc(t.files.createdAt))
    : [];
  const invoices = await db.select().from(t.invoices).where(eq(t.invoices.clientId, clientId)).orderBy(desc(t.invoices.id));
  const users = await db
    .select({ id: t.users.id, name: t.users.name, email: t.users.email, createdAt: t.users.createdAt })
    .from(t.users)
    .where(eq(t.users.clientId, clientId));
  const open = invoices.filter((i) => i.status === "open");
  return {
    client,
    users,
    invoices,
    outstandingCents: open.reduce((s, i) => s + i.amountCents, 0),
    overdueCents: open.filter((i) => i.dueDate < today()).reduce((s, i) => s + i.amountCents, 0),
    paidCents: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amountCents, 0),
    nextDue: open.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null,
    projects: projects.map((p) => ({ ...p, files: fileRows.filter((f) => f.file.projectId === p.id).map((f) => ({ ...f.file, uploader: f.uploader })) })),
  };
}

export async function adminOverview() {
  const [totals] = (await db.execute(sql`
    select
      coalesce(sum(amount_cents) filter (where status = 'open'), 0)::int as outstanding,
      coalesce(sum(amount_cents) filter (where status = 'open' and due_date < to_char(now(), 'YYYY-MM-DD')), 0)::int as overdue,
      coalesce(sum(amount_cents) filter (where status = 'paid' and paid_at >= date_trunc('month', now())), 0)::int as paid_this_month,
      count(*) filter (where status = 'open')::int as open_count,
      coalesce(sum(amount_cents) filter (where status = 'open' and due_date >= to_char(now(), 'YYYY-MM-DD')), 0)::int as aging_current,
      coalesce(sum(amount_cents) filter (where status = 'open' and due_date < to_char(now(), 'YYYY-MM-DD')
        and due_date >= to_char(now() - interval '30 days', 'YYYY-MM-DD')), 0)::int as aging_1_30,
      coalesce(sum(amount_cents) filter (where status = 'open' and due_date < to_char(now() - interval '30 days', 'YYYY-MM-DD')
        and due_date >= to_char(now() - interval '60 days', 'YYYY-MM-DD')), 0)::int as aging_31_60,
      coalesce(sum(amount_cents) filter (where status = 'open' and due_date < to_char(now() - interval '60 days', 'YYYY-MM-DD')), 0)::int as aging_60_plus
    from invoices`)) as unknown as [Record<string, number>];
  const statusRows = (await db.execute(sql`select status, count(*)::int as n from projects group by status`)) as unknown as {
    status: ProjectStatus;
    n: number;
  }[];
  const projectCounts = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, statusRows.find((r) => r.status === s)?.n ?? 0])) as Record<
    ProjectStatus,
    number
  >;
  const dueSoon = await db
    .select({ invoice: t.invoices, clientName: t.clients.name })
    .from(t.invoices)
    .innerJoin(t.clients, eq(t.clients.id, t.invoices.clientId))
    .where(eq(t.invoices.status, "open"))
    .orderBy(asc(t.invoices.dueDate))
    .limit(5);
  const [{ clients }] = (await db.execute(sql`select count(*)::int as clients from clients`)) as unknown as [{ clients: number }];
  return { totals: totals!, projectCounts, dueSoon, clientCount: clients };
}

export async function listClients(q = "") {
  const where = q ? or(ilike(t.clients.name, like(q)), ilike(t.clients.contactEmail, like(q)), ilike(t.clients.contactName, like(q))) : undefined;
  return db
    .select({
      id: t.clients.id,
      name: t.clients.name,
      contactName: t.clients.contactName,
      contactEmail: t.clients.contactEmail,
      createdAt: t.clients.createdAt,
      activeProjects: sql<number>`(select count(*)::int from projects p where p.client_id = clients.id and p.status <> 'done')`,
      outstandingCents: sql<number>`(select coalesce(sum(amount_cents), 0)::int from invoices i where i.client_id = clients.id and i.status = 'open')`,
      overdueCents: sql<number>`(select coalesce(sum(amount_cents), 0)::int from invoices i where i.client_id = clients.id and i.status = 'open' and i.due_date < to_char(now(), 'YYYY-MM-DD'))`,
      users: sql<number>`(select count(*)::int from users u where u.client_id = clients.id)`,
    })
    .from(t.clients)
    .where(where)
    .orderBy(asc(t.clients.name));
}

function scope(user: User, column: typeof t.invoices.clientId | typeof t.projects.clientId): SQL | undefined {
  return user.role === "admin" ? undefined : eq(column, user.clientId!);
}

export async function listInvoices(user: User, opts: { status?: string; q?: string; clientId?: number } = {}) {
  const f: (SQL | undefined)[] = [scope(user, t.invoices.clientId)];
  if (opts.clientId) f.push(eq(t.invoices.clientId, opts.clientId));
  if (opts.status === "overdue") f.push(and(eq(t.invoices.status, "open"), sql`${t.invoices.dueDate} < ${today()}`));
  else if (opts.status === "open" || opts.status === "paid" || opts.status === "void") f.push(eq(t.invoices.status, opts.status));
  if (opts.q) f.push(or(ilike(t.invoices.number, like(opts.q)), ilike(t.invoices.description, like(opts.q)), ilike(t.clients.name, like(opts.q))));
  return db
    .select({ invoice: t.invoices, clientName: t.clients.name })
    .from(t.invoices)
    .innerJoin(t.clients, eq(t.clients.id, t.invoices.clientId))
    .where(and(...f))
    .orderBy(desc(t.invoices.id));
}

export async function listProjects(user: User, opts: { status?: string; q?: string } = {}) {
  const f: (SQL | undefined)[] = [scope(user, t.projects.clientId)];
  if (opts.status && (PROJECT_STATUSES as readonly string[]).includes(opts.status)) f.push(eq(t.projects.status, opts.status as ProjectStatus));
  if (opts.q) f.push(or(ilike(t.projects.name, like(opts.q)), ilike(t.clients.name, like(opts.q))));
  return db
    .select({
      project: t.projects,
      clientName: t.clients.name,
      fileCount: sql<number>`(select count(*)::int from files f where f.project_id = projects.id)`,
    })
    .from(t.projects)
    .innerJoin(t.clients, eq(t.clients.id, t.projects.clientId))
    .where(and(...f))
    .orderBy(asc(sql`${t.projects.status} = 'done'`), asc(t.projects.dueDate));
}

export async function getProject(id: number) {
  const [row] = await db
    .select({ project: t.projects, clientName: t.clients.name })
    .from(t.projects)
    .innerJoin(t.clients, eq(t.clients.id, t.projects.clientId))
    .where(eq(t.projects.id, id));
  if (!row) return null;
  const files = await db
    .select({ file: t.files, uploader: t.users.name, uploaderRole: t.users.role })
    .from(t.files)
    .leftJoin(t.users, eq(t.users.id, t.files.uploadedBy))
    .where(eq(t.files.projectId, id))
    .orderBy(desc(t.files.createdAt));
  return { ...row, files };
}

export async function listFiles(user: User, opts: { q?: string } = {}) {
  const f: (SQL | undefined)[] = [scope(user, t.projects.clientId)];
  if (opts.q) f.push(or(ilike(t.files.name, like(opts.q)), ilike(t.projects.name, like(opts.q)), ilike(t.clients.name, like(opts.q))));
  return db
    .select({ file: t.files, projectName: t.projects.name, projectId: t.projects.id, clientName: t.clients.name, uploader: t.users.name })
    .from(t.files)
    .innerJoin(t.projects, eq(t.projects.id, t.files.projectId))
    .innerJoin(t.clients, eq(t.clients.id, t.projects.clientId))
    .leftJoin(t.users, eq(t.users.id, t.files.uploadedBy))
    .where(and(...f))
    .orderBy(desc(t.files.createdAt))
    .limit(200);
}

export async function getInvoice(id: number) {
  const [row] = await db
    .select({ invoice: t.invoices, client: t.clients })
    .from(t.invoices)
    .innerJoin(t.clients, eq(t.clients.id, t.invoices.clientId))
    .where(eq(t.invoices.id, id));
  return row ?? null;
}

export async function search(user: User, q: string) {
  if (q.trim().length < 2) return { clients: [], projects: [], invoices: [], files: [] };
  const [clients, projects, invoices, files] = await Promise.all([
    user.role === "admin" ? listClients(q) : Promise.resolve([]),
    listProjects(user, { q }),
    listInvoices(user, { q }),
    listFiles(user, { q }),
  ]);
  return { clients: clients.slice(0, 8), projects: projects.slice(0, 8), invoices: invoices.slice(0, 8), files: files.slice(0, 8) };
}
