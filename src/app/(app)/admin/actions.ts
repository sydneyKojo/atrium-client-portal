"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, t } from "@/db";
import { record } from "@/lib/activity";
import { hashPassword } from "@/lib/auth";
import { createInvoice, formatMoney, parseAmountToCents } from "@/lib/billing";
import { STATUS_LABEL } from "@/components/ui";
import { requireAdmin } from "@/lib/session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Every mutation refreshes the shared layout too (sidebar counts, notification bell), then redirects with a message.
const go = (path: string, msg?: { ok?: string; err?: string }): never => {
  revalidatePath("/", "layout");
  const q = msg?.err ? `?err=${encodeURIComponent(msg.err)}` : msg?.ok ? `?ok=${encodeURIComponent(msg.ok)}` : "";
  redirect(`${path}${q}`);
};
const clientPage = (id: number) => `/admin/clients/${id}`;

async function clientExists(id: number) {
  if (!Number.isInteger(id)) return null;
  return db.query.clients.findFirst({ where: eq(t.clients.id, id) });
}

export async function createClientAction(form: FormData) {
  const admin = await requireAdmin();
  const parsed = z
    .object({ name: z.string().min(1).max(120), contactName: z.string().max(120), email: z.email() })
    .safeParse({ name: str(form, "name"), contactName: str(form, "contactName"), email: str(form, "email") });
  if (!parsed.success) go("/admin/clients", { err: "Enter a company name and a valid billing contact email." });
  const { name, contactName, email } = parsed.data!;
  const [c] = await db.insert(t.clients).values({ name, contactName: contactName || null, contactEmail: email.toLowerCase() }).returning();
  await record(admin.id, c!.id, "client.created", `${name} added as a client`);
  go(clientPage(c!.id), { ok: `${name} is set up. Next: add a project and invite someone from their team.` });
}

export async function updateClientAction(form: FormData) {
  const admin = await requireAdmin();
  const id = Number(form.get("clientId"));
  const parsed = z
    .object({ name: z.string().min(1).max(120), contactName: z.string().max(120), email: z.email() })
    .safeParse({ name: str(form, "name"), contactName: str(form, "contactName"), email: str(form, "email") });
  if (!(await clientExists(id))) go("/admin/clients", { err: "That client no longer exists." });
  if (!parsed.success) go(clientPage(id), { err: "Enter a company name and a valid billing contact email." });
  const { name, contactName, email } = parsed.data!;
  await db.update(t.clients).set({ name, contactName: contactName || null, contactEmail: email.toLowerCase() }).where(eq(t.clients.id, id));
  await record(admin.id, id, "client.updated", `${name}'s details updated`);
  go(clientPage(id), { ok: "Client details saved." });
}

export async function addUserAction(form: FormData) {
  const admin = await requireAdmin();
  const clientId = Number(form.get("clientId"));
  const client = await clientExists(clientId);
  if (!client) go("/admin/clients", { err: "That client no longer exists." });
  const parsed = z.object({ name: z.string().min(1).max(120), email: z.email() }).safeParse({ name: str(form, "name"), email: str(form, "email") });
  if (!parsed.success) go(clientPage(clientId), { err: "Enter the person's name and a valid email." });
  // A one-time password shown once to the admin. In production this becomes an emailed invite link.
  const tempPassword = randomBytes(9).toString("base64url");
  try {
    await db.insert(t.users).values({
      name: parsed.data!.name,
      email: parsed.data!.email.toLowerCase(),
      passwordHash: await hashPassword(tempPassword),
      role: "client",
      clientId,
    });
  } catch {
    go(clientPage(clientId), { err: "Someone with that email already has an account." });
  }
  await record(admin.id, clientId, "user.added", `${parsed.data!.name} invited to ${client!.name}'s portal`);
  // Kept out of the URL (and so out of logs and history); readable on this client's page for one minute.
  (await cookies()).set("portal_flash", `${parsed.data!.name} can now sign in as ${parsed.data!.email.toLowerCase()} with the temporary password ${tempPassword}. Share it privately; it is shown only once.`, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 60,
    path: clientPage(clientId),
  });
  go(clientPage(clientId));
}

export async function createProjectAction(form: FormData) {
  const admin = await requireAdmin();
  const clientId = Number(form.get("clientId"));
  const client = await clientExists(clientId);
  if (!client) go("/admin/clients", { err: "That client no longer exists." });
  const name = str(form, "name").slice(0, 120);
  const description = str(form, "description").slice(0, 600);
  const due = str(form, "dueDate");
  if (!name) go(clientPage(clientId), { err: "Give the project a name." });
  await db.insert(t.projects).values({ clientId, name, description: description || null, dueDate: date.safeParse(due).success ? due : null });
  await record(admin.id, clientId, "project.created", `New project: ${name}`);
  go(clientPage(clientId), { ok: `${name} created. ${client!.name} can see it in their portal now.` });
}

export async function setProjectStatusAction(form: FormData) {
  const admin = await requireAdmin();
  const projectId = Number(form.get("projectId"));
  const status = z.enum(["planning", "in_progress", "review", "done"]).safeParse(form.get("status"));
  const project = Number.isInteger(projectId) ? await db.query.projects.findFirst({ where: eq(t.projects.id, projectId) }) : undefined;
  if (!project || !status.success) go("/admin/projects", { err: "That project or status was not recognised." });
  if (project!.status !== status.data) {
    await db.update(t.projects).set({ status: status.data! }).where(eq(t.projects.id, projectId));
    await record(admin.id, project!.clientId, "project.status_changed", `${project!.name} moved to ${STATUS_LABEL[status.data!]}`);
  }
  revalidatePath(`/projects/${projectId}`);
  go(`/projects/${projectId}`, { ok: `Status set to ${STATUS_LABEL[status.data!]}.` });
}

export async function createInvoiceAction(form: FormData) {
  const admin = await requireAdmin();
  const clientId = Number(form.get("clientId"));
  if (!(await clientExists(clientId))) go("/admin/clients", { err: "That client no longer exists." });
  const cents = parseAmountToCents(str(form, "amount"));
  const description = str(form, "description").slice(0, 200);
  const due = date.safeParse(str(form, "dueDate"));
  if (!description) go(clientPage(clientId), { err: "Describe what the invoice is for." });
  if (!cents) go(clientPage(clientId), { err: "Enter an amount like 1250 or 1,250.00 (up to $1,000,000)." });
  if (!due.success) go(clientPage(clientId), { err: "Choose a due date." });
  const inv = await createInvoice({ clientId, description, amountCents: cents!, dueDate: due.data! });
  await record(admin.id, clientId, "invoice.created", `${inv.number} issued: ${formatMoney(inv.amountCents)} for ${description}`);
  go(`/invoices/${inv.id}`, { ok: `${inv.number} issued. The client can view and pay it in their portal.` });
}

export async function voidInvoiceAction(form: FormData) {
  const admin = await requireAdmin();
  const invoiceId = Number(form.get("invoiceId"));
  const [inv] = await db
    .update(t.invoices)
    .set({ status: "void" })
    .where(and(eq(t.invoices.id, invoiceId), eq(t.invoices.status, "open")))
    .returning();
  if (!inv) go(`/invoices/${invoiceId}`, { err: "Only open invoices can be voided." });
  await record(admin.id, inv!.clientId, "invoice.voided", `${inv!.number} voided (${formatMoney(inv!.amountCents)})`);
  go(`/invoices/${invoiceId}`, { ok: `${inv!.number} voided. It stays on record but can no longer be paid.` });
}

export async function updateWorkspaceAction(form: FormData) {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      name: z.string().min(1).max(80),
      supportEmail: z.email(),
      paymentTermsDays: z.coerce.number().int().min(0).max(120),
      invoiceNote: z.string().max(300),
    })
    .safeParse({
      name: str(form, "name"),
      supportEmail: str(form, "supportEmail"),
      paymentTermsDays: str(form, "paymentTermsDays"),
      invoiceNote: str(form, "invoiceNote"),
    });
  if (!parsed.success) go("/admin/settings", { err: "Check the fields: a name, a valid email and payment terms between 0 and 120 days." });
  await db.update(t.workspace).set({ ...parsed.data!, supportEmail: parsed.data!.supportEmail.toLowerCase(), updatedAt: new Date() }).where(eq(t.workspace.id, 1));
  await record(admin.id, null, "workspace.updated", "Workspace settings updated");
  revalidatePath("/", "layout");
  go("/admin/settings", { ok: "Settings saved. Clients see the new details straight away." });
}
