import Link from "next/link";
import type { ReactNode } from "react";
import { MobileNav, NavLink, ThemeToggle } from "@/components/client";
import { Icon, type IconName } from "@/components/icons";
import { initials } from "@/components/ui";
import { unreadCount } from "@/lib/activity";
import { getClient, getWorkspace, listInvoices } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { logoutAction } from "../actions";

type NavItem = { href: string; label: string; icon: IconName; exact?: boolean; count?: number };

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const [workspace, unread, company, invoices] = await Promise.all([
    getWorkspace(),
    unreadCount(user),
    isAdmin ? Promise.resolve(null) : getClient(user.clientId!),
    listInvoices(user, { status: isAdmin ? "overdue" : "open" }),
  ]);

  const sections: { label: string; items: NavItem[] }[] = isAdmin
    ? [
        {
          label: "Workspace",
          items: [
            { href: "/admin", label: "Overview", icon: "home", exact: true },
            { href: "/admin/clients", label: "Clients", icon: "users" },
            { href: "/admin/projects", label: "Projects", icon: "folder" },
            { href: "/admin/invoices", label: "Invoices", icon: "receipt", count: invoices.length || undefined },
            { href: "/admin/files", label: "Files", icon: "file" },
          ],
        },
        {
          label: "Administration",
          items: [
            { href: "/admin/activity", label: "Activity log", icon: "activity" },
            { href: "/admin/settings", label: "Settings", icon: "settings" },
          ],
        },
      ]
    : [
        {
          label: company?.name ?? "Your account",
          items: [
            { href: "/portal", label: "Overview", icon: "home", exact: true },
            { href: "/portal/projects", label: "Projects", icon: "folder" },
            { href: "/portal/invoices", label: "Invoices", icon: "receipt", count: invoices.length || undefined },
            { href: "/portal/files", label: "Files", icon: "file" },
            { href: "/portal/activity", label: "Activity", icon: "activity" },
          ],
        },
      ];

  return (
    <MobileNav>
      <aside className="sidebar" aria-label="Main navigation">
        <Link href={isAdmin ? "/admin" : "/portal"} className="workspace" style={{ color: "inherit", textDecoration: "none" }}>
          <span className="mark" aria-hidden="true">{initials(workspace.name)}</span>
          <span>
            <span className="name">{workspace.name}</span>
            <span className="sub" style={{ display: "block" }}>{isAdmin ? "Agency workspace" : "Client portal"}</span>
          </span>
        </Link>
        {sections.map((s) => (
          <nav key={s.label} className="nav" aria-label={s.label}>
            <div className="nav-label">{s.label}</div>
            {s.items.map((i) => (
              <NavLink key={i.href} href={i.href} exact={i.exact}>
                <Icon name={i.icon} />
                {i.label}
                {i.count !== undefined && (
                  <span className="count" title={isAdmin ? "Overdue invoices" : "Invoices to pay"}>{i.count}</span>
                )}
              </NavLink>
            ))}
          </nav>
        ))}
        <div className="sidebar-foot">
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Icon name="mail" size="sm" />
            {isAdmin ? "Client questions go to" : "Questions? Email"}
          </span>
          <a href={`mailto:${workspace.supportEmail}`}>{workspace.supportEmail}</a>
          <span style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
            <Icon name="lock" size="sm" /> Card payments by Stripe
          </span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <form action="/search" className="search" role="search">
            <Icon name="search" size="sm" />
            <input
              name="q"
              type="search"
              placeholder={isAdmin ? "Search clients, projects, invoices, files" : "Search projects, invoices, files"}
              aria-label="Search"
            />
          </form>
          <span className="spacer" />
          <ThemeToggle />
          <Link href="/notifications" className="icon-btn" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
            <Icon name="bell" />
            {unread > 0 && <span className="dot">{unread > 9 ? "9+" : unread}</span>}
          </Link>
          <details className="user-menu">
            <summary aria-label="Account menu">
              <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
              <span className="user-name small strong">{user.name}</span>
            </summary>
            <div className="menu">
              <div className="who">
                <div className="strong">{user.name}</div>
                <div className="muted tiny">{user.email}</div>
                <div className="muted tiny">{isAdmin ? `Admin · ${workspace.name}` : `Client · ${company?.name ?? ""}`}</div>
              </div>
              <Link href="/account"><Icon name="user" size="sm" /> Account &amp; security</Link>
              {isAdmin && <Link href="/admin/settings"><Icon name="settings" size="sm" /> Workspace settings</Link>}
              <form action={logoutAction}>
                <button><Icon name="logout" size="sm" /> Sign out</button>
              </form>
            </div>
          </details>
        </header>
        <main className="content" id="main">{children}</main>
      </div>
    </MobileNav>
  );
}
