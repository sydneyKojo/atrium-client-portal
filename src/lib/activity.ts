import { and, count, desc, eq, gt, inArray, isNull, ne, or, type SQL } from "drizzle-orm";
import { db, t } from "@/db";
import type { User } from "@/db/schema";

export const ACTIONS = {
  "client.created": "Client added",
  "client.updated": "Client details updated",
  "project.created": "Project created",
  "project.status_changed": "Project status changed",
  "invoice.created": "Invoice issued",
  "invoice.paid": "Invoice paid",
  "invoice.voided": "Invoice voided",
  "file.uploaded": "File uploaded",
  "user.added": "User invited",
  "workspace.updated": "Workspace settings changed",
  "account.password_changed": "Password changed",
} as const;
export type Action = keyof typeof ACTIONS;

// What a client's users are allowed to see about their own account.
const CLIENT_VISIBLE: Action[] = [
  "project.created", "project.status_changed", "invoice.created", "invoice.paid", "invoice.voided", "file.uploaded", "user.added",
];

export async function record(actorId: number | null, clientId: number | null, action: Action, summary: string): Promise<void> {
  await db.insert(t.activity).values({ actorId, clientId, action, summary });
}

function visibleTo(user: User): SQL | undefined {
  if (user.role === "admin") return undefined;
  return and(eq(t.activity.clientId, user.clientId!), inArray(t.activity.action, CLIENT_VISIBLE));
}

// Notifications are other people's activity the user can see: for the agency that is client actions and payments,
// for a client it is anything the agency did on their account.
function notifiable(user: User): SQL | undefined {
  const notMine = or(isNull(t.activity.actorId), ne(t.activity.actorId, user.id));
  if (user.role === "admin") {
    return and(notMine, or(eq(t.activity.action, "invoice.paid"), eq(t.activity.action, "file.uploaded")));
  }
  return and(visibleTo(user), notMine);
}

export interface ActivityRow {
  id: number;
  action: string;
  summary: string;
  createdAt: Date;
  actorName: string | null;
  clientId: number | null;
  clientName: string | null;
}

export async function listActivity(
  user: User,
  opts: { limit?: number; clientId?: number; action?: string; notificationsOnly?: boolean } = {},
): Promise<ActivityRow[]> {
  const filters = [opts.notificationsOnly ? notifiable(user) : visibleTo(user)];
  if (opts.clientId) filters.push(eq(t.activity.clientId, opts.clientId));
  if (opts.action && opts.action in ACTIONS) filters.push(eq(t.activity.action, opts.action));
  return db
    .select({
      id: t.activity.id,
      action: t.activity.action,
      summary: t.activity.summary,
      createdAt: t.activity.createdAt,
      actorName: t.users.name,
      clientId: t.activity.clientId,
      clientName: t.clients.name,
    })
    .from(t.activity)
    .leftJoin(t.users, eq(t.users.id, t.activity.actorId))
    .leftJoin(t.clients, eq(t.clients.id, t.activity.clientId))
    .where(and(...filters))
    .orderBy(desc(t.activity.id))
    .limit(opts.limit ?? 50);
}

export async function unreadCount(user: User): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(t.activity)
    .where(and(notifiable(user), gt(t.activity.createdAt, user.notificationsSeenAt)));
  return row?.n ?? 0;
}

export async function markNotificationsSeen(userId: number): Promise<void> {
  await db.update(t.users).set({ notificationsSeenAt: new Date() }).where(eq(t.users.id, userId));
}
