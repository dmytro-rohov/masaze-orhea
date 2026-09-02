import { shadows } from "../core/shadows";

export const elevation = {
  none: shadows.none,
  card: shadows.standard,
  cardHover: shadows.hover,
  dropdown: shadows.dropdown,
} as const;
