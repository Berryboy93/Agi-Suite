/**
 * Design Tokens — Typography
 * @module ui/tokens/typography
 */
export const family = {
  sans: '"Inter", system-ui, -apple-system, sans-serif',
  mono: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
  display: '"Inter", system-ui, sans-serif',
} as const;

export const size = {
  "2xs": "0.625rem",
  xs: "0.75rem",
  sm: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "1.875rem",
  "4xl": "2.25rem",
  "5xl": "3rem",
} as const;

export const weight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;
export const leading = {
  tight: "1.2",
  snug: "1.375",
  normal: "1.5",
  relaxed: "1.625",
} as const;
export const tracking = {
  tight: "-0.025em",
  normal: "0",
  wide: "0.025em",
  wider: "0.05em",
} as const;

export const semantic = {
  h1: {
    size: size["4xl"],
    weight: weight.bold,
    leading: leading.tight,
    tracking: tracking.tight,
  },
  h2: {
    size: size["3xl"],
    weight: weight.semibold,
    leading: leading.tight,
    tracking: tracking.tight,
  },
  h3: {
    size: size["2xl"],
    weight: weight.semibold,
    leading: leading.snug,
    tracking: tracking.normal,
  },
  h4: {
    size: size.xl,
    weight: weight.medium,
    leading: leading.snug,
    tracking: tracking.normal,
  },
  body: {
    size: size.base,
    weight: weight.normal,
    leading: leading.normal,
    tracking: tracking.normal,
  },
  bodySmall: {
    size: size.sm,
    weight: weight.normal,
    leading: leading.normal,
    tracking: tracking.normal,
  },
  caption: {
    size: size.xs,
    weight: weight.medium,
    leading: leading.snug,
    tracking: tracking.wide,
  },
  data: {
    size: size.sm,
    weight: weight.normal,
    leading: leading.tight,
    tracking: tracking.normal,
    family: family.mono,
  },
  dataSmall: {
    size: size.xs,
    weight: weight.normal,
    leading: leading.tight,
    tracking: tracking.normal,
    family: family.mono,
  },
  button: {
    size: size.sm,
    weight: weight.medium,
    leading: leading.tight,
    tracking: tracking.normal,
  },
  label: {
    size: size.xs,
    weight: weight.medium,
    leading: leading.snug,
    tracking: tracking.wide,
  },
} as const;

export const cssVariables = {
  "--font-sans": family.sans,
  "--font-mono": family.mono,
  "--text-xs": size.xs,
  "--text-sm": size.sm,
  "--text-base": size.base,
  "--text-lg": size.lg,
  "--text-xl": size.xl,
  "--text-2xl": size["2xl"],
} as const;

export type FontFamily = typeof family;
export type TypeSize = typeof size;
export type TypeWeight = typeof weight;
export type SemanticType = typeof semantic;
