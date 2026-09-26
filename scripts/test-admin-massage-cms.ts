import "dotenv/config";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { bookings, massageContent, massages, massageVariants, voucherOrders } from "../src/db/schema";
import { getBookableMassages, getMassagePageContent, getPublicMassageBySlug, getVoucherMassages } from "../src/server/catalog/massage-catalog.service";
import { getAdminMassageEditor, saveAdminMassage, setAdminMassageActive } from "../src/server/admin/admin-massages.service";
import type { AdminSession } from "../src/server/admin/admin-auth.service";
import { validateContactForm } from "../src/lib/contact/validateContactForm";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1", "::1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("CMS smoke test may run only against a local PostgreSQL host.");
}

const session: AdminSession = { username: "cms-local-test", role: "owner", specialistId: null, expiresAt: Date.now() + 60_000 };
const specialist: AdminSession = { username: "cms-local-test-specialist", role: "specialist", specialistId: "adrian", expiresAt: Date.now() + 60_000 };
const slug = `cms-e2e-${Date.now()}`;
const baseUrl = process.env.CMS_E2E_BASE_URL;
if (baseUrl && !["localhost", "127.0.0.1", "::1"].includes(new URL(baseUrl).hostname)) throw new Error("CMS_E2E_BASE_URL must be local.");
const page = async (path: string) => {
  const response = await fetch(new URL(path, baseUrl));
  assert.equal(response.status, 200, `${path} did not return 200`);
  return response.text();
};
const localTestCookie = (role: "owner" | "specialist") => {
  const username = role === "owner" ? process.env.ADMIN_OWNER_USERNAME : process.env.ADMIN_ADRIAN_USERNAME;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!username || !secret) throw new Error("Local admin auth test configuration is missing.");
  const payload = Buffer.from(JSON.stringify({ version: 2, username, role, specialistId: role === "owner" ? null : "adrian", expiresAt: Math.floor(Date.now() / 1000) + 300 })).toString("base64url");
  return `orhea_admin_session=${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
};
const draft = {
  core: { title: "Test CMS", serviceName: "Masaż próbny", slug, zoneId: "ukojenie", shortDescription: "Lokalna oferta testowa.", labels: ["Test"], sortOrder: 99_999, visualKey: "ukojenie", isActive: true, bookingAvailable: true, voucherAvailable: true },
  variants: [{ code: "60-min", durationMinutes: 60, durationLabel: "", bookingSlotMinutes: 60, pricePLN: "240.00", isActive: true, sortOrder: 0 }],
  content: { tagline: "Test", description: [{ title: "O masażu", paragraphs: ["Opis próbnej oferty."] }], bodyVisualKey: "ukojenie", bodyVisualAlt: "", forWhom: { title: "Dla kogo", items: ["Dla klientów"] }, expectations: { title: "Efekty", items: ["Odpoczynek"] }, safety: { title: "Bezpieczeństwo", description: "Informacja testowa." }, steps: [], bookingCta: { title: "Rezerwacja", description: "Zarezerwuj masaż." }, seoPhrases: ["test cms"], relatedMassageIds: [] },
};

let created = false;
try {
  const oldBookingSnapshots = await db.select({ id: bookings.id, name: bookings.massageNameSnapshot, price: bookings.priceGroszeSnapshot, total: bookings.totalPriceGroszeSnapshot }).from(bookings).orderBy(bookings.id);
  const oldVoucherSnapshots = await db.select({ id: voucherOrders.id, name: voucherOrders.massageNameSnapshot, price: voucherOrders.priceGroszeSnapshot }).from(voucherOrders).orderBy(voucherOrders.id);
  await assert.rejects(saveAdminMassage(specialist, draft), /ADMIN_OWNER_ACCESS_REQUIRED/);
  await assert.rejects(saveAdminMassage(session, { ...draft, core: { ...draft.core, zoneId: "vip" } }), /ADMIN_MASSAGE_VIP_RESERVED/);
  const result = baseUrl
    ? await (async () => {
        const response = await fetch(new URL("/api/admin/massages/save", baseUrl), { method: "POST", headers: { Cookie: localTestCookie("owner"), Origin: baseUrl, "Content-Type": "application/json" }, body: JSON.stringify({ draft }) });
        assert.equal(response.status, 200);
        return response.json() as Promise<{ id: string }>;
      })()
    : await saveAdminMassage(session, draft);
  created = true;
  assert.equal(result.id, slug);
  if (baseUrl) {
    const ownerList = await fetch(new URL("/admin/massages", baseUrl), { headers: { Cookie: localTestCookie("owner") }, redirect: "manual" });
    assert.equal(ownerList.status, 200);
    assert.ok((await ownerList.text()).includes("Test CMS"));
    const ownerEdit = await fetch(new URL(`/admin/massages/${slug}`, baseUrl), { headers: { Cookie: localTestCookie("owner") }, redirect: "manual" });
    assert.equal(ownerEdit.status, 200);
    assert.ok((await ownerEdit.text()).includes("Warianty i ceny"));
    const specialistPage = await fetch(new URL("/admin/massages", baseUrl), { headers: { Cookie: localTestCookie("specialist") }, redirect: "manual" });
    assert.equal(specialistPage.status, 403);
    const specialistMutation = await fetch(new URL("/api/admin/massages/save", baseUrl), { method: "POST", headers: { Cookie: localTestCookie("specialist"), Origin: baseUrl, "Content-Type": "application/json" }, body: JSON.stringify({ draft }) });
    assert.equal(specialistMutation.status, 403);
    const unauthenticated = await fetch(new URL("/api/admin/massages/save", baseUrl), {
      method: "POST", headers: { Origin: baseUrl, "Content-Type": "application/json" }, body: JSON.stringify({ draft }),
    });
    assert.equal(unauthenticated.status, 401);
  }
  const editor = await getAdminMassageEditor(session, slug);
  assert.ok(editor?.content);
  assert.equal(editor.variants.length, 1);
  assert.equal(editor.variants[0].code, "60-min");
  await assert.rejects(saveAdminMassage(session, { ...draft, core: { ...draft.core, title: "Niepoprawna zmiana" }, variants: [{ ...draft.variants[0], id: editor.variants[0].id, code: "changed-code" }] }, slug), /ADMIN_MASSAGE_VARIANT_CODE_IMMUTABLE/);
  assert.equal((await getAdminMassageEditor(session, slug))?.massage.title, "Test CMS");
  assert.equal((await getPublicMassageBySlug(slug))?.variants[0].priceGrosze, 24_000);
  assert.ok((await getBookableMassages()).some((item) => item.id === slug));
  assert.ok((await getVoucherMassages()).some((item) => item.id === slug));
  assert.equal((await getMassagePageContent(slug))?.description[0]?.paragraphs[0], "Opis próbnej oferty.");
  const contact = new FormData();
  for (const [key, value] of Object.entries({ name: "Test CMS", email: "test@example.invalid", preferredContactMethods: "email", subject: "specific-massage", massageId: slug, message: "Testowe pytanie o masaż.", privacyAccepted: "true" })) contact.append(key, value);
  const contactResult = await validateContactForm(contact);
  assert.equal(contactResult.success, true);
  if (baseUrl) {
    for (const path of ["/uslugi", "/rezerwacja", "/voucher", "/cennik", "/sitemap.xml"]) assert.ok((await page(path)).includes(path === "/cennik" ? "Test CMS" : slug), `${path} does not show test massage`);
    assert.ok((await page(`/uslugi/${slug}`)).includes("Lokalna oferta testowa."));
  }

  const updatedDraft = { ...draft, variants: [{ ...draft.variants[0], id: editor.variants[0].id, pricePLN: "260.00" }] };
  await saveAdminMassage(session, updatedDraft, slug);
  if (baseUrl) {
    const saved = await fetch(new URL("/api/admin/massages/save", baseUrl), { method: "POST", headers: { Cookie: localTestCookie("owner"), Origin: baseUrl, "Content-Type": "application/json" }, body: JSON.stringify({ id: slug, draft: updatedDraft }) });
    assert.equal(saved.status, 200);
  }
  assert.equal((await getPublicMassageBySlug(slug))?.variants[0].priceGrosze, 26_000);
  assert.equal((await getAdminMassageEditor(session, slug))?.variants[0].id, editor.variants[0].id);
  if (baseUrl) {
    assert.match(await page("/cennik"), /260(?:[,.]00)?(?:\s|&nbsp;)*zł/u);
    assert.match(await page(`/uslugi/${slug}`), /260(?:[,.]00)?(?:\s|&nbsp;)*zł/u);
  }

  if (baseUrl) {
    const archived = await fetch(new URL("/api/admin/massages/active", baseUrl), { method: "POST", headers: { Cookie: localTestCookie("owner"), Origin: baseUrl, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ id: slug, active: "false" }) });
    assert.equal(archived.status, 200);
  } else await setAdminMassageActive(session, slug, false);
  assert.equal(await getPublicMassageBySlug(slug), undefined);
  assert.equal((await getPublicMassageBySlug(slug, true))?.isActive, false);
  assert.ok(!(await getBookableMassages()).some((item) => item.id === slug));
  assert.ok(!(await getVoucherMassages()).some((item) => item.id === slug));
  if (baseUrl) {
    for (const path of ["/uslugi", "/rezerwacja", "/voucher", "/sitemap.xml"]) assert.ok(!(await page(path)).includes(slug), `${path} still shows archived massage`);
    assert.ok((await page(`/uslugi/${slug}`)).includes("noindex"));
  }
  if (baseUrl) {
    const reactivated = await fetch(new URL("/api/admin/massages/active", baseUrl), { method: "POST", headers: { Cookie: localTestCookie("owner"), Origin: baseUrl, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ id: slug, active: "true" }) });
    assert.equal(reactivated.status, 200);
  } else await setAdminMassageActive(session, slug, true);
  assert.equal((await getPublicMassageBySlug(slug))?.isActive, true);
  assert.deepEqual(await db.select({ id: bookings.id, name: bookings.massageNameSnapshot, price: bookings.priceGroszeSnapshot, total: bookings.totalPriceGroszeSnapshot }).from(bookings).orderBy(bookings.id), oldBookingSnapshots);
  assert.deepEqual(await db.select({ id: voucherOrders.id, name: voucherOrders.massageNameSnapshot, price: voucherOrders.priceGroszeSnapshot }).from(voucherOrders).orderBy(voucherOrders.id), oldVoucherSnapshots);
  process.stdout.write("CMS local smoke test: create, price edit, archive, reactivate, catalog and owner guard PASS\n");
} finally {
  if (created) {
    await db.transaction(async (tx) => {
      await tx.delete(massageVariants).where(eq(massageVariants.massageId, slug));
      await tx.delete(massageContent).where(eq(massageContent.massageId, slug));
      await tx.delete(massages).where(eq(massages.id, slug));
    });
    assert.equal((await db.select({ id: massages.id }).from(massages).where(eq(massages.id, slug))).length, 0);
    process.stdout.write("CMS local smoke test: test massage removed\n");
  }
}
