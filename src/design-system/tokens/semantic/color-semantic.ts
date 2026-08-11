import { colors } from "../core/colors";

export const semanticColors = {
  text: {
    primary: colors.gray[200],
    secondary: colors.white[150],
    muted: colors.green[100],
    inverse: colors.gray[50],
  },

  background: {
    primary: colors.white[150],
    secondary: colors.green[100],
    third: colors.green[50],
    muted: colors.green[150],
    surface: colors.white,
    inverse: colors.white[200],
  },

  border: {
    default: colors.white[400],
    inverse: colors.green[100],
    strong: colors.amber[100],
  },

  action: {
    primary: colors.blue[600],
    primaryHover: colors.blue[700],
    primaryText: colors.white,
    secondary: colors.gray[50],
    secondaryHover: colors.gray[100],
    secondaryText: colors.gray[200],
  },

  focus: {
    ring: colors.blue[500],
  },

  feedback: {
    success: colors.green[600],
    error: colors.red[600],
    warning: colors.amber[600],
  },
} as const;