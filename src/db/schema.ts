import { bigint, integer, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

// The agency running the portal. Single row (id = 1).
export const workspace = pgTable("workspace", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  supportEmail: text("support_email").notNull(),
  paymentTermsDays: integer("payment_terms_days").notNull(),
  invoiceNote: text("invoice_note").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// role "admin" = the agency team; role "client" = a person at one client company.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "client"] }).notNull(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
  notificationsSeenAt: timestamp("notifications_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["planning", "in_progress", "review", "done"] }).notNull().default("planning"),
  dueDate: text("due_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  number: text("number").notNull().unique(),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("usd"),
  status: text("status", { enum: ["open", "paid", "void"] }).notNull().default("open"),
  dueDate: text("due_date").notNull(),
  stripeSessionId: text("stripe_session_id"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Audit trail and the source of notifications. actorId is null for system events (e.g. a Stripe payment).
export const activity = pgTable("activity", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  summary: text("summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspace.$inferSelect;
export type Activity = typeof activity.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Project = typeof projects.$inferSelect;

// Plain DDL so `npm run db:setup` and the tests need no migration tool. Mirrors the tables above.
export const DDL = `
create table if not exists clients (
  id serial primary key, name text not null, contact_email text not null,
  created_at timestamptz not null default now());
create table if not exists users (
  id serial primary key, email text not null unique, name text not null, password_hash text not null,
  role text not null check (role in ('admin','client')),
  client_id int references clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((role = 'client') = (client_id is not null)));
create table if not exists sessions (
  token_hash text primary key, user_id int not null references users(id) on delete cascade,
  expires_at timestamptz not null);
create table if not exists projects (
  id serial primary key, client_id int not null references clients(id) on delete cascade, name text not null,
  status text not null default 'planning' check (status in ('planning','in_progress','review','done')),
  due_date text, created_at timestamptz not null default now());
create table if not exists files (
  id uuid primary key default gen_random_uuid(), project_id int not null references projects(id) on delete cascade,
  name text not null, content_type text not null, size_bytes bigint not null,
  uploaded_by int not null references users(id), created_at timestamptz not null default now());
create table if not exists invoices (
  id serial primary key, client_id int not null references clients(id) on delete cascade,
  number text not null unique, description text not null, amount_cents int not null check (amount_cents > 0),
  currency text not null default 'usd', status text not null default 'open' check (status in ('open','paid','void')),
  due_date text not null, stripe_session_id text, paid_at timestamptz, created_at timestamptz not null default now());
create table if not exists workspace (
  id int primary key check (id = 1), name text not null, support_email text not null,
  payment_terms_days int not null default 14 check (payment_terms_days between 0 and 120),
  invoice_note text not null default '', updated_at timestamptz not null default now());
insert into workspace (id, name, support_email, payment_terms_days, invoice_note)
  values (1, 'Your Studio', 'billing@example.com', 14, 'Thank you for your business.') on conflict (id) do nothing;
create table if not exists activity (
  id serial primary key, actor_id int references users(id) on delete set null,
  client_id int references clients(id) on delete cascade, action text not null, summary text not null,
  created_at timestamptz not null default now());
create index if not exists activity_client_idx on activity (client_id, id desc);
alter table clients add column if not exists contact_name text;
alter table projects add column if not exists description text;
alter table users add column if not exists notifications_seen_at timestamptz not null default now();
`;
