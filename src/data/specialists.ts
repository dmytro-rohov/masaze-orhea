import type { ImageMetadata } from "astro";

import type { MassageId } from "@/data/massages";

import adrianPlaceholder from "@/assets/img/adrian.png";
import aleksandraPlaceholder from "@/assets/img/aleksandra.png";

export type SpecialistId = "adrian" | "aleksandra";

export type Specialist = {
  id: SpecialistId;
  name: string;
  image: ImageMetadata;
  imageAlt: string;
  imageIsPlaceholder: boolean;
  qualifications: string[];
  experience: string;
  description: string;
};

export const specialists: Specialist[] = [
  {
    id: "adrian",
    name: "Adrian",
    image: adrianPlaceholder,
    imageAlt: "Zdjęcie zastępcze dla profilu Adriana",
    imageIsPlaceholder: true,
    qualifications: [
      "Kwalifikacje — do uzupełnienia",
      "Specjalizacje — do uzupełnienia",
    ],
    experience: "Doświadczenie zawodowe — do uzupełnienia",
    description:
      "Opis podejścia i zakresu pracy Adriana zostanie uzupełniony po zatwierdzeniu informacji przez ORHEA.",
  },
  {
    id: "aleksandra",
    name: "Aleksandra",
    image: aleksandraPlaceholder,
    imageAlt: "Zdjęcie zastępcze dla profilu Aleksandry",
    imageIsPlaceholder: true,
    qualifications: [
      "Kwalifikacje — do uzupełnienia",
      "Specjalizacje — do uzupełnienia",
    ],
    experience: "Doświadczenie zawodowe — do uzupełnienia",
    description:
      "Opis podejścia i zakresu pracy Aleksandry zostanie uzupełniony po zatwierdzeniu informacji przez ORHEA.",
  },
];

export const getSpecialistBookingPath = (
  specialistId: SpecialistId,
  massageId?: MassageId,
): string => {
  const params = new URLSearchParams();

  if (massageId) {
    params.set("masaz", massageId);
  }

  params.set("specjalista", specialistId);

  return `/rezerwacja?${params.toString()}`;
};
