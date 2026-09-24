import "dotenv/config";

import { db } from "../src/db";
import { addons, massageAddons } from "../src/db/schema";

// Development-only examples. Names, descriptions, timing and prices are NOT
// approved ORHEA offer data; never run this script against staging/production.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const databaseHost = new URL(connectionString).hostname;

if (
  !["localhost", "127.0.0.1", "::1"].includes(databaseHost) ||
  process.env.NODE_ENV === "production" ||
  process.env.PUBLIC_SITE_ENV === "staging" ||
  process.env.PUBLIC_SITE_ENV === "production"
) {
  throw new Error("Addon examples may only be seeded into a local development database");
}

const examples = [
  {
    id: "dev-addon-aromatherapy",
    name: "TEST — Aromaterapia",
    description: "Przykładowy dodatek do testów — oferta nie jest ostateczna.",
    treatmentDurationMinutes: 10,
    slotExtensionMinutes: 10,
    priceGrosze: 1000,
    isActive: true,
    isConfirmed: true,
    notes: "Wyłącznie lokalny przykład developerski. Nie publikować jako oferty klienta.",
  },
  {
    id: "dev-addon-relaxation",
    name: "TEST — Dodatkowy czas relaksu",
    description: "Przykładowy dodatek do testów — oferta nie jest ostateczna.",
    treatmentDurationMinutes: 20,
    slotExtensionMinutes: 20,
    priceGrosze: 2500,
    isActive: true,
    isConfirmed: true,
    notes: "Wyłącznie lokalny przykład developerski. Nie publikować jako oferty klienta.",
  },
  {
    id: "dev-addon-inactive",
    name: "TEST — Nieaktywny dodatek",
    description: null,
    treatmentDurationMinutes: null,
    slotExtensionMinutes: 0,
    priceGrosze: 100,
    isActive: false,
    isConfirmed: true,
    notes: "Przypadek testowy: nie pokazywać publicznie.",
  },
  {
    id: "dev-addon-unconfirmed",
    name: "TEST — Niepotwierdzony dodatek",
    description: null,
    treatmentDurationMinutes: null,
    slotExtensionMinutes: 0,
    priceGrosze: 100,
    isActive: true,
    isConfirmed: false,
    notes: "Przypadek testowy: nie pokazywać publicznie.",
  },
] as const;

await db.insert(addons).values([...examples]).onConflictDoNothing();

await db.insert(massageAddons).values([
  { massageId: "classic-back", addonId: "dev-addon-aromatherapy" },
  { massageId: "relaxing-body", addonId: "dev-addon-aromatherapy" },
  { massageId: "relaxing-body", addonId: "dev-addon-relaxation" },
  { massageId: "relaxing-body", addonId: "dev-addon-inactive" },
  { massageId: "relaxing-body", addonId: "dev-addon-unconfirmed" },
]).onConflictDoNothing();

console.info("Local addon examples are ready: classic-back (1), relaxing-body (2), desk-relief (0).");
