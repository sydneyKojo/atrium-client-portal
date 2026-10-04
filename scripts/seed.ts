import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db, sqlClient, t } from "../src/db";
import { DDL } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { addDays, createInvoice } from "../src/lib/billing";

// Demo workspace: a small design studio with four fictional clients. Dates are relative to today so the
// dashboard always shows a realistic mix of upcoming, overdue and paid invoices.
await sqlClient.unsafe(DDL);
await sqlClient`truncate clients, users, sessions, projects, files, invoices, activity restart identity cascade`;
await db
  .update(t.workspace)
  .set({ name: "Brightline Studio", supportEmail: "hello@brightline.example", paymentTermsDays: 14, invoiceNote: "Thank you for working with Brightline Studio. Payment is due within 14 days." })
  .where(eq(t.workspace.id, 1));

const ago = (days: number, hour = 10) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, (days * 7) % 60, 0, 0);
  return d;
};

const password = await hashPassword("demo-password");
const clients = await db
  .insert(t.clients)
  .values([
    { name: "Northwind Bakery", contactName: "Nora Lind", contactEmail: "nora@northwind.example", createdAt: ago(120) },
    { name: "Bluebird Fitness", contactName: "Ben Okafor", contactEmail: "ben@bluebird.example", createdAt: ago(21) },
    { name: "Harbor & Pine Realty", contactName: "Priya Raman", contactEmail: "accounts@harborpine.example", createdAt: ago(200) },
    { name: "Cobalt Labs", contactName: "Marcus Webb", contactEmail: "finance@cobaltlabs.example", createdAt: ago(75) },
  ])
  .returning();
const [northwind, bluebird, harbor, cobalt] = clients as [(typeof clients)[0], (typeof clients)[0], (typeof clients)[0], (typeof clients)[0]];

const users = await db
  .insert(t.users)
  .values([
    { email: "admin@demo.test", name: "Alex Morgan", passwordHash: password, role: "admin", createdAt: ago(240), notificationsSeenAt: ago(3) },
    { email: "client@demo.test", name: "Nora Lind", passwordHash: password, role: "client", clientId: northwind.id, createdAt: ago(118), notificationsSeenAt: ago(6) },
    { email: "client2@demo.test", name: "Ben Okafor", passwordHash: password, role: "client", clientId: bluebird.id, createdAt: ago(20), notificationsSeenAt: ago(20) },
    { email: "priya@harborpine.example", name: "Priya Raman", passwordHash: password, role: "client", clientId: harbor.id, createdAt: ago(198) },
  ])
  .returning();
const [alex, nora, ben, priya] = users as [(typeof users)[0], (typeof users)[0], (typeof users)[0], (typeof users)[0]];

const projects = await db
  .insert(t.projects)
  .values([
    { clientId: northwind.id, name: "Online ordering website", status: "in_progress", dueDate: addDays(24), createdAt: ago(60),
      description: "Customer-facing ordering site with daily menu, pickup slots and card payments. Includes CMS training for the shop team." },
    { clientId: northwind.id, name: "Brand refresh", status: "done", dueDate: addDays(-40), createdAt: ago(115),
      description: "New logo, colour palette and packaging labels. Final assets delivered in print and web formats." },
    { clientId: bluebird.id, name: "Class booking app", status: "planning", dueDate: addDays(60), createdAt: ago(18),
      description: "Mobile-friendly booking for classes and personal training, with reminders and a members' area." },
    { clientId: harbor.id, name: "Listings website redesign", status: "review", dueDate: addDays(6), createdAt: ago(90),
      description: "Faster property search, map view and enquiry forms routed to the right agent." },
    { clientId: harbor.id, name: "Monthly SEO retainer", status: "in_progress", dueDate: addDays(30), createdAt: ago(190),
      description: "Ongoing content and technical SEO. Reports shared on the first working day of each month." },
    { clientId: cobalt.id, name: "Investor deck and one-pager", status: "done", dueDate: addDays(-12), createdAt: ago(70),
      description: "Series A deck, one-page summary and data-room cover pages." },
  ])
  .returning();
const P = Object.fromEntries(projects.map((p) => [p.name, p]));

// Files: small real files so downloads work in the demo.
const uploadDir = join(process.cwd(), "uploads");
await mkdir(uploadDir, { recursive: true });
const files: [string, string, number, string, number][] = [
  ["Online ordering website", "sitemap-and-user-flows.md", alex.id, "# Sitemap and user flows\n\n1. Menu → item → basket → pickup slot → pay\n2. Account → past orders → reorder\n", 40],
  ["Online ordering website", "homepage-design-v2.txt", alex.id, "Homepage design v2: hero with today's specials, pickup slot picker above the fold.\n", 12],
  ["Online ordering website", "menu-and-prices-2026.csv", nora.id, "item,price\nSourdough loaf,6.50\nCinnamon bun,3.20\nOat flat white,3.80\n", 9],
  ["Brand refresh", "brand-guidelines-final.txt", alex.id, "Brand guidelines (final): logo usage, clear space, palette, typography.\n", 45],
  ["Listings website redesign", "staging-review-checklist.md", alex.id, "# Review checklist\n\n- [ ] Search filters\n- [ ] Map view on mobile\n- [ ] Enquiry routing\n", 3],
  ["Monthly SEO retainer", "seo-report-last-month.csv", alex.id, "page,clicks,impressions,position\n/,1820,40210,6.1\n/listings,960,22100,8.4\n", 2],
  ["Investor deck and one-pager", "one-pager-final.txt", alex.id, "Cobalt Labs one-pager (final copy).\n", 14],
];
for (const [projectName, name, uploadedBy, body, days] of files) {
  const [row] = await db
    .insert(t.files)
    .values({ projectId: P[projectName]!.id, name, contentType: "text/plain", sizeBytes: Buffer.byteLength(body), uploadedBy, createdAt: ago(days) })
    .returning();
  await writeFile(join(uploadDir, row!.id), body);
}

// Invoices across every state: paid, open, due soon and overdue at different ages (for the ageing view).
const inv = async (clientId: number, description: string, dollars: number, dueInDays: number, issuedDaysAgo: number, paidDaysAgo?: number) => {
  const i = await createInvoice({ clientId, description, amountCents: dollars * 100, dueDate: addDays(dueInDays) });
  await db
    .update(t.invoices)
    .set({ createdAt: ago(issuedDaysAgo), ...(paidDaysAgo !== undefined ? { status: "paid" as const, paidAt: ago(paidDaysAgo, 15) } : {}) })
    .where(eq(t.invoices.id, i.id));
  return i;
};
await inv(northwind.id, "Brand refresh: full project", 3200, -95, 109, 100);
await inv(harbor.id, "SEO retainer: two months ago", 1500, -50, 64, 48);
await inv(cobalt.id, "Investor deck and one-pager", 4800, -10, 24, 1);
await inv(northwind.id, "Online ordering website: 50% deposit", 2400, -46, 60, 44);
await inv(harbor.id, "SEO retainer: last month", 1500, -20, 34);
await inv(harbor.id, "Listings redesign: milestone 2", 3600, -2, 16);
await inv(harbor.id, "SEO retainer: this month", 1500, 12, 2);
await inv(northwind.id, "Online ordering website: final 50%", 2400, 9, 5);
await inv(bluebird.id, "Discovery workshop and scope", 850, 11, 3);
await inv(cobalt.id, "Pitch rehearsal session", 600, -68, 82);

// History: what happened, in order, as the activity log would have recorded it.
const events: [number | null, number | null, string, string, number][] = [
  [alex.id, harbor.id, "client.created", "Harbor & Pine Realty added as a client", 200],
  [alex.id, northwind.id, "client.created", "Northwind Bakery added as a client", 120],
  [alex.id, northwind.id, "project.created", "New project: Brand refresh", 115],
  [null, northwind.id, "invoice.paid", "INV-0001 paid: $3,200.00", 100],
  [alex.id, northwind.id, "project.created", "New project: Online ordering website", 60],
  [alex.id, harbor.id, "project.status_changed", "Listings website redesign moved to In review", 4],
  [null, harbor.id, "invoice.paid", "INV-0002 paid: $1,500.00", 48],
  [nora.id, northwind.id, "invoice.paid", "INV-0004 paid: $2,400.00", 44],
  [alex.id, northwind.id, "project.status_changed", "Brand refresh moved to Delivered", 40],
  [alex.id, bluebird.id, "client.created", "Bluebird Fitness added as a client", 21],
  [alex.id, bluebird.id, "user.added", "Ben Okafor invited to Bluebird Fitness's portal", 20],
  [alex.id, bluebird.id, "project.created", "New project: Class booking app", 18],
  [alex.id, harbor.id, "invoice.created", "INV-0006 issued: $3,600.00 for Listings redesign: milestone 2", 16],
  [alex.id, northwind.id, "file.uploaded", "homepage-design-v2.txt added to Online ordering website", 12],
  [null, cobalt.id, "invoice.paid", "INV-0003 paid: $4,800.00", 1],
  [nora.id, northwind.id, "file.uploaded", "menu-and-prices-2026.csv added to Online ordering website", 9],
  [alex.id, northwind.id, "invoice.created", "INV-0008 issued: $2,400.00 for Online ordering website: final 50%", 5],
  [alex.id, bluebird.id, "invoice.created", "INV-0009 issued: $850.00 for Discovery workshop and scope", 3],
  [alex.id, harbor.id, "file.uploaded", "staging-review-checklist.md added to Listings website redesign", 3],
  [alex.id, harbor.id, "invoice.created", "INV-0007 issued: $1,500.00 for SEO retainer: this month", 2],
  [priya.id, harbor.id, "account.password_changed", "Priya Raman changed their password", 1],
  [alex.id, harbor.id, "file.uploaded", "seo-report-last-month.csv added to Monthly SEO retainer", 2],
];
await db.insert(t.activity).values(events.map(([actorId, clientId, action, summary, days]) => ({ actorId, clientId, action, summary, createdAt: ago(days) })));

await sqlClient.end();
console.log(`Seeded Brightline Studio with ${clients.length} clients. Sign in as admin@demo.test, client@demo.test or client2@demo.test (password: demo-password).`);
void ben;
