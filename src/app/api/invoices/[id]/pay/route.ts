import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, t } from "@/db";
import { canAccessClient } from "@/lib/auth";
import { markPaid, startCheckout, stripeEnabled } from "@/lib/billing";
import { currentUser } from "@/lib/session";

export async function POST(req: Request, ctx: RouteContext<"/api/invoices/[id]/pay">) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);
  const id = Number((await ctx.params).id);
  const inv = Number.isInteger(id) ? await db.query.invoices.findFirst({ where: eq(t.invoices.id, id) }) : undefined;
  if (!inv || !canAccessClient(user, inv.clientId)) return new NextResponse("Not found", { status: 404 });
  if (inv.status !== "open") return NextResponse.redirect(new URL("/portal", req.url), 303);

  if (!stripeEnabled()) {
    // Demo mode only: no Stripe keys configured, so simulate a successful payment.
    await markPaid(inv.id, null, user.id);
    return NextResponse.redirect(new URL(`/portal?paid=${inv.number}`, req.url), 303);
  }
  try {
    return NextResponse.redirect(await startCheckout(inv, user.email), 303);
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL(`/invoices/${inv.id}?err=${encodeURIComponent("Payment could not be started. Please try again in a moment.")}`, req.url), 303);
  }
}
