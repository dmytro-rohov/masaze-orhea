import type { APIRoute } from "astro";
import { sql } from "drizzle-orm";

import { db } from "@/db";

export const prerender = false;

const response = (status: "ok" | "unavailable", code: number): Response =>
  new Response(JSON.stringify({ status }), {
    status: code,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

// This intentionally verifies only the application and PostgreSQL. External
// providers must not make container health dependent on their availability.
export const GET: APIRoute = async () => {
  try {
    await db.execute(sql`select 1`);
    return response("ok", 200);
  } catch {
    return response("unavailable", 503);
  }
};
