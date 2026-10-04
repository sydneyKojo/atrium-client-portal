import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, sqlClient, t } from "@/db";
import { DDL } from "@/db/schema";
import { listActivity, record, unreadCount } from "@/lib/activity";
import { canAccessClient, endOtherSessions, hashPassword, login, logout, userForToken, verifyPassword } from "@/lib/auth";
import { createInvoice, handleStripeWebhook, invoiceState, markPaid, parseAmountToCents } from "@/lib/billing";
import { toCsv } from "@/lib/csv";

const WEBHOOK_SECRET = "whsec_test_secret";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy"; // constructing events needs no network
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;

let clientId: number;

beforeAll(async () => {
  await sqlClient.unsafe(DDL);
});
beforeEach(async () => {
  await sqlClient`truncate clients, users, sessions, projects, files, invoices, activity restart identity cascade`;
  const [c] = await db.insert(t.clients).values({ name: "Test Co", contactEmail: "a@test.co" }).returning();
  clientId = c!.id;
  await db.insert(t.users).values({ email: "nora@test.co", name: "Nora", passwordHash: await hashPassword("correct horse"), role: "client", clientId });
});
afterAll(() => sqlClient.end());

describe("passwords", () => {
  it("verifies the right password and rejects others", async () => {
    const h = await hashPassword("s3cret!");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("s3cret!", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("s3cret!", "garbage")).toBe(false);
  });
});

describe("sessions", () => {
  it("logs in, resolves the session, and logs out", async () => {
    const res = await login("  NORA@test.co ", "correct horse");
    expect(res?.user.name).toBe("Nora");
    expect((await userForToken(res!.token))?.email).toBe("nora@test.co");
    const [stored] = await db.select().from(t.sessions);
    expect(stored!.tokenHash).not.toBe(res!.token); // only the hash is stored
    await logout(res!.token);
    expect(await userForToken(res!.token)).toBeNull();
  });

  it("rejects a wrong password and an unknown email", async () => {
    expect(await login("nora@test.co", "nope")).toBeNull();
    expect(await login("ghost@test.co", "correct horse")).toBeNull();
  });

  it("ignores expired sessions", async () => {
    const res = await login("nora@test.co", "correct horse");
    await db.update(t.sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await userForToken(res!.token)).toBeNull();
  });
});

describe("access", () => {
  it("lets admins see everything and clients only their own company", () => {
    expect(canAccessClient({ role: "admin", clientId: null }, 7)).toBe(true);
    expect(canAccessClient({ role: "client", clientId: 7 }, 7)).toBe(true);
    expect(canAccessClient({ role: "client", clientId: 7 }, 8)).toBe(false);
  });
});

describe("invoices", () => {
  it("parses amounts strictly", () => {
    expect(parseAmountToCents("1,250.50")).toBe(125050);
    expect(parseAmountToCents("$99")).toBe(9900);
    expect(parseAmountToCents("0")).toBeNull();
    expect(parseAmountToCents("-5")).toBeNull();
    expect(parseAmountToCents("1.234")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
  });

  it("numbers invoices sequentially", async () => {
    const a = await createInvoice({ clientId, description: "A", amountCents: 1000, dueDate: "2026-11-01" });
    const b = await createInvoice({ clientId, description: "B", amountCents: 2000, dueDate: "2026-11-01" });
    expect([a.number, b.number]).toEqual(["INV-0001", "INV-0002"]);
  });

  it("marks paid once, even if called twice", async () => {
    const inv = await createInvoice({ clientId, description: "A", amountCents: 1000, dueDate: "2026-11-01" });
    expect(await markPaid(inv.id, "cs_1")).toBe(true);
    expect(await markPaid(inv.id, "cs_1")).toBe(false);
    const row = await db.query.invoices.findFirst({ where: eq(t.invoices.id, inv.id) });
    expect(row?.status).toBe("paid");
    expect(row?.paidAt).not.toBeNull();
  });
});

describe("stripe webhook", () => {
  const event = (invoiceId: number, paymentStatus = "paid") =>
    JSON.stringify({
      id: "evt_1",
      object: "event",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_1", object: "checkout.session", payment_status: paymentStatus, metadata: { invoiceId: String(invoiceId) } } },
    });
  const sign = (payload: string) => Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });

  it("marks the invoice paid for a correctly signed event", async () => {
    const inv = await createInvoice({ clientId, description: "A", amountCents: 1000, dueDate: "2026-11-01" });
    const body = event(inv.id);
    expect((await handleStripeWebhook(body, await sign(body))).status).toBe(200);
    expect((await db.query.invoices.findFirst({ where: eq(t.invoices.id, inv.id) }))?.status).toBe("paid");
  });

  it("rejects a forged event and leaves the invoice open", async () => {
    const inv = await createInvoice({ clientId, description: "A", amountCents: 1000, dueDate: "2026-11-01" });
    const res = await handleStripeWebhook(event(inv.id), "t=1,v1=forged");
    expect(res.status).toBe(400);
    expect((await db.query.invoices.findFirst({ where: eq(t.invoices.id, inv.id) }))?.status).toBe("open");
  });

  it("does not mark paid when the checkout is still unpaid", async () => {
    const inv = await createInvoice({ clientId, description: "A", amountCents: 1000, dueDate: "2026-11-01" });
    const body = event(inv.id, "unpaid");
    await handleStripeWebhook(body, await sign(body));
    expect((await db.query.invoices.findFirst({ where: eq(t.invoices.id, inv.id) }))?.status).toBe("open");
  });
});

describe("invoice state", () => {
  it("derives overdue from the due date", () => {
    expect(invoiceState({ status: "open", dueDate: "2026-10-01" }, "2026-10-03")).toBe("overdue");
    expect(invoiceState({ status: "open", dueDate: "2026-10-03" }, "2026-10-03")).toBe("open");
    expect(invoiceState({ status: "paid", dueDate: "2026-01-01" }, "2026-10-03")).toBe("paid");
  });
});

describe("csv export", () => {
  it("quotes properly and neutralises spreadsheet formulas", () => {
    const csv = toCsv(["a", "b"], [["=HYPERLINK(\"x\")", 'say "hi", ok'], [null, 5]]);
    expect(csv).toBe(`a,b\r\n"'=HYPERLINK(""x"")","say ""hi"", ok"\r\n,5\r\n`);
  });
});

describe("activity and notifications", () => {
  it("shows a client only their own company's events, and only client-safe ones", async () => {
    const [other] = await db.insert(t.clients).values({ name: "Other Co", contactEmail: "o@o.co" }).returning();
    const [admin] = await db.insert(t.users).values({ email: "admin@test.co", name: "Admin", passwordHash: "x", role: "admin" }).returning();
    await record(admin!.id, clientId, "invoice.created", "INV for Test Co");
    await record(admin!.id, other!.id, "invoice.created", "INV for Other Co");
    await record(admin!.id, clientId, "client.updated", "internal edit");
    const nora = (await login("nora@test.co", "correct horse"))!.user;
    const seen = (await listActivity(nora)).map((r) => r.summary);
    expect(seen).toEqual(["INV for Test Co"]);
    expect((await listActivity(admin!)).length).toBe(3);
  });

  it("counts other people's events as unread, not your own", async () => {
    const nora = (await login("nora@test.co", "correct horse"))!.user;
    await db.update(t.users).set({ notificationsSeenAt: new Date(Date.now() - 60_000) }).where(eq(t.users.id, nora.id));
    const [admin] = await db.insert(t.users).values({ email: "admin@test.co", name: "Admin", passwordHash: "x", role: "admin" }).returning();
    await record(admin!.id, clientId, "file.uploaded", "brief.pdf added");
    await record(nora.id, clientId, "file.uploaded", "my upload");
    const fresh = (await db.query.users.findFirst({ where: eq(t.users.id, nora.id) }))!;
    expect(await unreadCount(fresh)).toBe(1);
  });

  it("records who paid when an invoice is marked paid", async () => {
    const inv = await createInvoice({ clientId, description: "A", amountCents: 1000, dueDate: "2026-11-01" });
    await markPaid(inv.id, "cs_9");
    const [row] = await db.select().from(t.activity);
    expect(row?.action).toBe("invoice.paid");
    expect(row?.actorId).toBeNull();
  });
});

describe("password change", () => {
  it("signs out other sessions but keeps the current one", async () => {
    const a = (await login("nora@test.co", "correct horse"))!;
    const b = (await login("nora@test.co", "correct horse"))!;
    await endOtherSessions(a.user.id, a.token);
    expect(await userForToken(a.token)).not.toBeNull();
    expect(await userForToken(b.token)).toBeNull();
  });
});
