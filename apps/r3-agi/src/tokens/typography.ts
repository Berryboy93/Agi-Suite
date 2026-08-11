export const typography = {
  family: {
    sans: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  size: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
  },
  weight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  semantic: {
    caption: {
      size: "0.75rem",
      tracking: "0.05em",
    },
    label: {
      size: "0.875rem",
      tracking: "0.025em",
    },
    dataSmall: {
      size: "0.75rem",
    },
    h3: {
      size: "1.875rem",
    },
    h4: {
      size: "1.25rem",
    },
  },
} as const;
