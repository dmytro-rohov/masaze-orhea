import type { SpecialistId } from "@/data/specialists";
import type { AdminSession } from "@/server/admin/admin-auth.service";

const OWNER_ONLY_ADMIN_MODULES = ["vouchers", "specialists", "settings"];

export const isOwner = (session: AdminSession): boolean =>
  session.role === "owner";

export const isSpecialist = (session: AdminSession): boolean =>
  session.role === "specialist";

export const canAccessSpecialist = (
  session: AdminSession,
  specialistId: SpecialistId,
): boolean => isOwner(session) || session.specialistId === specialistId;

export const isOwnerOnlyAdminRoute = (pathname: string): boolean => {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "admin") {
    return OWNER_ONLY_ADMIN_MODULES.includes(segments[1] ?? "");
  }

  if (segments[0] === "api" && segments[1] === "admin") {
    return OWNER_ONLY_ADMIN_MODULES.includes(segments[2] ?? "");
  }

  return false;
};
