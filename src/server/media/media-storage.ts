import { isAbsolute, resolve } from "node:path";

export const mediaUploadRoot = (): string => {
  const configured = process.env.MEDIA_UPLOAD_DIR?.trim() || undefined;
  if (process.env.NODE_ENV === "production" && (!configured || !isAbsolute(configured))) {
    throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
  }
  return resolve(configured ?? ".local-data/media");
};
