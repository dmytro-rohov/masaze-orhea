import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { Metadata, OutputInfo } from "sharp";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { massages } from "@/db/schema";
import { isOwner } from "@/server/admin/admin-authorization.service";
import type { AdminSession } from "@/server/admin/admin-auth.service";
import type { RuntimeImage, RuntimeVideo } from "@/lib/media/massage-media";
import { mediaUploadRoot } from "./media-storage";

export type MassageMediaKind = "main_image" | "hero_image" | "hero_video";
type Media = RuntimeImage | RuntimeVideo;
const IMAGE_LIMIT = 10 * 1024 * 1024;
export const VIDEO_LIMIT = 50 * 1024 * 1024;
const IMAGE_WIDTHS = [480, 768, 1280, 1600];
const fail = (code: string): never => { throw new Error(code); };
const validId = (id: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && id.length <= 100;

const mediaDirectory = (key: string) => join(mediaUploadRoot(), "massages", key);

const imageFormat = (data: Buffer): "jpeg" | "png" | "webp" | null => {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpeg";
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
};

const videoFormat = (data: Buffer): "mp4" | "webm" | null => {
  if (data.length >= 32 && data.toString("ascii", 4, 8) === "ftyp" &&
    /^[a-zA-Z0-9 ]{4}$/.test(data.toString("ascii", 8, 12))) {
    let offset = 0;
    let hasMovie = false;
    let hasMedia = false;
    while (offset + 8 <= data.length) {
      const declared = data.readUInt32BE(offset);
      const boxSize = declared === 0 ? data.length - offset : declared;
      const boxType = data.toString("ascii", offset + 4, offset + 8);
      if (boxSize < 8 || offset + boxSize > data.length || !/^[ -~]{4}$/.test(boxType)) break;
      if (boxType === "moov") hasMovie = true;
      if (boxType === "mdat") hasMedia = true;
      offset += boxSize;
    }
    if (offset === data.length && hasMovie && hasMedia) return "mp4";
  }
  if (data.length >= 32 && data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
    data.subarray(0, Math.min(data.length, 4096)).includes(Buffer.from("webm")) &&
    data.subarray(0, Math.min(data.length, 4096)).includes(Buffer.from([0x18, 0x53, 0x80, 0x67]))) return "webm";
  return null;
};

const prepareImage = async (data: Buffer, key: string): Promise<RuntimeImage> => {
  const format = imageFormat(data);
  if (!format || data.length > IMAGE_LIMIT) fail("MEDIA_INVALID_IMAGE");
  let metadata: Metadata;
  try { metadata = await sharp(data, { failOn: "error", limitInputPixels: 40_000_000 }).metadata(); }
  catch { return fail("MEDIA_INVALID_IMAGE"); }
  if (metadata.format !== format || !metadata.width || !metadata.height) fail("MEDIA_INVALID_IMAGE");
  const orientedWidth = metadata.orientation && metadata.orientation >= 5 && metadata.orientation <= 8 ? metadata.height : metadata.width;
  const maxWidth = Math.min(orientedWidth, 1600);
  const widths = [...new Set([...IMAGE_WIDTHS.filter((width) => width < maxWidth), maxWidth])];
  const directory = mediaDirectory(key);
  await mkdir(directory, { recursive: true, mode: 0o750 });
  let largestHeight = 0;
  for (const width of widths) {
    let result: { data: Buffer; info: OutputInfo };
    try {
      result = await sharp(data, { failOn: "error", limitInputPixels: 40_000_000 })
        .rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 4 })
        .toBuffer({ resolveWithObject: true });
    } catch { return fail("MEDIA_INVALID_IMAGE"); }
    await writeFile(join(directory, `${width}.webp`), result.data, { flag: "wx", mode: 0o640 });
    if (width === maxWidth) largestHeight = result.info.height;
  }
  return { kind: "runtime-image", key, width: maxWidth, height: largestHeight, widths };
};

const prepareVideo = async (data: Buffer, key: string): Promise<RuntimeVideo> => {
  if (data.length > VIDEO_LIMIT) fail("MEDIA_FILE_TOO_LARGE");
  const format = videoFormat(data);
  if (format === null) return fail("MEDIA_INVALID_VIDEO");
  const directory = mediaDirectory(key);
  await mkdir(directory, { recursive: true, mode: 0o750 });
  await writeFile(join(directory, `video.${format}`), data, { flag: "wx", mode: 0o640 });
  return { kind: "runtime-video", key, format };
};

const removeFiles = async (media: Media | null) => {
  if (media && /^[0-9a-f-]{36}$/.test(media.key)) await rm(mediaDirectory(media.key), { recursive: true, force: true });
};

const mediaValue = (row: typeof massages.$inferSelect, kind: MassageMediaKind): Media | null =>
  kind === "main_image" ? row.mainImage : kind === "hero_image" ? row.heroImage : row.heroVideo;

export async function setMassageMedia(session: AdminSession, massageId: string, kind: MassageMediaKind, file: File) {
  if (!isOwner(session)) fail("MEDIA_FORBIDDEN");
  if (!validId(massageId) || !["main_image", "hero_image", "hero_video"].includes(kind)) fail("MEDIA_INVALID_REQUEST");
  if (!(file instanceof File) || file.size === 0) fail("MEDIA_INVALID_REQUEST");
  if (file.size > (kind === "hero_video" ? VIDEO_LIMIT : IMAGE_LIMIT)) fail("MEDIA_FILE_TOO_LARGE");
  const [existing] = await db.select({ id: massages.id }).from(massages).where(eq(massages.id, massageId)).limit(1);
  if (!existing) fail("MEDIA_MASSAGE_NOT_FOUND");
  const data = Buffer.from(await file.arrayBuffer());
  const key = randomUUID();
  let committed = false;
  try {
    const prepared = kind === "hero_video" ? await prepareVideo(data, key) : await prepareImage(data, key);
    const replacement = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(massages).where(eq(massages.id, massageId)).for("update").limit(1);
      if (!row) fail("MEDIA_MASSAGE_NOT_FOUND");
      const old = mediaValue(row, kind);
      const value = kind === "main_image" ? { mainImage: prepared as RuntimeImage }
        : kind === "hero_image" ? { heroImage: prepared as RuntimeImage } : { heroVideo: prepared as RuntimeVideo };
      await tx.update(massages).set({ ...value, updatedAt: sql`now()` }).where(eq(massages.id, massageId));
      return old;
    });
    committed = true;
    // Only a successful DB commit makes the old file disposable.
    try { await removeFiles(replacement); } catch (error) { console.error("Previous massage media cleanup failed:", error); }
    return prepared;
  } catch (error) {
    if (!committed) await rm(mediaDirectory(key), { recursive: true, force: true });
    throw error;
  }
}

export async function clearMassageMedia(session: AdminSession, massageId: string, kind: MassageMediaKind) {
  if (!isOwner(session)) fail("MEDIA_FORBIDDEN");
  if (!validId(massageId) || !["main_image", "hero_image", "hero_video"].includes(kind)) fail("MEDIA_INVALID_REQUEST");
  const old = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(massages).where(eq(massages.id, massageId)).for("update").limit(1);
    if (!row) fail("MEDIA_MASSAGE_NOT_FOUND");
    const current = mediaValue(row, kind);
    if (current) {
      const value = kind === "main_image" ? { mainImage: null } : kind === "hero_image" ? { heroImage: null } : { heroVideo: null };
      await tx.update(massages).set({ ...value, updatedAt: sql`now()` }).where(eq(massages.id, massageId));
    }
    return current;
  });
  await removeFiles(old);
  return { alreadyApplied: !old };
}
