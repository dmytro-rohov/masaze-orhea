export const typography = {
  fontFamily: {
    base: '"Lexend", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    heading: '"CormorantGaramond", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    focus: '"MrsSaintDelafield", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },

  fontSize: {
    xs: "0.75rem",
    sm: "1rem",
    base: "1.125rem",
    h1: "clamp(2.5rem, 5vw, 3.5rem)",
    h2: "clamp(2rem, 4vw, 2.625rem)",
    h3: "clamp(1.25rem, 2.5vw, 1.375rem)",
    lg: "1.25rem",
    xl: "1.5rem",
    "2xl": "2rem",
    "3xl": "3rem",
  },

  fontWeight: {
    light: "300",
    regular: "400",
    medium: "500",
    bold: "700",
  },

  lineHeight: {
    none: "1",
    tight: "1.1",
    snug: "1.25",
    normal: "1.5",
    relaxed: "1.7",
  },

  letterSpacing: {
    tighter: "-0.04em",
    tight: "-0.02em",
    normal: "0",
    wide: "0.02em",
  },
} as const;