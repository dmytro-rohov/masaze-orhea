import "dotenv/config";

import {
  massages as massageData,
  getMassageFullName,
} from "../src/data/massages";

import { db } from "../src/db";

import { massages, massageVariants, specialists } from "../src/db/schema";

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
    const hasDurationMinutes = "durationMinutes" in variant;

    const code = hasDurationMinutes ? `${variant.durationMinutes}-min` : "vip";

    const durationMinutes = hasDurationMinutes ? variant.durationMinutes : null;

    const durationLabel = hasDurationMinutes ? null : variant.durationLabel;

    const bookingSlotMinutes = hasDurationMinutes
      ? variant.durationMinutes
      : variant.bookingSlotMinutes;

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
  `Seed completed: ${specialistSeedData.length} specialists, ${massageData.length} massages processed.`,
);