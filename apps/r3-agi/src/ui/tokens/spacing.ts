/**
 * Design Tokens — Spacing
 * @module ui/tokens/spacing
 */
export const space = {
  "0": "0px",
  "0.5": "2px",
  "1": "4px",
  "1.5": "6px",
  "2": "8px",
  "2.5": "10px",
  "3": "12px",
  "4": "16px",
  "5": "20px",
  "6": "24px",
  "7": "28px",
  "8": "32px",
  "9": "36px",
  "10": "40px",
  "12": "48px",
  "14": "56px",
  "16": "64px",
  "20": "80px",
  "24": "96px",
  "32": "128px",
  "40": "160px",
  "48": "192px",
  "64": "256px",
} as const;

export const semantic = {
  component: {
    xs: space["2"],
    sm: space["3"],
    md: space["4"],
    lg: space["6"],
    xl: space["8"],
  },
  gap: {
    xs: space["1"],
    sm: space["2"],
    md: space["3"],
    lg: space["4"],
    xl: space["6"],
  },
  layout: { page: space["6"], section: space["8"], panel: space["4"] },
  radius: {
    none: "0px",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },
} as const;

export const cssVariables = {
  "--spacing-xs": space["1"],
  "--spacing-sm": space["2"],
  "--spacing-md": space["4"],
  "--spacing-lg": space["6"],
  "--spacing-xl": space["8"],
  "--spacing-2xl": space["12"],
  "--radius-sm": semantic.radius.sm,
  "--radius-md": semantic.radius.md,
  "--radius-lg": semantic.radius.lg,
} as const;

export type SpaceScale = typeof space;
export type SemanticSpacing = typeof semantic;

/**
 * Unified namespace export — consumed by Panel.tsx as `import { spacing }`
 */
export const spacing = { space, semantic, cssVariables };
