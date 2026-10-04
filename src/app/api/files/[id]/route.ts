import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, t } from "@/db";
import { canAccessClient } from "@/lib/auth";
import { readUpload } from "@/lib/files";
import { currentUser } from "@/lib/session";

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const user = await currentUser();
  if (!user) return new NextResponse("Sign in first", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const [row] = await db
    .select({ file: t.files, clientId: t.projects.clientId })
    .from(t.files)
    .innerJoin(t.projects, eq(t.projects.id, t.files.projectId))
    .where(eq(t.files.id, id));
  if (!row || !canAccessClient(user, row.clientId)) return new NextResponse("Not found", { status: 404 });

  const body = await readUpload(row.file.id);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      // Always download, never render inline, so an uploaded HTML file can't run in the portal's origin.
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.file.name)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
