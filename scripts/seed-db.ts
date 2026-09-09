import "dotenv/config";

import {
  massages as massageData,
  getMassageFullName,
} from "../src/data/massages";

import { db } from "../src/db";

import {
  addons,
  massages,
  massageVariants,
  specialists,
} from "../src/db/schema";

const specialistSeedData = [
  {
    id: "adrian",
    displayName: "Adrian",
  },
  {
    id: "aleksandra",
    displayName: "Aleksandra",
  },
] as const;

const addonSeedData = [
  {
    id: "aromatherapy",
    name: "Aromaterapia",
    treatmentDurationMinutes: null,
    slotExtensionMinutes: 0,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: możliwy element standardu premium lub dodatek na życzenie. Aleksandra wskazała orientacyjnie +10–15 zł, ale finalna zasada i cena nie są zatwierdzone.",
  },
  {
    id: "warm-compress",
    name: "Ciepły kompres / ciepłe ręczniki",
    treatmentDurationMinutes: 5,
    slotExtensionMinutes: 0,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: element szczególnie rozważany dla rytuału ORHEA i masaży relaksacyjnych. W VIP sauna już pełni podobną funkcję. Orientacyjnie +10 zł.",
  },
  {
    id: "foot-peeling",
    name: "Peeling stóp",
    treatmentDurationMinutes: 10,
    slotExtensionMinutes: 10,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: orientacyjnie +20–30 zł. Możliwy także jako element pakietu pielęgnacji stóp.",
  },
  {
    id: "back-peeling",
    name: "Peeling pleców",
    treatmentDurationMinutes: 10,
    slotExtensionMinutes: 10,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: orientacyjnie +25–35 zł. Możliwy jako opcjonalne rozszerzenie masażu obejmującego plecy.",
  },
  {
    id: "hand-peeling",
    name: "Peeling dłoni",
    treatmentDurationMinutes: 10,
    slotExtensionMinutes: 10,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes: "Roboczo: Aleksandra podała 5–10 min i orientacyjnie +15–25 zł.",
  },
  {
    id: "body-peeling",
    name: "Peeling całego ciała",
    treatmentDurationMinutes: 30,
    slotExtensionMinutes: 30,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: Aleksandra podała 20–30 min i orientacyjnie +50–80 zł. Dokładny czas i cena do potwierdzenia.",
  },
  {
    id: "scalp-massage",
    name: "Masaż skóry głowy",
    treatmentDurationMinutes: 10,
    slotExtensionMinutes: 10,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: orientacyjnie +25–30 zł. Może być wykonywany również w czasie działania masek, kompresów lub innych elementów rytuału, więc finalne wydłużenie slotu wymaga potwierdzenia.",
  },
  {
    id: "hand-massage",
    name: "Masaż dłoni",
    treatmentDurationMinutes: 10,
    slotExtensionMinutes: 10,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: orientacyjnie +20–25 zł. Może być wykonywany podczas działania masek lub innych elementów rytuału; finalne wydłużenie slotu do potwierdzenia.",
  },
  {
    id: "foot-massage",
    name: "Masaż stóp",
    treatmentDurationMinutes: 10,
    slotExtensionMinutes: 10,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: orientacyjnie +25–30 zł. Rozważany również jako część kąpieli, peelingu i masażu stóp.",
  },
  {
    id: "hot-stones-addon",
    name: "Ciepłe kamienie",
    treatmentDurationMinutes: 15,
    slotExtensionMinutes: 15,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: orientacyjnie +30–40 zł. Dostępność przy konkretnych masażach do ustalenia.",
  },
  {
    id: "sauna-addon",
    name: "Sauna",
    treatmentDurationMinutes: 20,
    slotExtensionMinutes: 20,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: orientacyjnie +30–50 zł. ORHEA VIP już zawiera saunę, więc nie powinna być tam osobno sprzedawana.",
  },
  {
    id: "body-mask",
    name: "Maska na ciało",
    treatmentDurationMinutes: 20,
    slotExtensionMinutes: 0,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: orientacyjnie +30–50 zł. Może działać równolegle z masażem innej strefy, dlatego slot extension pozostaje roboczo 0.",
  },
  {
    id: "back-mask",
    name: "Maska na plecy",
    treatmentDurationMinutes: 20,
    slotExtensionMinutes: 0,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: Aleksandra podała 15–20 min i orientacyjnie +30–45 zł. Możliwe wykonywanie innych elementów w tym czasie.",
  },
  {
    id: "hand-mask",
    name: "Maska na dłonie",
    treatmentDurationMinutes: 10,
    slotExtensionMinutes: 0,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: orientacyjnie +20–30 zł. Możliwe wykonywanie innych elementów w tym czasie.",
  },
  {
    id: "foot-mask",
    name: "Maska na stopy",
    treatmentDurationMinutes: 10,
    slotExtensionMinutes: 0,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: orientacyjnie +20–30 zł. Możliwe wykonywanie innych elementów w tym czasie.",
  },
  {
    id: "body-wrap",
    name: "Okład na ciało",
    treatmentDurationMinutes: 30,
    slotExtensionMinutes: 0,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes:
      "Roboczo: Aleksandra podała 20–30 min i orientacyjnie +40–70 zł. Sposób wykonywania i wpływ na czas rezerwacji do potwierdzenia.",
  },
  {
    id: "body-butter",
    name: "Masło do ciała",
    treatmentDurationMinutes: 10,
    slotExtensionMinutes: 10,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes: "Roboczo: Aleksandra podała 5–10 min i orientacyjnie +15–25 zł.",
  },
  {
    id: "intensive-body-moisturizing",
    name: "Intensywne nawilżenie ciała",
    treatmentDurationMinutes: 10,
    slotExtensionMinutes: 10,
    priceGrosze: null,
    isActive: false,
    isConfirmed: false,
    notes: "Roboczo: orientacyjnie +20–30 zł.",
  },
] as const;

for (const specialist of specialistSeedData) {
  await db
    .insert(specialists)
    .values({
      id: specialist.id,
      displayName: specialist.displayName,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: specialists.id,
      set: {
        displayName: specialist.displayName,
        isActive: true,
        updatedAt: new Date(),
      },
    });
}

for (const addon of addonSeedData) {
  await db
    .insert(addons)
    .values({
      id: addon.id,
      name: addon.name,
      treatmentDurationMinutes: addon.treatmentDurationMinutes,
      slotExtensionMinutes: addon.slotExtensionMinutes,
      priceGrosze: addon.priceGrosze,
      isActive: addon.isActive,
      isConfirmed: addon.isConfirmed,
      notes: addon.notes,
    })
    .onConflictDoUpdate({
      target: addons.id,
      set: {
        name: addon.name,
        treatmentDurationMinutes: addon.treatmentDurationMinutes,
        slotExtensionMinutes: addon.slotExtensionMinutes,
        priceGrosze: addon.priceGrosze,
        isActive: addon.isActive,
        isConfirmed: addon.isConfirmed,
        notes: addon.notes,
        updatedAt: new Date(),
      },
    });
}

for (const massage of massageData) {
  await db
    .insert(massages)
    .values({
      id: massage.id,
      name: getMassageFullName(massage),
      isActive: true,
      bookingAvailable: massage.bookingAvailable,
      voucherAvailable: massage.voucherAvailable,
    })
    .onConflictDoUpdate({
      target: massages.id,
      set: {
        isActive: true,
        name: getMassageFullName(massage),
        bookingAvailable: massage.bookingAvailable,
        voucherAvailable: massage.voucherAvailable,
        updatedAt: new Date(),
      },
    });

  for (const variant of massage.variants) {
    let code: string;
    let durationMinutes: number | null;
    let durationLabel: string | null;
    let bookingSlotMinutes: number;

    if (variant.durationMinutes !== undefined) {
      code = `${variant.durationMinutes}-min`;
      durationMinutes = variant.durationMinutes;
      durationLabel = null;
      bookingSlotMinutes = variant.durationMinutes;
    } else {
      code = "vip";
      durationMinutes = null;
      durationLabel = variant.durationLabel;
      bookingSlotMinutes = variant.bookingSlotMinutes;
    }
    const priceGrosze = variant.pricePLN * 100;

    await db
      .insert(massageVariants)
      .values({
        massageId: massage.id,
        code,
        durationMinutes,
        durationLabel,
        bookingSlotMinutes,
        priceGrosze,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [massageVariants.massageId, massageVariants.code],
        set: {
          durationMinutes,
          durationLabel,
          bookingSlotMinutes,
          priceGrosze,
          isActive: true,
          updatedAt: new Date(),
        },
      });
  }
}

console.log(
  `Seed completed: ${specialistSeedData.length} specialists, ${massageData.length} massages, ${addonSeedData.length} addons processed.`,
);
