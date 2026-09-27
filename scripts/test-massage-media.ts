import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { massages, massageVariants } from "../src/db/schema";
import { getPublicMassageById } from "../src/server/catalog/massage-catalog.service";
import { isRuntimeImage, runtimeImageUrl } from "../src/lib/media/massage-media";
import { clearMassageMedia, setMassageMedia } from "../src/server/media/massage-media.service";
import { mediaUploadRoot } from "../src/server/media/media-storage";
import type { AdminSession } from "../src/server/admin/admin-auth.service";

const url = process.env.DATABASE_URL;
if (!url || !["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname)) throw new Error("Local PostgreSQL only.");
if (process.env.MEDIA_UPLOAD_DIR && !mediaUploadRoot().startsWith(process.cwd())) throw new Error("Local project media directory only.");
const id = `media-test-${randomUUID()}`;
const session: AdminSession = { username: "media-test", role: "owner", specialistId: null, expiresAt: Date.now() + 60_000 };
const specialist: AdminSession = { username: "media-test", role: "specialist", specialistId: "adrian", expiresAt: Date.now() + 60_000 };
const keys: string[] = [];
const mediaPath = (key: string, file: string) => join(mediaUploadRoot(), "massages", key, file);
const adminCookie = (role: "owner" | "specialist") => {
  const username = role === "owner" ? process.env.ADMIN_OWNER_USERNAME : process.env.ADMIN_ADRIAN_USERNAME;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!username || !secret) return null;
  const payload = Buffer.from(JSON.stringify({ version: 2, username, role, specialistId: role === "owner" ? null : "adrian", expiresAt: Math.floor(Date.now() / 1000) + 300 })).toString("base64url");
  return `orhea_admin_session=${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
};
const image = async (format: "jpeg" | "png" | "webp") =>
  new File([await sharp({ create: { width: 900, height: 600, channels: 3, background: "#bca06b" } }).toFormat(format).toBuffer()], `test.${format}`, { type: `image/${format}` });

await db.insert(massages).values({ id, name: "Media test", slug: id, zoneId: "ukojenie", title: "Media test", serviceName: "Test", shortDescription: "Test lokalny", labels: [], sortOrder: 99999, visualKey: "ukojenie", isActive: true, bookingAvailable: true, voucherAvailable: false });
try {
  await db.insert(massageVariants).values({ massageId: id, code: "60-min", durationMinutes: 60, bookingSlotMinutes: 60, priceGrosze: 10000, sortOrder: 0, isActive: true });
  await assert.rejects(setMassageMedia(specialist, id, "main_image", await image("jpeg")), /MEDIA_FORBIDDEN/);
  await assert.rejects(setMassageMedia(session, id, "main_image", new File(["not an image"], "fake.jpg", { type: "image/jpeg" })), /MEDIA_INVALID_IMAGE/);
  await assert.rejects(setMassageMedia(session, id, "main_image", new File([Buffer.from([0xff, 0xd8, 0xff, 0x00])], "broken.jpg", { type: "image/jpeg" })), /MEDIA_INVALID_IMAGE/);
  await assert.rejects(setMassageMedia(session, id, "main_image", new File(["<svg></svg>"], "fake.svg", { type: "image/svg+xml" })), /MEDIA_INVALID_IMAGE/);
  await assert.rejects(setMassageMedia(session, id, "main_image", new File([Buffer.alloc(10 * 1024 * 1024 + 1)], "huge.jpg")), /MEDIA_FILE_TOO_LARGE/);
  await assert.rejects(setMassageMedia(session, id, "hero_video", new File(["not a movie"], "fake.mp4", { type: "video/mp4" })), /MEDIA_INVALID_VIDEO/);
  const first = await setMassageMedia(session, id, "main_image", await image("jpeg"));
  assert.ok(isRuntimeImage(first));
  if (!isRuntimeImage(first)) throw new Error("Expected runtime image");
  keys.push(first.key);
  assert.equal(first.width, 900);
  assert.deepEqual(first.widths, [480, 768, 900]);
  assert.equal((await sharp(await readFile(mediaPath(first.key, "900.webp"))).metadata()).format, "webp");
  const catalog = await getPublicMassageById(id);
  assert.ok(catalog && isRuntimeImage(catalog.mainImage));
  const second = await setMassageMedia(session, id, "main_image", await image("png"));
  assert.ok(isRuntimeImage(second));
  keys.push(second.key);
  await assert.rejects(stat(mediaPath(first.key, "900.webp")), { code: "ENOENT" });
  const hero = await setMassageMedia(session, id, "hero_image", await image("webp"));
  assert.ok(isRuntimeImage(hero));
  keys.push(hero.key);
  const withHero = await getPublicMassageById(id);
  assert.ok(withHero && isRuntimeImage(withHero.heroImage));
  const firstVideo = await setMassageMedia(session, id, "hero_video", new File([await readFile("src/assets/video/video-1.webm")], "video.webm", { type: "video/webm" }));
  keys.push(firstVideo.key);
  assert.equal(firstVideo.kind, "runtime-video");
  const video = await setMassageMedia(session, id, "hero_video", new File([await readFile("src/assets/video/video-1.mp4")], "video.mp4", { type: "video/mp4" }));
  keys.push(video.key);
  await assert.rejects(stat(mediaPath(firstVideo.key, "video.webm")), { code: "ENOENT" });
  const withVideo = await getPublicMassageById(id);
  assert.ok(withVideo && withVideo.heroVideo?.key === video.key);
  await db.update(massages).set({ isActive: false }).where(eq(massages.id, id));
  assert.ok((await getPublicMassageById(id, true))?.heroVideo);
  await db.update(massages).set({ isActive: true }).where(eq(massages.id, id));
  if (process.env.CMS_MEDIA_BASE_URL) {
    const base = new URL(process.env.CMS_MEDIA_BASE_URL);
    if (!["localhost", "127.0.0.1", "::1"].includes(base.hostname)) throw new Error("Local HTTP only.");
    const response = await fetch(new URL(runtimeImageUrl(second as Extract<typeof second, { kind: "runtime-image" }>), base));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/webp");
    const ranged = await fetch(new URL(`/media/massages/${video.key}/video.mp4`, base), { headers: { Range: "bytes=0-99" } });
    assert.equal(ranged.status, 206);
    assert.equal(ranged.headers.get("content-type"), "video/mp4");
    assert.equal((await ranged.arrayBuffer()).byteLength, 100);
    const cards = await (await fetch(new URL("/rezerwacja", base))).text();
    assert.ok(cards.includes(runtimeImageUrl(second as Extract<typeof second, { kind: "runtime-image" }>)));
    const servicePage = await (await fetch(new URL(`/uslugi/${id}`, base))).text();
    assert.ok(servicePage.includes(`/media/massages/${hero.key}/`));
    assert.ok(servicePage.includes(`/media/massages/${video.key}/video.mp4`));
    assert.equal((await fetch(new URL(`/media/massages/${second.key}/%2f.env`, base))).status, 404);
    const endpoint = new URL(`/api/admin/massages/${id}/media`, base);
    const form = new FormData();
    form.set("kind", "hero_image");
    form.set("file", await image("jpeg"));
    const unauthenticated = await fetch(endpoint, { method: "POST", headers: { Origin: base.origin }, body: form });
    assert.equal(unauthenticated.status, 401);
    if (adminCookie("specialist")) {
      const forbidden = await fetch(endpoint, { method: "POST", headers: { Origin: base.origin, Cookie: adminCookie("specialist")! }, body: form });
      assert.equal(forbidden.status, 403);
    }
    if (adminCookie("owner")) {
      const editor = await fetch(new URL(`/admin/massages/${id}`, base), { headers: { Cookie: adminCookie("owner")! } });
      assert.equal(editor.status, 200);
      const editorHtml = await editor.text();
      for (const label of ["Główne zdjęcie masażu", "Zdjęcie hero", "Film hero"]) assert.ok(editorHtml.includes(label));
      const uploaded = await fetch(endpoint, { method: "POST", headers: { Origin: base.origin, Cookie: adminCookie("owner")! }, body: form });
      assert.equal(uploaded.status, 200);
      const payload = await uploaded.json() as { media: { key: string } };
      keys.push(payload.media.key);
      assert.equal((await getPublicMassageById(id))?.heroImage?.key, payload.media.key);
      const removed = await fetch(endpoint, { method: "DELETE", headers: { Origin: base.origin, Cookie: adminCookie("owner")!, "Content-Type": "application/json" }, body: JSON.stringify({ kind: "hero_image" }) });
      assert.equal(removed.status, 200);
      assert.equal((await getPublicMassageById(id))?.heroImage, null);
    }
  }
  await clearMassageMedia(session, id, "main_image");
  const withoutMain = await getPublicMassageById(id);
  assert.ok(withoutMain && withoutMain.mainImage === null);
  await clearMassageMedia(session, id, "hero_video");
  const withoutVideo = await getPublicMassageById(id);
  assert.ok(withoutVideo && withoutVideo.heroVideo === null);
  process.stdout.write("Massage media local smoke test PASS\n");
} finally {
  await db.delete(massageVariants).where(eq(massageVariants.massageId, id));
  await db.delete(massages).where(eq(massages.id, id));
  for (const key of keys) await rm(join(mediaUploadRoot(), "massages", key), { recursive: true, force: true });
}
