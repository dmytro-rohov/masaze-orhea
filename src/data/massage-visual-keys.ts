import { massageZoneDefinitions } from "@/data/massage-zones";

export const massageBodyVisualKeys = massageZoneDefinitions.map((zone) => zone.id);
export const massageVisualKeys = [...massageBodyVisualKeys, "classic-back", "desk-relief"];
