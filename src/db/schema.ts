import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  pgEnum,
  uniqueIndex,
  foreignKey,
  primaryKey,
  unique,
  date,
  time,
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

export const bookingSourceEnum = pgEnum("booking_source", ["public", "admin"]);

export const bookingEventTypeEnum = pgEnum("booking_event_type", [
  "status_changed",
  "rescheduled",
  "specialist_changed",
]);

export const calendarSyncStatusEnum = pgEnum("calendar_sync_status", [
  "pending",
  "synced",
  "failed",
]);

export const specialistCalendarPurposeEnum = pgEnum(
  "specialist_calendar_purpose",
  ["availability", "bookings"],
);

export const bookingLocationTypeEnum = pgEnum("booking_location_type", [
  "salon",
  "mobile",
]);

export const locationVerificationStatusEnum = pgEnum(
  "location_verification_status",
  ["not_required", "pending", "approved", "rejected"],
);

export const preferredContactTimeEnum = pgEnum("preferred_contact_time", [
  "morning",
  "afternoon",
  "evening",
]);

export const serviceInquiryTypeEnum = pgEnum("service_inquiry_type", [
  "event_organization",
  "client_travel",
]);

export const serviceInquiryStatusEnum = pgEnum("service_inquiry_status", [
  "pending",
  "confirmed",
  "cancelled",
  "rejected",
]);

export const voucherOrderStatusEnum = pgEnum("voucher_order_status", [
  "pending_payment",
  "paid",
  "failed",
  "cancelled",
]);

export const voucherTypeEnum = pgEnum("voucher_type", ["service", "amount"]);

export const voucherDeliveryTypeEnum = pgEnum("voucher_delivery_type", [
  "electronic",
  "paper",
]);

export const paymentProviderEnum = pgEnum("payment_provider", ["stripe"]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "refunded",
]);

export const voucherStatusEnum = pgEnum("voucher_status", [
  "active",
  "redeemed",
  "expired",
  "cancelled",
]);

export const voucherEventTypeEnum = pgEnum("voucher_event_type", [
  "redeemed",
  "restored",
]);

export const voucherEmailDeliveryStatusEnum = pgEnum(
  "voucher_email_delivery_status",
  ["pending", "sent", "failed"],
);

export const weekdayEnum = pgEnum("weekday", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export const GLOBAL_BOOKING_SETTINGS_ID = "default";

export const bookingSettings = pgTable(
  "booking_settings",
  {
    id: text("id").primaryKey(),

    bufferMinutes: integer("buffer_minutes").notNull(),

    slotStepMinutes: integer("slot_step_minutes").notNull().default(30),

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
    check(
      "booking_settings_buffer_non_negative",
      sql`${table.bufferMinutes} >= 0`,
    ),

    check(
      "booking_settings_slot_step_positive",
      sql`${table.slotStepMinutes} > 0`,
    ),
  ],
);

export const REPORT_SETTINGS_ID = "default";

export const reportSettings = pgTable("report_settings", {
  id: text("id").primaryKey(),

  ownerEmail: text("owner_email"),

  folderId: text("folder_id"),

  aleksandraEmail: text("aleksandra_email"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const specialistAvailabilitySettings = pgTable(
  "specialist_availability_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, {
        onDelete: "restrict",
      }),

    minNoticeMinutes: integer("min_notice_minutes").notNull().default(240),

    maxAdvanceDays: integer("max_advance_days").notNull().default(60),

    maxBookingsPerDay: integer("max_bookings_per_day"),

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
    uniqueIndex("specialist_availability_settings_specialist_id_unique").on(
      table.specialistId,
    ),

    check(
      "specialist_availability_settings_min_notice_non_negative",
      sql`${table.minNoticeMinutes} >= 0`,
    ),

    check(
      "specialist_availability_settings_max_advance_positive",
      sql`${table.maxAdvanceDays} > 0`,
    ),

    check(
      "specialist_availability_settings_max_bookings_positive",
      sql`
        ${table.maxBookingsPerDay} IS NULL
        OR ${table.maxBookingsPerDay} > 0
      `,
    ),
  ],
);

export const specialistAvailabilityRules = pgTable(
  "specialist_availability_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, {
        onDelete: "restrict",
      }),

    weekday: weekdayEnum("weekday").notNull(),

    startTime: time("start_time").notNull(),

    endTime: time("end_time").notNull(),

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
    index("specialist_availability_rules_specialist_id_idx").on(
      table.specialistId,
    ),

    unique("specialist_availability_rules_unique").on(
      table.specialistId,
      table.weekday,
      table.startTime,
      table.endTime,
    ),

    check(
      "specialist_availability_rules_valid_time",
      sql`${table.startTime} < ${table.endTime}`,
    ),
  ],
);

export const specialistAvailabilityOverrides = pgTable(
  "specialist_availability_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    specialistId: text("specialist_id")
      .notNull()
      .references(() => specialists.id, {
        onDelete: "restrict",
      }),

    date: date("date").notNull(),

    startTime: time("start_time"),

    endTime: time("end_time"),

    isAvailable: boolean("is_available").notNull(),

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
    index("specialist_availability_overrides_specialist_id_idx").on(
      table.specialistId,
    ),

    index("specialist_availability_overrides_date_idx").on(table.date),

    check(
      "specialist_availability_overrides_time_consistency",
      sql`
        (
          ${table.isAvailable} = false
          AND ${table.startTime} IS NULL
          AND ${table.endTime} IS NULL
        )
        OR
        (
          ${table.isAvailable} = true
          AND ${table.startTime} IS NOT NULL
          AND ${table.endTime} IS NOT NULL
          AND ${table.startTime} < ${table.endTime}
        )
      `,
    ),
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
    unique("massage_variants_massage_code_unique").on(
      table.massageId,
      table.code,
    ),

    unique("massage_variants_id_massage_id_unique").on(
      table.id,
      table.massageId,
    ),

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

    purpose: specialistCalendarPurposeEnum("purpose").notNull(),

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
    uniqueIndex("specialist_calendars_specialist_id_purpose_unique").on(
      table.specialistId,

      table.purpose,
    ),

    uniqueIndex("specialist_calendars_google_calendar_id_unique").on(
      table.googleCalendarId,
    ),
  ],
);

// addons
export const addons = pgTable(
  "addons",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),

    treatmentDurationMinutes: integer("treatment_duration_minutes"),

    slotExtensionMinutes: integer("slot_extension_minutes")
      .notNull()
      .default(0),

    priceGrosze: integer("price_grosze"),

    isActive: boolean("is_active").notNull().default(false),

    isConfirmed: boolean("is_confirmed").notNull().default(false),

    notes: text("notes"),

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
    check(
      "addons_price_non_negative",
      sql`${table.priceGrosze} IS NULL OR ${table.priceGrosze} >= 0`,
    ),

    check(
      "addons_treatment_duration_positive",
      sql`
        ${table.treatmentDurationMinutes} IS NULL
        OR ${table.treatmentDurationMinutes} > 0
      `,
    ),

    check(
      "addons_slot_extension_non_negative",
      sql`${table.slotExtensionMinutes} >= 0`,
    ),
  ],
);

//  massage addons
export const massageAddons = pgTable(
  "massage_addons",
  {
    massageId: text("massage_id")
      .notNull()
      .references(() => massages.id, {
        onDelete: "restrict",
      }),

    addonId: text("addon_id")
      .notNull()
      .references(() => addons.id, {
        onDelete: "restrict",
      }),
  },
  (table) => [
    primaryKey({
      columns: [table.massageId, table.addonId],
    }),
  ],
);

// bookings
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    status: bookingStatusEnum("status").notNull().default("pending"),

    source: bookingSourceEnum("source").notNull().default("public"),

    createdByUsername: text("created_by_username"),

    createdByRole: text("created_by_role"),

    availabilityOverride: boolean("availability_override")
      .notNull()
      .default(false),

    availabilityOverrideReasons: jsonb("availability_override_reasons").$type<
      Array<{ type: string; message: string }>
    >(),

    adminCreationKey: uuid("admin_creation_key"),

    calendarSyncStatus: calendarSyncStatusEnum("calendar_sync_status")
      .notNull()
      .default("pending"),

    googleCalendarEventId: text("google_calendar_event_id"),

    calendarSyncLastError: text("calendar_sync_last_error"),

    calendarSyncAttemptedAt: timestamp("calendar_sync_attempted_at", {
      withTimezone: true,
    }),

    calendarSyncedAt: timestamp("calendar_synced_at", {
      withTimezone: true,
    }),

    massageId: text("massage_id").notNull(),

    massageVariantId: uuid("massage_variant_id").notNull(),

    massageNameSnapshot: text("massage_name_snapshot").notNull(),

    durationMinutesSnapshot: integer("duration_minutes_snapshot"),

    durationLabelSnapshot: text("duration_label_snapshot"),

    bookingSlotMinutesSnapshot: integer(
      "booking_slot_minutes_snapshot",
    ).notNull(),

    priceGroszeSnapshot: integer("price_grosze_snapshot").notNull(),

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

    confirmedAt: timestamp("confirmed_at", {
      withTimezone: true,
    }),

    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
    }),

    rejectedAt: timestamp("rejected_at", {
      withTimezone: true,
    }),

    locationType: bookingLocationTypeEnum("location_type").notNull(),

    locationVerificationStatus: locationVerificationStatusEnum(
      "location_verification_status",
    )
      .notNull()
      .default("not_required"),

    mobileStreet: text("mobile_street"),
    mobileBuildingNumber: text("mobile_building_number"),
    mobileApartmentNumber: text("mobile_apartment_number"),
    mobilePostalCode: text("mobile_postal_code"),
    mobileCity: text("mobile_city"),

    customerFirstName: text("customer_first_name").notNull(),

    customerLastName: text("customer_last_name").notNull(),

    customerEmail: text("customer_email").notNull(),

    customerPhone: text("customer_phone"),

    contactByEmail: boolean("contact_by_email").notNull().default(false),

    contactByPhone: boolean("contact_by_phone").notNull().default(false),

    preferredContactTime: preferredContactTimeEnum("preferred_contact_time"),

    notes: text("notes"),

    termsAcceptedAt: timestamp("terms_accepted_at", {
      withTimezone: true,
    }),

    privacyAcceptedAt: timestamp("privacy_accepted_at", {
      withTimezone: true,
    }),

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
      columns: [table.massageVariantId, table.massageId],
      foreignColumns: [massageVariants.id, massageVariants.massageId],
      name: "bookings_massage_variant_massage_fk",
    }).onDelete("restrict"),

    index("bookings_status_idx").on(table.status),

    index("bookings_specialist_idx").on(table.specialistId),

    index("bookings_requested_start_idx").on(table.requestedStartAt),

    index("bookings_confirmed_start_idx").on(table.confirmedStartAt),

    uniqueIndex("bookings_admin_creation_key_unique").on(
      table.adminCreationKey,
    ),

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
      "bookings_source_metadata_valid",
      sql`
        (
          ${table.source} = 'public'
          AND ${table.termsAcceptedAt} IS NOT NULL
          AND ${table.privacyAcceptedAt} IS NOT NULL
          AND ${table.createdByUsername} IS NULL
          AND ${table.adminCreationKey} IS NULL
        )
        OR
        (
          ${table.source} = 'admin'
          AND ${table.termsAcceptedAt} IS NULL
          AND ${table.privacyAcceptedAt} IS NULL
          AND ${table.createdByUsername} IS NOT NULL
          AND ${table.createdByRole} = 'owner'
          AND ${table.adminCreationKey} IS NOT NULL
        )
      `,
    ),

    check(
      "bookings_override_metadata_valid",
      sql`
        (
          ${table.availabilityOverride} = FALSE
          AND ${table.availabilityOverrideReasons} IS NULL
        )
        OR
        (
          ${table.source} = 'admin'
          AND ${table.availabilityOverride} = TRUE
          AND ${table.availabilityOverrideReasons} IS NOT NULL
        )
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

// booking_events
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, {
        onDelete: "restrict",
      }),

    eventType: bookingEventTypeEnum("event_type").notNull(),

    fromStatus: bookingStatusEnum("from_status"),

    toStatus: bookingStatusEnum("to_status"),

    previousStartAt: timestamp("previous_start_at", { withTimezone: true }),

    previousEndAt: timestamp("previous_end_at", { withTimezone: true }),

    newStartAt: timestamp("new_start_at", { withTimezone: true }),

    newEndAt: timestamp("new_end_at", { withTimezone: true }),

    previousSpecialistId: text("previous_specialist_id"),

    newSpecialistId: text("new_specialist_id"),

    actorUsername: text("actor_username"),

    actorRole: text("actor_role"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("booking_events_booking_id_created_at_idx").on(
      table.bookingId,
      table.createdAt,
    ),

    check(
      "booking_events_payload_valid",
      sql`
        (
          ${table.eventType} = 'status_changed'
          AND ${table.fromStatus} IS NOT NULL
          AND ${table.toStatus} IS NOT NULL
        )
        OR
        (
          ${table.eventType} = 'rescheduled'
          AND ${table.previousStartAt} IS NOT NULL
          AND ${table.previousEndAt} IS NOT NULL
          AND ${table.newStartAt} IS NOT NULL
          AND ${table.newEndAt} IS NOT NULL
        )
        OR
        (
          ${table.eventType} = 'specialist_changed'
          AND ${table.previousSpecialistId} IS NOT NULL
          AND ${table.newSpecialistId} IS NOT NULL
        )
      `,
    ),
  ],
);

export const serviceInquiries = pgTable(
  "service_inquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    type: serviceInquiryTypeEnum("type").notNull(),

    status: serviceInquiryStatusEnum("status").notNull().default("pending"),

    customerName: text("customer_name").notNull(),

    customerEmail: text("customer_email").notNull(),

    customerPhone: text("customer_phone").notNull(),

    desiredDate: date("desired_date", { mode: "string" }).notNull(),

    location: text("location").notNull(),

    notes: text("notes"),

    privacyAcceptedAt: timestamp("privacy_accepted_at", {
      withTimezone: true,
    }).notNull(),

    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),

    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),

    rejectedAt: timestamp("rejected_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("service_inquiries_status_idx").on(table.status),
    index("service_inquiries_desired_date_idx").on(table.desiredDate),
    index("service_inquiries_created_at_idx").on(table.createdAt),
  ],
);

// voucher_orders
export const voucherOrders = pgTable(
  "voucher_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    status: voucherOrderStatusEnum("status")
      .notNull()
      .default("pending_payment"),

    voucherType: voucherTypeEnum("voucher_type").notNull(),

    massageId: text("massage_id").references(() => massages.id, {
      onDelete: "restrict",
    }),

    massageVariantId: uuid("massage_variant_id"),

    massageNameSnapshot: text("massage_name_snapshot"),

    durationMinutesSnapshot: integer("duration_minutes_snapshot"),

    durationLabelSnapshot: text("duration_label_snapshot"),

    priceGroszeSnapshot: integer("price_grosze_snapshot"),

    amountGrosze: integer("amount_grosze").notNull(),

    deliveryType: voucherDeliveryTypeEnum("delivery_type")
      .notNull()
      .default("electronic"),

    deliveryFeeGrosze: integer("delivery_fee_grosze").notNull().default(0),

    paperSurchargeGrosze: integer("paper_surcharge_grosze")
      .notNull()
      .default(0),

    totalAmountGrosze: integer("total_amount_grosze").notNull(),

    currency: text("currency").notNull().default("PLN"),

    buyerFirstName: text("buyer_first_name").notNull(),

    buyerLastName: text("buyer_last_name").notNull(),

    buyerEmail: text("buyer_email").notNull(),

    recipientName: text("recipient_name"),

    shippingFirstName: text("shipping_first_name"),

    shippingLastName: text("shipping_last_name"),

    shippingStreet: text("shipping_street"),

    shippingBuildingNumber: text("shipping_building_number"),

    shippingApartmentNumber: text("shipping_apartment_number"),

    shippingPostalCode: text("shipping_postal_code"),

    shippingCity: text("shipping_city"),

    paperSentAt: timestamp("paper_sent_at", { withTimezone: true }),

    message: text("message"),

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
      columns: [table.massageVariantId, table.massageId],
      foreignColumns: [massageVariants.id, massageVariants.massageId],
      name: "voucher_orders_massage_variant_massage_fk",
    }).onDelete("restrict"),

    index("voucher_orders_status_idx").on(table.status),

    index("voucher_orders_buyer_email_idx").on(table.buyerEmail),

    index("voucher_orders_created_at_idx").on(table.createdAt),

    check(
      "voucher_orders_amount_positive",
      sql`${table.amountGrosze} > 0`,
    ),

    check(
      "voucher_orders_delivery_fee_non_negative",
      sql`${table.deliveryFeeGrosze} >= 0`,
    ),

    check(
      "voucher_orders_paper_surcharge_non_negative",
      sql`${table.paperSurchargeGrosze} >= 0`,
    ),

    check(
      "voucher_orders_total_amount_valid",
      sql`${table.totalAmountGrosze} = ${table.amountGrosze} + ${table.paperSurchargeGrosze} + ${table.deliveryFeeGrosze} AND ${table.totalAmountGrosze} > 0`,
    ),

    check(
      "voucher_orders_delivery_data_valid",
      sql`
        (
          ${table.deliveryType} = 'electronic'
          AND ${table.paperSurchargeGrosze} = 0
          AND ${table.deliveryFeeGrosze} = 0
          AND ${table.shippingFirstName} IS NULL
          AND ${table.shippingLastName} IS NULL
          AND ${table.shippingStreet} IS NULL
          AND ${table.shippingBuildingNumber} IS NULL
          AND ${table.shippingApartmentNumber} IS NULL
          AND ${table.shippingPostalCode} IS NULL
          AND ${table.shippingCity} IS NULL
        )
        OR
        (
          ${table.deliveryType} = 'paper'
          AND ${table.shippingStreet} IS NOT NULL
          AND ${table.shippingBuildingNumber} IS NOT NULL
          AND ${table.shippingPostalCode} IS NOT NULL
          AND ${table.shippingCity} IS NOT NULL
        )
      `,
    ),

    check(
      "voucher_orders_currency_non_empty",
      sql`length(btrim(${table.currency})) > 0`,
    ),

    check(
      "voucher_orders_type_relations_valid",
      sql`
        (
          ${table.voucherType} = 'service'
          AND ${table.massageId} IS NOT NULL
          AND ${table.massageVariantId} IS NOT NULL
        )
        OR
        (
          ${table.voucherType} = 'amount'
          AND ${table.massageId} IS NULL
          AND ${table.massageVariantId} IS NULL
        )
      `,
    ),

    check(
      "voucher_orders_service_price_present",
      sql`
        ${table.voucherType} <> 'service'
        OR ${table.priceGroszeSnapshot} IS NOT NULL
      `,
    ),
  ],
);

// payments
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    voucherOrderId: uuid("voucher_order_id")
      .notNull()
      .references(() => voucherOrders.id, {
        onDelete: "restrict",
      }),

    provider: paymentProviderEnum("provider").notNull().default("stripe"),

    status: paymentStatusEnum("status").notNull().default("pending"),

    providerCheckoutSessionId: text(
      "provider_checkout_session_id",
    ).notNull(),

    providerPaymentIntentId: text("provider_payment_intent_id"),

    amountGrosze: integer("amount_grosze").notNull(),

    currency: text("currency").notNull().default("PLN"),

    paidAt: timestamp("paid_at", {
      withTimezone: true,
    }),

    failedAt: timestamp("failed_at", {
      withTimezone: true,
    }),

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
    index("payments_voucher_order_id_idx").on(table.voucherOrderId),

    index("payments_status_idx").on(table.status),

    uniqueIndex("payments_provider_checkout_session_id_unique").on(
      table.providerCheckoutSessionId,
    ),

    uniqueIndex("payments_provider_payment_intent_id_unique")
      .on(table.providerPaymentIntentId)
      .where(sql`${table.providerPaymentIntentId} IS NOT NULL`),

    check("payments_amount_positive", sql`${table.amountGrosze} > 0`),

    check(
      "payments_currency_non_empty",
      sql`length(btrim(${table.currency})) > 0`,
    ),
  ],
);

// vouchers
export const vouchers = pgTable(
  "vouchers",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    voucherOrderId: uuid("voucher_order_id")
      .notNull()
      .references(() => voucherOrders.id, {
        onDelete: "restrict",
      }),

    code: text("code").notNull(),

    status: voucherStatusEnum("status").notNull().default("active"),

    emailDeliveryStatus: voucherEmailDeliveryStatusEnum(
      "email_delivery_status",
    )
      .notNull()
      .default("pending"),

    emailAttemptedAt: timestamp("email_attempted_at", {
      withTimezone: true,
    }),

    emailSentAt: timestamp("email_sent_at", {
      withTimezone: true,
    }),

    emailLastError: text("email_last_error"),

    voucherType: voucherTypeEnum("voucher_type").notNull(),

    massageId: text("massage_id").references(() => massages.id, {
      onDelete: "restrict",
    }),

    massageVariantId: uuid("massage_variant_id"),

    massageNameSnapshot: text("massage_name_snapshot"),

    durationMinutesSnapshot: integer("duration_minutes_snapshot"),

    durationLabelSnapshot: text("duration_label_snapshot"),

    priceGroszeSnapshot: integer("price_grosze_snapshot"),

    amountGrosze: integer("amount_grosze").notNull(),

    currency: text("currency").notNull().default("PLN"),

    recipientName: text("recipient_name"),

    message: text("message"),

    issuedAt: timestamp("issued_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    expiresAt: timestamp("expires_at", {
      withTimezone: true,
    }).notNull(),

    redeemedAt: timestamp("redeemed_at", {
      withTimezone: true,
    }),

    cancelledAt: timestamp("cancelled_at", {
      withTimezone: true,
    }),

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
      columns: [table.massageVariantId, table.massageId],
      foreignColumns: [massageVariants.id, massageVariants.massageId],
      name: "vouchers_massage_variant_massage_fk",
    }).onDelete("restrict"),

    uniqueIndex("vouchers_voucher_order_id_unique").on(table.voucherOrderId),

    uniqueIndex("vouchers_code_unique").on(table.code),

    index("vouchers_status_idx").on(table.status),

    index("vouchers_email_delivery_status_idx").on(
      table.emailDeliveryStatus,
    ),

    index("vouchers_expires_at_idx").on(table.expiresAt),

    check("vouchers_amount_positive", sql`${table.amountGrosze} > 0`),

    check(
      "vouchers_currency_non_empty",
      sql`length(btrim(${table.currency})) > 0`,
    ),

    check(
      "vouchers_expiry_after_issue",
      sql`${table.expiresAt} > ${table.issuedAt}`,
    ),

    check(
      "vouchers_type_relations_valid",
      sql`
        (
          ${table.voucherType} = 'service'
          AND ${table.massageId} IS NOT NULL
          AND ${table.massageVariantId} IS NOT NULL
        )
        OR
        (
          ${table.voucherType} = 'amount'
          AND ${table.massageId} IS NULL
          AND ${table.massageVariantId} IS NULL
        )
      `,
    ),

    check(
      "vouchers_service_price_present",
      sql`
        ${table.voucherType} <> 'service'
        OR ${table.priceGroszeSnapshot} IS NOT NULL
      `,
    ),
  ],
);

// voucher_events
export const voucherEvents = pgTable(
  "voucher_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => vouchers.id, {
        onDelete: "restrict",
      }),

    eventType: voucherEventTypeEnum("event_type").notNull(),

    actorUsername: text("actor_username"),

    actorRole: text("actor_role"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("voucher_events_voucher_id_created_at_idx").on(
      table.voucherId,
      table.createdAt,
    ),
  ],
);
