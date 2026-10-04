import { and, eq, sql } from "drizzle-orm";
import Stripe from "stripe";
import { db, t } from "@/db";
import type { Invoice } from "@/db/schema";
import { record } from "./activity";

export function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

// "1,250.50" or "$1250.5" -> 125050. Rejects zero, negatives and more than 2 decimals.
export function parseAmountToCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > 0 && cents <= 100_000_000 ? cents : null;
}

export async function createInvoice(input: { clientId: number; description: string; amountCents: number; dueDate: string }): Promise<Invoice> {
  // Numbers are sequential (INV-0001...) and unique; retried once if two admins create one at the same moment.
  for (let attempt = 0; attempt < 2; attempt++) {
    const [{ next }] = (await db.execute(
      sql`select coalesce(max(substring(number from 5)::int), 0) + 1 as next from invoices`,
    )) as unknown as [{ next: number }];
    try {
      const [inv] = await db
        .insert(t.invoices)
        .values({ ...input, number: `INV-${String(next).padStart(4, "0")}` })
        .returning();
      return inv!;
    } catch (e) {
      if (attempt === 1 || !String(e).includes("invoices_number_key")) throw e;
    }
  }
  throw new Error("unreachable");
}

// Idempotent: Stripe can deliver the same webhook more than once. actorId is null when Stripe confirms the payment.
export async function markPaid(invoiceId: number, stripeSessionId: string | null, actorId: number | null = null): Promise<boolean> {
  const updated = await db
    .update(t.invoices)
    .set({ status: "paid", paidAt: new Date(), ...(stripeSessionId ? { stripeSessionId } : {}) })
    .where(and(eq(t.invoices.id, invoiceId), eq(t.invoices.status, "open")))
    .returning();
  const inv = updated[0];
  if (!inv) return false;
  await record(actorId, inv.clientId, "invoice.paid", `${inv.number} paid: ${formatMoney(inv.amountCents, inv.currency)}`);
  return true;
}

export function invoiceState(inv: Pick<Invoice, "status" | "dueDate">, today = new Date().toISOString().slice(0, 10)): "paid" | "void" | "overdue" | "open" {
  if (inv.status !== "open") return inv.status;
  return inv.dueDate < today ? "overdue" : "open";
}

export function addDays(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function stripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let stripe: Stripe | null = null;
function client(): Stripe {
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!);
  return stripe;
}

export async function startCheckout(inv: Invoice, customerEmail: string): Promise<string> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3400";
  const session = await client().checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    client_reference_id: String(inv.id),
    metadata: { invoiceId: String(inv.id) },
    line_items: [
      {
        quantity: 1,
        price_data: { currency: inv.currency, unit_amount: inv.amountCents, product_data: { name: `${inv.number}: ${inv.description}` } },
      },
    ],
    success_url: `${appUrl}/portal?paid=${inv.number}`,
    cancel_url: `${appUrl}/portal`,
  });
  await db.update(t.invoices).set({ stripeSessionId: session.id }).where(eq(t.invoices.id, inv.id));
  return session.url!;
}

// The invoice is marked paid only from Stripe's signed webhook, never from the browser redirect.
export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<{ status: number; message: string }> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return { status: 400, message: "missing signature or secret" };
  let event: Stripe.Event;
  try {
    event = client().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return { status: 400, message: "bad signature" };
  }
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const id = Number(s.metadata?.invoiceId);
    if (s.payment_status === "paid" && Number.isInteger(id)) await markPaid(id, s.id);
  }
  return { status: 200, message: "ok" };
}
