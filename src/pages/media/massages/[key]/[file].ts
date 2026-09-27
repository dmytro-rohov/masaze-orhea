import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import { join } from "node:path";
import type { APIRoute } from "astro";
import { mediaUploadRoot } from "@/server/media/media-storage";

export const prerender = false;

const serve: APIRoute = async ({ params, request }) => {
  const key = params.key ?? "";
  const file = params.file ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key) ||
    !/^(?:\d{1,4}\.webp|video\.(?:mp4|webm))$/.test(file)) return new Response(null, { status: 404 });
  const path = join(mediaUploadRoot(), "massages", key, file);
  let handle;
  let size: number;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await handle.stat();
    if (!info.isFile()) { await handle.close(); return new Response(null, { status: 404 }); }
    size = info.size;
  } catch {
    await handle?.close().catch(() => {});
    return new Response(null, { status: 404 });
  }
  const headers = new Headers({
    "Content-Type": file.endsWith(".webp") ? "image/webp" : file.endsWith(".mp4") ? "video/mp4" : "video/webm",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  });
  const range = request.headers.get("range");
  let start = 0;
  let end = size - 1;
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) { await handle.close(); return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } }); }
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : end;
    if (start > end || start >= size) { await handle.close(); return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } }); }
    end = Math.min(end, size - 1);
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  headers.set("Content-Length", String(end - start + 1));
  if (request.method === "HEAD") await handle.close();
  const body = request.method === "HEAD" ? null : Readable.toWeb(handle.createReadStream({ start, end, autoClose: true })) as ReadableStream;
  return new Response(body, { status: range ? 206 : 200, headers });
};

export const GET = serve;
export const HEAD = serve;
