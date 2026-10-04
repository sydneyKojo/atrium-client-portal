import { ACTIONS, listActivity } from "@/lib/activity";
import { csvResponse, toCsv } from "@/lib/csv";
import { currentUser } from "@/lib/session";

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  if (user.role !== "admin") return new Response("Not found", { status: 404 });
  const action = new URL(req.url).searchParams.get("action") ?? undefined;
  const rows = await listActivity(user, { action, limit: 5000 });
  const body = toCsv(
    ["When (UTC)", "Event", "Summary", "By", "Client"],
    rows.map((r) => [r.createdAt.toISOString(), ACTIONS[r.action as keyof typeof ACTIONS] ?? r.action, r.summary, r.actorName ?? "System", r.clientName ?? ""]),
  );
  return csvResponse(`activity-${new Date().toISOString().slice(0, 10)}.csv`, body);
}
