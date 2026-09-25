// One-time source-to-SQL generator for migration 0029. Never run against a DB.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, URL } from "node:url";
import process from "node:process";
import console from "node:console";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const migrationUrl = new URL("drizzle/0029_spotty_paladin.sql", root);

const parse = (path) => ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const declarations = (source) => {
  const result = new Map();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        result.set(declaration.name.text, declaration.initializer);
      }
    }
  }
  return result;
};
const evaluate = (node, vars) => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(node)) {
    const value = vars.get(node.text);
    if (!value) throw new Error(`Unknown catalog constant: ${node.text}`);
    return evaluate(value, vars);
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((item) => evaluate(item, vars));
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(node.properties.map((property) => {
      if (!ts.isPropertyAssignment(property)) throw new Error("Unsupported catalog property");
      const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
        ? property.name.text
        : null;
      if (!key) throw new Error("Unsupported catalog key");
      return [key, evaluate(property.initializer, vars)];
    }));
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return evaluate(node.expression, vars);
  }
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "createPage") {
    return { massageId: evaluate(node.arguments[0], vars), ...evaluate(node.arguments[1], vars) };
  }
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "map") {
    const callback = node.arguments[0];
    if (!callback || !ts.isArrowFunction(callback) || callback.parameters.length !== 1 ||
      !ts.isIdentifier(callback.parameters[0].name) || !ts.isPropertyAccessExpression(callback.body) ||
      !ts.isIdentifier(callback.body.expression) || callback.body.expression.text !== callback.parameters[0].name.text) {
      throw new Error("Unsupported catalog map expression");
    }
    return evaluate(node.expression.expression, vars).map((item) => item[callback.body.name.text]);
  }
  throw new Error(`Unsupported catalog syntax: ${ts.SyntaxKind[node.kind]}`);
};
const massageVars = declarations(parse("src/data/massages.ts"));
const pageVars = declarations(parse("src/data/massage-pages.ts"));
const massages = evaluate(massageVars.get("massages"), massageVars);
const pages = evaluate(pageVars.get("massagePageById"), pageVars);
export { massages, pages };
if (massages.length !== 18 || Object.keys(pages).length !== massages.length) {
  throw new Error("Unexpected massage catalog size; review migration before regenerating");
}
const quote = (value) => value === null || value === undefined
  ? "NULL"
  : `'${String(value).replaceAll("'", "''")}'`;
const array = (values) => `ARRAY[${values.map(quote).join(", ")}]::text[]`;
const json = (value) => value === undefined ? "NULL" : `${quote(JSON.stringify(value))}::jsonb`;
const bool = (value) => value ? "TRUE" : "FALSE";
const statements = [];

// Existing transactional fields (name, flags, price, duration, active) remain untouched.
for (const massage of massages) {
  if (pages[massage.id]?.massageId !== massage.id) throw new Error(`Missing content for ${massage.id}`);
  const visualKey = ["classic-back", "desk-relief"].includes(massage.id) ? massage.id : massage.zoneId;
  statements.push(`INSERT INTO "massages" ("id", "name", "slug", "zone_id", "title", "service_name", "short_description", "labels", "sort_order", "visual_key", "is_active", "booking_available", "voucher_available") VALUES (${[
    quote(massage.id), quote(massage.serviceName ? `${massage.title} — ${massage.serviceName}` : massage.title), quote(massage.slug), quote(massage.zoneId), quote(massage.title), quote(massage.serviceName), quote(massage.shortDescription), array(massage.labels), massage.order, quote(visualKey), "TRUE", bool(massage.bookingAvailable), bool(massage.voucherAvailable),
  ].join(", ")}) ON CONFLICT ("id") DO UPDATE SET "slug" = EXCLUDED."slug", "zone_id" = EXCLUDED."zone_id", "title" = EXCLUDED."title", "service_name" = EXCLUDED."service_name", "short_description" = EXCLUDED."short_description", "labels" = EXCLUDED."labels", "sort_order" = EXCLUDED."sort_order", "visual_key" = EXCLUDED."visual_key";`);
}
for (const massage of massages) {
  for (const [index, variant] of massage.variants.entries()) {
    const duration = variant.durationMinutes ?? null;
    const code = duration === null ? "vip" : `${duration}-min`;
    statements.push(`INSERT INTO "massage_variants" ("massage_id", "code", "duration_minutes", "duration_label", "booking_slot_minutes", "price_grosze", "is_active", "sort_order") VALUES (${[
      quote(massage.id), quote(code), duration === null ? "NULL" : duration, quote(variant.durationLabel), variant.bookingSlotMinutes ?? duration, variant.pricePLN * 100, "TRUE", index,
    ].join(", ")}) ON CONFLICT ("massage_id", "code") DO UPDATE SET "sort_order" = EXCLUDED."sort_order";`);
  }
}
// Preserve any pre-existing custom variant; give it a deterministic order after canonical ones.
statements.push(`WITH missing AS (
  SELECT "id", row_number() OVER (PARTITION BY "massage_id" ORDER BY "created_at", "id") - 1 AS position
  FROM "massage_variants" WHERE "sort_order" IS NULL
), counts AS (
  SELECT "massage_id", count(*) AS canonical_count FROM "massage_variants" WHERE "sort_order" IS NOT NULL GROUP BY "massage_id"
)
UPDATE "massage_variants" AS variant SET "sort_order" = COALESCE(counts.canonical_count, 0) + missing.position
FROM missing LEFT JOIN counts ON counts."massage_id" = (SELECT "massage_id" FROM "massage_variants" WHERE "id" = missing."id")
WHERE variant."id" = missing."id";`);
for (const massage of massages) {
  const page = pages[massage.id];
  statements.push(`INSERT INTO "massage_content" ("massage_id", "tagline", "description", "body_visual_key", "body_visual_alt", "for_whom", "expectations", "safety", "steps", "booking_cta", "seo_phrases", "related_massage_ids") VALUES (${[
    quote(massage.id), quote(page.tagline), json(page.description), quote(massage.zoneId), quote(page.bodyVisualAlt ?? massage.serviceName ?? massage.title), json(page.forWhom), json(page.expectations), json(page.safety), json(page.steps), json(page.booking), array(page.seoPhrases), array(page.relatedMassageIds),
  ].join(", ")}) ON CONFLICT ("massage_id") DO NOTHING;`);
}
statements.push(`DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "massages" WHERE "slug" IS NULL) THEN
    RAISE EXCEPTION 'Unknown massage without catalog metadata; migrate it explicitly before applying NOT NULL constraints';
  END IF;
END $$;`);
for (const column of ["slug", "zone_id", "title", "short_description", "labels", "sort_order", "visual_key"]) {
  statements.push(`ALTER TABLE "massages" ALTER COLUMN "${column}" SET NOT NULL;`);
}
statements.push(`ALTER TABLE "massage_variants" ALTER COLUMN "sort_order" SET NOT NULL;`);

const start = "-- catalog-data:start";
const end = "-- catalog-data:end";
const migration = readFileSync(migrationUrl, "utf8");
const first = migration.indexOf(start);
const last = migration.indexOf(end);
if (first < 0 || last < first) throw new Error("Migration marker missing");
const generated = `${start}\n${statements.join("\n--> statement-breakpoint\n")}\n${end}`;
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  writeFileSync(migrationUrl, migration.slice(0, first) + generated + migration.slice(last + end.length));
  console.log(`Generated catalog backfill for ${massages.length} massages`);
}
