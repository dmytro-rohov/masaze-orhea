export type RuntimeImage = {
  kind: "runtime-image";
  key: string;
  width: number;
  height: number;
  widths: number[];
};

export type RuntimeVideo = {
  kind: "runtime-video";
  key: string;
  format: "mp4" | "webm";
};

export const isRuntimeImage = (value: unknown): value is RuntimeImage =>
  !!value && typeof value === "object" && (value as RuntimeImage).kind === "runtime-image";

export const runtimeImageUrl = (image: RuntimeImage, width = image.width): string =>
  `/media/massages/${image.key}/${width}.webp`;

export const runtimeVideoUrl = (video: RuntimeVideo): string =>
  `/media/massages/${video.key}/video.${video.format}`;
