import type { ImageMetadata } from "astro";

import type { MassageZoneId } from "@/data/massage-zones";

import ukojenieImage from "@/assets/img/zone-1.png";
import regeneracjaImage from "@/assets/img/zone-2.png";
import limfatycznaImage from "@/assets/img/zone-3.png";
import twarzImage from "@/assets/img/zone-4.png";
import vipImage from "@/assets/img/vip-zone.png";

import ukojenieVideoWebm from "@/assets/video/video-1.webm";
import ukojenieVideoMp4 from "@/assets/video/video-1.mp4";
import regeneracjaVideoWebm from "@/assets/video/video-2.webm";
import regeneracjaVideoMp4 from "@/assets/video/video-2.mp4";
import limfatycznaVideoWebm from "@/assets/video/video-3.webm";
import limfatycznaVideoMp4 from "@/assets/video/video-3.mp4";
import twarzVideoWebm from "@/assets/video/video-face.webm";
import twarzVideoMp4 from "@/assets/video/video-face.mp4";
import vipVideoWebm from "@/assets/video/video-4.webm";
import vipVideoMp4 from "@/assets/video/video-4.mp4";

import ukojenieIcon from "@/assets/img/label-1.png";
import regeneracjaIcon from "@/assets/img/label-2.png";
import twarzIcon from "@/assets/img/label-4-new.png";

export type MassageZoneVideoSource = {
  src: string;
  type: "video/webm" | "video/mp4";
};

export type MassageZoneVisual = {
  image: ImageMetadata;
  imageAlt: string;
  videoSources: readonly MassageZoneVideoSource[];
  icon: ImageMetadata;
};

export const massageZoneVisuals: Record<MassageZoneId, MassageZoneVisual> = {
  ukojenie: {
    image: ukojenieImage,
    imageAlt: "Masaż ukierunkowany na odprężenie i rozluźnienie ciała",
    videoSources: [
      { src: ukojenieVideoWebm, type: "video/webm" },
      { src: ukojenieVideoMp4, type: "video/mp4" },
    ],
    icon: ukojenieIcon,
  },
  regeneracja: {
    image: regeneracjaImage,
    imageAlt: "Relaksacyjny masaż wspierający regenerację",
    videoSources: [
      { src: regeneracjaVideoWebm, type: "video/webm" },
      { src: regeneracjaVideoMp4, type: "video/mp4" },
    ],
    icon: regeneracjaIcon,
  },
  limfatyczna: {
    image: limfatycznaImage,
    imageAlt: "Delikatny masaż wspierający poczucie lekkości",
    videoSources: [
      { src: limfatycznaVideoWebm, type: "video/webm" },
      { src: limfatycznaVideoMp4, type: "video/mp4" },
    ],
    icon: ukojenieIcon,
  },
  twarz: {
    image: twarzImage,
    imageAlt: "Masaż twarzy wykonywany w gabinecie ORHEA",
    videoSources: [
      { src: twarzVideoWebm, type: "video/webm" },
      { src: twarzVideoMp4, type: "video/mp4" },
    ],
    icon: twarzIcon,
  },
  vip: {
    image: vipImage,
    imageAlt: "Ekskluzywne doświadczenie VIP ORHEA",
    videoSources: [
      { src: vipVideoWebm, type: "video/webm" },
      { src: vipVideoMp4, type: "video/mp4" },
    ],
    icon: regeneracjaIcon,
  },
};

export const getMassageZoneVisual = (
  zoneId: MassageZoneId,
): MassageZoneVisual => massageZoneVisuals[zoneId];
