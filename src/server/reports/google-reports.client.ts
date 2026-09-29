import { google } from "googleapis";
import { getResolvedReportSettings } from "./report-settings.service";

const getEnvValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export const getGoogleReportsClient = async () => {
  const reportSettings = await getResolvedReportSettings();
  // OAuth credentials must be injected when the server starts. Reading them
  // through import.meta.env would bake their current values into the build.
  const clientId = getEnvValue(process.env.GOOGLE_REPORTS_CLIENT_ID);
  const clientSecret = getEnvValue(process.env.GOOGLE_REPORTS_CLIENT_SECRET);
  const refreshToken = getEnvValue(process.env.GOOGLE_REPORTS_REFRESH_TOKEN);
  const ownerEmail = reportSettings.ownerEmail;
  const folderId = reportSettings.folderId;
  const aleksandraEmail = reportSettings.aleksandraEmail;

  if (!clientId || !clientSecret || !refreshToken || !ownerEmail) {
    throw new Error("GOOGLE_REPORTS_NOT_CONFIGURED");
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });

  try {
    const account = await drive.about.get({ fields: "user(emailAddress)" });
    const authenticatedEmail = account.data.user?.emailAddress;

    if (
      !authenticatedEmail ||
      authenticatedEmail.toLowerCase() !== ownerEmail.toLowerCase()
    ) {
      throw new Error("GOOGLE_REPORTS_ACCOUNT_MISMATCH");
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "GOOGLE_REPORTS_ACCOUNT_MISMATCH"
    ) {
      throw error;
    }

    throw new Error("GOOGLE_REPORTS_AUTH_FAILED", { cause: error });
  }

  return { drive, sheets, folderId, aleksandraEmail };
};
