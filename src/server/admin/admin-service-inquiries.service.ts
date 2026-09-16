import { and, asc, desc, eq, gte, ilike, lte, or } from "drizzle-orm";

import { db } from "@/db";
import {
  serviceInquiries,
  serviceInquiryStatusEnum,
} from "@/db/schema";
import { attemptServiceInquiryCustomerNotification } from "@/server/inquiries/service-inquiry-notification.service";

export const adminServiceInquiryStatuses = serviceInquiryStatusEnum.enumValues;
export type AdminServiceInquiryStatus =
  (typeof adminServiceInquiryStatuses)[number];

export type AdminServiceInquiryFilters = {
  status?: string;
  customer?: string;
  dateFrom?: string;
  dateTo?: string;
  period?: "upcoming" | "past";
};

export const getAdminServiceInquiries = async (
  filters: AdminServiceInquiryFilters,
) => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const customer = filters.customer?.trim().slice(0, 100);
  const status = adminServiceInquiryStatuses.includes(
    filters.status as AdminServiceInquiryStatus,
  )
    ? (filters.status as AdminServiceInquiryStatus)
    : undefined;

  if (filters.status && !status) return [];

  return db
    .select()
    .from(serviceInquiries)
    .where(
      and(
        status ? eq(serviceInquiries.status, status) : undefined,
        filters.period === "upcoming"
          ? gte(serviceInquiries.desiredDate, today)
          : undefined,
        filters.period === "past"
          ? lte(serviceInquiries.desiredDate, today)
          : undefined,
        filters.dateFrom
          ? gte(serviceInquiries.desiredDate, filters.dateFrom)
          : undefined,
        filters.dateTo
          ? lte(serviceInquiries.desiredDate, filters.dateTo)
          : undefined,
        customer
          ? or(
              ilike(serviceInquiries.customerName, `%${customer}%`),
              ilike(serviceInquiries.customerEmail, `%${customer}%`),
              ilike(serviceInquiries.customerPhone, `%${customer}%`),
            )
          : undefined,
      ),
    )
    .orderBy(
      filters.period === "past"
        ? desc(serviceInquiries.desiredDate)
        : asc(serviceInquiries.desiredDate),
    );
};

export const getAdminServiceInquiryById = async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const [inquiry] = await db
    .select()
    .from(serviceInquiries)
    .where(eq(serviceInquiries.id, id))
    .limit(1);

  return inquiry ?? null;
};

const transitions: Record<
  AdminServiceInquiryStatus,
  readonly AdminServiceInquiryStatus[]
> = {
  pending: ["confirmed", "cancelled", "rejected"],
  confirmed: ["cancelled"],
  cancelled: [],
  rejected: [],
};

export const getServiceInquiryAllowedStatuses = (
  status: AdminServiceInquiryStatus,
): readonly Exclude<AdminServiceInquiryStatus, "pending">[] =>
  transitions[status] as readonly Exclude<AdminServiceInquiryStatus, "pending">[];

export const updateAdminServiceInquiryStatus = async (
  inquiryId: string,
  targetStatus: AdminServiceInquiryStatus,
) => {
  const result = await db.transaction(async (transaction) => {
    const [inquiry] = await transaction
      .select({ id: serviceInquiries.id, status: serviceInquiries.status })
      .from(serviceInquiries)
      .where(eq(serviceInquiries.id, inquiryId))
      .for("update")
      .limit(1);

    if (!inquiry) return { success: false, reason: "not_found" } as const;
    if (inquiry.status === targetStatus) {
      return {
        success: true,
        inquiryId,
        status: targetStatus,
        alreadyApplied: true,
      } as const;
    }
    if (!transitions[inquiry.status].includes(targetStatus)) {
      return { success: false, reason: "invalid_transition" } as const;
    }

    const now = new Date();
    await transaction
      .update(serviceInquiries)
      .set({
        status: targetStatus,
        confirmedAt: targetStatus === "confirmed" ? now : undefined,
        cancelledAt: targetStatus === "cancelled" ? now : undefined,
        rejectedAt: targetStatus === "rejected" ? now : undefined,
        updatedAt: now,
      })
      .where(eq(serviceInquiries.id, inquiryId));

    return {
      success: true,
      inquiryId,
      status: targetStatus,
      alreadyApplied: false,
    } as const;
  });

  if (!result.success || result.alreadyApplied) return result;

  const notificationSent = await attemptServiceInquiryCustomerNotification({
    inquiryId,
    event: targetStatus as "confirmed" | "cancelled" | "rejected",
  });

  return { ...result, notificationSent };
};
