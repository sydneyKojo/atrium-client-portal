import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db, t } from "@/db";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const DIR = process.env.UPLOAD_DIR ?? join(/*turbopackIgnore: true*/ process.cwd(), "uploads");

// Files are stored under their database id, never under the user's file name, so names can't escape the folder.
// Swap these two functions for S3 or R2 in production.
export async function saveUpload(projectId: number, userId: number, file: File) {
  if (file.size === 0) throw new Error("The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Files can be at most 20 MB.");
  const [row] = await db
    .insert(t.files)
    .values({
      projectId,
      uploadedBy: userId,
      name: file.name.slice(0, 200) || "file",
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    })
    .returning();
  await mkdir(DIR, { recursive: true });
  try {
    await writeFile(join(DIR, row!.id), Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    await db.delete(t.files).where(eq(t.files.id, row!.id));
    throw e;
  }
  return row!;
}

export function readUpload(id: string): Promise<Buffer> {
  return readFile(join(DIR, id));
}

export async function deleteUpload(id: string): Promise<void> {
  await unlink(join(DIR, id)).catch(() => {});
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
