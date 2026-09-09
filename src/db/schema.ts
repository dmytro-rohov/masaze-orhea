import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  uniqueIndex,
  foreignKey,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "rejected",
  "no_show",
]);

export const bookingLocationTypeEnum = pgEnum("booking_location_type", [
  "salon",
  "mobile",
]);

export const locationVerificationStatusEnum = pgEnum(
  "location_verification_status",
  [
    "not_required",
    "pending",
    "approved",
    "rejected",
  ],
);

export const preferredContactTimeEnum = pgEnum(
  "preferred_contact_time",
  [
    "morning",
    "afternoon",
    "evening",
  ],
);

// massages
export const massages = pgTable("massages", {
  id: text("id").primaryKey(),

  name: text("name").notNull(),

  isActive: boolean("is_active").notNull().default(true),

  bookingAvailable: boolean("booking_available").notNull().default(true),

  voucherAvailable: boolean("voucher_available").notNull().default(true),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

// massage_variants
export const massageVariants = pgTable(
  "massage_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    massageId: text("massage_id")
      .notNull()
      .references(() => massages.id, {
        onDelete: "restrict",
      }),

    code: text("code").notNull(),

    durationMinutes: integer("duration_minutes"),

    durationLabel: text("duration_label"),

    bookingSlotMinutes: integer("booking_slot_minutes").notNull(),

    priceGrosze: integer("price_grosze").notNull(),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("massage_variants_massage_code_unique")
      .on(table.massageId, table.code),

    unique("massage_variants_id_massage_id_unique")
      .on(table.id, table.massageId),

    index("massage_variants_massage_id_idx").on(table.massageId),

    check(
      "massage_variants_price_non_negative",
      sql`${table.priceGrosze} >= 0`,
    ),

    check(
      "massage_variants_booking_slot_positive",
      sql`${table.bookingSlotMinutes} > 0`,
    ),

    check(
      "massage_variants_duration_present",
      sql`
        ${table.durationMinutes} IS NOT NULL
        OR ${table.durationLabel} IS NOT NULL
      `,
    ),
  ],
);

// specialists
export const specialists = pgTable("specialists", {
  id: text("id").primaryKey(),

  displayName: text("display_name").notNull(),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});

// specialist_calendars
export const specialistCalendars = pgTable(
  "specialist_calendars",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, {
        onDelete: "restrict",
      }),

    googleCalendarId: text("google_calendar_id").notNull(),

    label: text("label"),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("specialist_calendars_specialist_id_unique").on(
      table.specialistId,
    ),

    uniqueIndex("specialist_calendars_google_calendar_id_unique").on(
      table.googleCalendarId,
    ),
  ],
);

// bookings
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    status: bookingStatusEnum("status")
      .notNull()
      .default("pending"),

    massageId: text("massage_id")
      .notNull(),

    massageVariantId: uuid("massage_variant_id")
      .notNull(),

    massageNameSnapshot: text("massage_name_snapshot")
      .notNull(),

    durationMinutesSnapshot: integer("duration_minutes_snapshot"),

    durationLabelSnapshot: text("duration_label_snapshot"),

    bookingSlotMinutesSnapshot: integer("booking_slot_minutes_snapshot")
      .notNull(),

    priceGroszeSnapshot: integer("price_grosze_snapshot")
      .notNull(),

    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, {
        onDelete: "restrict",
      }),

    requestedStartAt: timestamp("requested_start_at", {
      withTimezone: true,
    }).notNull(),

    requestedEndAt: timestamp("requested_end_at", {
      withTimezone: true,
    }).notNull(),

    confirmedStartAt: timestamp("confirmed_start_at", {
      withTimezone: true,
    }),

    confirmedEndAt: timestamp("confirmed_end_at", {
      withTimezone: true,
    }),

    locationType: bookingLocationTypeEnum("location_type")
      .notNull(),

    locationVerificationStatus:
      locationVerificationStatusEnum("location_verification_status")
        .notNull()
        .default("not_required"),

    mobileStreet: text("mobile_street"),
    mobileBuildingNumber: text("mobile_building_number"),
    mobileApartmentNumber: text("mobile_apartment_number"),
    mobilePostalCode: text("mobile_postal_code"),
    mobileCity: text("mobile_city"),

    customerFirstName: text("customer_first_name")
      .notNull(),

    customerLastName: text("customer_last_name")
      .notNull(),

    customerEmail: text("customer_email")
      .notNull(),

    customerPhone: text("customer_phone"),

    contactByEmail: boolean("contact_by_email")
      .notNull()
      .default(false),

    contactByPhone: boolean("contact_by_phone")
      .notNull()
      .default(false),

    preferredContactTime:
      preferredContactTimeEnum("preferred_contact_time"),

    notes: text("notes"),

    termsAcceptedAt: timestamp("terms_accepted_at", {
      withTimezone: true,
    }).notNull(),

    privacyAcceptedAt: timestamp("privacy_accepted_at", {
      withTimezone: true,
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [
        table.massageVariantId,
        table.massageId,
      ],
      foreignColumns: [
        massageVariants.id,
        massageVariants.massageId,
      ],
      name: "bookings_massage_variant_massage_fk",
    }).onDelete("restrict"),

    index("bookings_status_idx")
      .on(table.status),

    index("bookings_specialist_idx")
      .on(table.specialistId),

    index("bookings_requested_start_idx")
      .on(table.requestedStartAt),

    index("bookings_confirmed_start_idx")
      .on(table.confirmedStartAt),

    check(
      "bookings_price_non_negative",
      sql`${table.priceGroszeSnapshot} >= 0`,
    ),

    check(
      "bookings_booking_slot_positive",
      sql`${table.bookingSlotMinutesSnapshot} > 0`,
    ),

    check(
      "bookings_duration_present",
      sql`
        ${table.durationMinutesSnapshot} IS NOT NULL
        OR ${table.durationLabelSnapshot} IS NOT NULL
      `,
    ),

    check(
      "bookings_requested_time_valid",
      sql`${table.requestedEndAt} > ${table.requestedStartAt}`,
    ),

    check(
      "bookings_confirmed_time_valid",
      sql`
        (
          ${table.confirmedStartAt} IS NULL
          AND ${table.confirmedEndAt} IS NULL
        )
        OR
        (
          ${table.confirmedStartAt} IS NOT NULL
          AND ${table.confirmedEndAt} IS NOT NULL
          AND ${table.confirmedEndAt} > ${table.confirmedStartAt}
        )
      `,
    ),

    check(
      "bookings_contact_method_present",
      sql`
        ${table.contactByEmail} = TRUE
        OR ${table.contactByPhone} = TRUE
      `,
    ),

    check(
      "bookings_mobile_address_valid",
      sql`
        (
          ${table.locationType} = 'salon'
          AND ${table.locationVerificationStatus} = 'not_required'
        )
        OR
        (
          ${table.locationType} = 'mobile'
          AND ${table.mobileStreet} IS NOT NULL
          AND ${table.mobileBuildingNumber} IS NOT NULL
          AND ${table.mobilePostalCode} IS NOT NULL
          AND ${table.mobileCity} IS NOT NULL
        )
      `,
    ),
  ],
);
