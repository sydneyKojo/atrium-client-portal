import { Timeline } from "@/components/blocks";
import { SubmitButton } from "@/components/client";
import { PageHead } from "@/components/ui";
import { listActivity, unreadCount } from "@/lib/activity";
import { requireUser } from "@/lib/session";
import { markAllReadAction } from "../account/actions";

export const metadata = { title: "Notifications · Atrium" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const [rows, unread] = await Promise.all([listActivity(user, { notificationsOnly: true, limit: 50 }), unreadCount(user)]);
  return (
    <>
      <PageHead
        title="Notifications"
        lead={
          user.role === "admin"
            ? "Payments received and files your clients upload. Everything else is in the activity log."
            : "Updates from the team: new invoices, files and project stage changes."
        }
        actions={
          unread > 0 ? (
            <form action={markAllReadAction}><SubmitButton className="btn secondary" pending="Marking…">Mark all as read ({unread})</SubmitButton></form>
          ) : undefined
        }
      />
      <section className="card">
        <Timeline rows={rows} showClient={user.role === "admin"} unreadSince={user.notificationsSeenAt} emptyText="You're all caught up. New updates will show here and on the bell icon." />
      </section>
    </>
  );
}
