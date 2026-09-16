export const typography = {
  fontFamily: {
    base: '"Lexend", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    heading: '"CormorantGaramond", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    focus: '"MrsSaintDelafield", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },

  fontSize: {
    xs: "0.6rem",
    sm: "0.7rem",
    base: "0.8rem",
    h1: "clamp(2.25rem, 4.5vw, 3rem)",
    h2: "clamp(1.75rem, 3.5vw, 2.25rem)",
    h3: "clamp(1.125rem, 2.25vw, 1.25rem)",
    h4: "1rem",
    lg: "1.25rem",
    xl: "1.5rem",
    "2xl": "2rem",
    "3xl": "3rem",
    "5xl": "4rem",
  },

  fontWeight: {
    light: "300",
    regular: "400",
    medium: "500",
    semibold: "600",
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
