import { google } from "googleapis";

const getEnvValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export const getGoogleReportsClient = async () => {
  const clientId = getEnvValue(
    import.meta.env.GOOGLE_REPORTS_CLIENT_ID ??
      process.env.GOOGLE_REPORTS_CLIENT_ID,
  );
  const clientSecret = getEnvValue(
    import.meta.env.GOOGLE_REPORTS_CLIENT_SECRET ??
      process.env.GOOGLE_REPORTS_CLIENT_SECRET,
  );
  const refreshToken = getEnvValue(
    import.meta.env.GOOGLE_REPORTS_REFRESH_TOKEN ??
      process.env.GOOGLE_REPORTS_REFRESH_TOKEN,
  );
  const ownerEmail = getEnvValue(
    import.meta.env.GOOGLE_REPORTS_OWNER_EMAIL ??
      process.env.GOOGLE_REPORTS_OWNER_EMAIL,
  );
  const folderId = getEnvValue(
    import.meta.env.GOOGLE_REPORTS_FOLDER_ID ??
      process.env.GOOGLE_REPORTS_FOLDER_ID,
  );
  const aleksandraEmail = getEnvValue(
    import.meta.env.GOOGLE_REPORTS_ALEKSANDRA_EMAIL ??
      process.env.GOOGLE_REPORTS_ALEKSANDRA_EMAIL,
  );

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

    throw new Error("GOOGLE_REPORTS_AUTH_FAILED");
  }

  return { drive, sheets, folderId, aleksandraEmail };
};
