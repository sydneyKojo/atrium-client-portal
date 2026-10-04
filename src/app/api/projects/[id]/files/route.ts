import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, t } from "@/db";
import { canAccessClient } from "@/lib/auth";
import { record } from "@/lib/activity";
import { saveUpload } from "@/lib/files";
import { currentUser } from "@/lib/session";

// Plain form POST (no client JS). Redirects back to the page the upload came from.
export async function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/files">) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);
  const id = Number((await ctx.params).id);
  const project = Number.isInteger(id) ? await db.query.projects.findFirst({ where: eq(t.projects.id, id) }) : undefined;
  if (!project || !canAccessClient(user, project.clientId)) return new NextResponse("Not found", { status: 404 });

  const back = `/projects/${project.id}`;
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) return NextResponse.redirect(new URL(`${back}?err=Choose a file to upload.`, req.url), 303);
  let saved;
  try {
    saved = await saveUpload(project.id, user.id, file);
  } catch (e) {
    return NextResponse.redirect(new URL(`${back}?err=${encodeURIComponent((e as Error).message)}`, req.url), 303);
  }
  await record(user.id, project.clientId, "file.uploaded", `${saved.name} added to ${project.name}`);
  return NextResponse.redirect(new URL(`${back}?ok=${encodeURIComponent(`${saved.name} uploaded.`)}`, req.url), 303);
}
