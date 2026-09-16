import { eq } from "drizzle-orm";

import { db } from "@/db";
import { REPORT_SETTINGS_ID, reportSettings } from "@/db/schema";

export type ReportSettingsInput = {
  ownerEmail: string | null;
  folderId: string | null;
  aleksandraEmail: string | null;
};

const getEnvValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const getEnvironmentReportSettings = (): ReportSettingsInput => ({
  ownerEmail: getEnvValue(
    import.meta.env?.GOOGLE_REPORTS_OWNER_EMAIL ??
      process.env.GOOGLE_REPORTS_OWNER_EMAIL,
  ),
  folderId: getEnvValue(
    import.meta.env?.GOOGLE_REPORTS_FOLDER_ID ??
      process.env.GOOGLE_REPORTS_FOLDER_ID,
  ),
  aleksandraEmail: getEnvValue(
    import.meta.env?.GOOGLE_REPORTS_ALEKSANDRA_EMAIL ??
      process.env.GOOGLE_REPORTS_ALEKSANDRA_EMAIL,
  ),
});

export const getStoredReportSettings = async (): Promise<ReportSettingsInput> => {
  const [settings] = await db
    .select({
      ownerEmail: reportSettings.ownerEmail,
      folderId: reportSettings.folderId,
      aleksandraEmail: reportSettings.aleksandraEmail,
    })
    .from(reportSettings)
    .where(eq(reportSettings.id, REPORT_SETTINGS_ID))
    .limit(1);

  return settings ?? {
    ownerEmail: null,
    folderId: null,
    aleksandraEmail: null,
  };
};

export const getResolvedReportSettings = async (): Promise<ReportSettingsInput> => {
  const [stored, environment] = await Promise.all([
    getStoredReportSettings(),
    Promise.resolve(getEnvironmentReportSettings()),
  ]);

  return {
    ownerEmail: stored.ownerEmail ?? environment.ownerEmail,
    folderId: stored.folderId ?? environment.folderId,
    aleksandraEmail: stored.aleksandraEmail ?? environment.aleksandraEmail,
  };
};

export const updateStoredReportSettings = async (
  input: ReportSettingsInput,
): Promise<void> => {
  const now = new Date();

  await db
    .insert(reportSettings)
    .values({
      id: REPORT_SETTINGS_ID,
      ...input,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: reportSettings.id,
      set: { ...input, updatedAt: now },
    });
};

export const isGoogleReportsClientIdConfigured = (): boolean =>
  Boolean(
    getEnvValue(
      import.meta.env?.GOOGLE_REPORTS_CLIENT_ID ??
        process.env.GOOGLE_REPORTS_CLIENT_ID,
    ),
  );
