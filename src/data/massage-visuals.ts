import type { ImageMetadata } from "astro";

import type { Massage, MassageId } from "@/data/massages";

import type { MassageZoneId } from "@/data/massage-zones";

import ukojenieImage from "@/assets/img/zone-1.png";
import regeneracjaImage from "@/assets/img/zone-2.png";
import limfatycznaImage from "@/assets/img/zone-3.png";
import twarzImage from "@/assets/img/zone-4.png";
import vipImage from "@/assets/img/vip-zone.png";

import video1Webm from "@/assets/video/video-1.webm";
import video1Mp4 from "@/assets/video/video-1.mp4";
import video2Webm from "@/assets/video/video-2.webm";
import video2Mp4 from "@/assets/video/video-2.mp4";
import video3Webm from "@/assets/video/video-3.webm";
import video3Mp4 from "@/assets/video/video-3.mp4";
import video4Webm from "@/assets/video/video-4.webm";
import video4Mp4 from "@/assets/video/video-4.mp4";
import videoFaceWebm from "@/assets/video/video-face.webm";
import videoFaceMp4 from "@/assets/video/video-face.mp4";

export type MassageVideoSource = {
  src: string;
  type: string;
};

export type MassageVisual = {
  cardImage: ImageMetadata;
  heroImage: ImageMetadata;

  cardImageAlt: string;
  heroImageAlt: string;

  heroVideoSources?: MassageVideoSource[];
};

const pairVideo = (
  webm: string,
  mp4: string,
): MassageVideoSource[] => [
  { src: webm, type: "video/webm" },
  { src: mp4, type: "video/mp4" },
];

const zoneImages: Record<MassageZoneId, ImageMetadata> = {
  ukojenie: ukojenieImage,
  regeneracja: regeneracjaImage,
  limfatyczna: limfatycznaImage,
  twarz: twarzImage,
  vip: vipImage,
};

const zoneVideos: Record<MassageZoneId, MassageVideoSource[]> = {
  ukojenie: pairVideo(video1Webm, video1Mp4),
  regeneracja: pairVideo(video3Webm, video3Mp4),
  limfatyczna: pairVideo(video4Webm, video4Mp4),
  twarz: pairVideo(videoFaceWebm, videoFaceMp4),
  vip: pairVideo(video3Webm, video3Mp4),
};

const massageVisualOverrides: Partial<
  Record<MassageId, Partial<MassageVisual>>
> = {
  "classic-back": {
    heroVideoSources: pairVideo(video1Webm, video1Mp4),
  },
  "desk-relief": {
    heroVideoSources: pairVideo(video2Webm, video2Mp4),
  },
};

export const getMassageVisual = (massage: Massage): MassageVisual => {
  const fallbackImage = zoneImages[massage.zoneId];
  const override = massageVisualOverrides[massage.id];

  return {
    cardImage: override?.cardImage ?? fallbackImage,
    heroImage: override?.heroImage ?? fallbackImage,
    cardImageAlt:
      override?.cardImageAlt ?? massage.serviceName ?? massage.title,
    heroImageAlt:
      override?.heroImageAlt ?? massage.serviceName ?? massage.title,
    heroVideoSources:
      override?.heroVideoSources ?? zoneVideos[massage.zoneId],
  };
};
