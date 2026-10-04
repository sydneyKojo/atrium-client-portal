import { handleStripeWebhook } from "@/lib/billing";

// Point a Stripe webhook (event: checkout.session.completed) at /api/stripe/webhook.
export async function POST(req: Request) {
  const res = await handleStripeWebhook(await req.text(), req.headers.get("stripe-signature"));
  return new Response(res.message, { status: res.status });
}
