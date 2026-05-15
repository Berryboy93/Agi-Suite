/**
 * Design Tokens — Colors
 * @module ui/tokens/colors
 */
export const base = {
  neutral: {
    50: "oklch(97% 0.002 252)",
    100: "oklch(92% 0.003 254)",
    200: "oklch(84% 0.005 255)",
    300: "oklch(72% 0.01 258)",
    400: "oklch(58% 0.02 260)",
    500: "oklch(45% 0.03 262)",
    600: "oklch(35% 0.04 264)",
    700: "oklch(26% 0.05 264)",
    800: "oklch(18% 0.04 265)",
    900: "oklch(12% 0.03 266)",
    950: "oklch(8% 0.02 267)",
  },
  state: {
    success: "oklch(55% 0.16 147)",
    warning: "oklch(65% 0.18 85)",
    error: "oklch(59% 0.19 38)",
    info: "oklch(55% 0.19 260)",
    running: "oklch(60% 0.15 180)",
    pending: "oklch(58% 0.08 270)",
  },
  accent: {
    primary: "oklch(55% 0.19 260)",
    primaryHover: "oklch(49% 0.20 262)",
    secondary: "oklch(52% 0.14 175)",
    highlight: "oklch(65% 0.22 280)",
  },
} as const;

export const semantic = {
  background: {
    base: base.neutral[950],
    surface: base.neutral[900],
    elevated: base.neutral[800],
    overlay: "oklch(6% 0.01 268 / 0.8)",
    inset: base.neutral[950],
  },
  content: {
    primary: base.neutral[100],
    secondary: base.neutral[300],
    tertiary: base.neutral[400],
    disabled: base.neutral[500],
    inverse: base.neutral[900],
  },
  border: {
    default: base.neutral[700],
    subtle: base.neutral[800],
    strong: base.neutral[500],
    error: base.state.error,
  },
  interactive: {
    default: base.accent.primary,
    hover: base.accent.primaryHover,
    active: base.accent.highlight,
    disabled: base.neutral[600],
    ghost: "transparent",
    ghostHover: "oklch(100% 0 0 / 0.06)",
  },
  status: {
    healthy: base.state.success,
    warning: base.state.warning,
    critical: base.state.error,
    info: base.state.info,
    active: base.state.running,
    idle: base.state.pending,
  },
  data: {
    series1: base.accent.primary,
    series2: base.accent.secondary,
    series3: base.state.warning,
    series4: base.state.error,
    series5: base.accent.highlight,
    grid: base.neutral[800],
    axis: base.neutral[500],
  },
} as const;

export const cssVariables = {
  "--color-bg-base": semantic.background.base,
  "--color-bg-surface": semantic.background.surface,
  "--color-bg-elevated": semantic.background.elevated,
  "--color-bg-overlay": semantic.background.overlay,
  "--color-bg-inset": semantic.background.inset,
  "--color-content-primary": semantic.content.primary,
  "--color-content-secondary": semantic.content.secondary,
  "--color-content-tertiary": semantic.content.tertiary,
  "--color-content-disabled": semantic.content.disabled,
  "--color-border-default": semantic.border.default,
  "--color-border-subtle": semantic.border.subtle,
  "--color-border-strong": semantic.border.strong,
  "--color-interactive-default": semantic.interactive.default,
  "--color-interactive-hover": semantic.interactive.hover,
  "--color-status-healthy": semantic.status.healthy,
  "--color-status-warning": semantic.status.warning,
  "--color-status-critical": semantic.status.critical,
  "--color-status-info": semantic.status.info,
} as const;

export type BaseColor = typeof base;
export type SemanticColor = typeof semantic;
export type CssColorVar = keyof typeof cssVariables;
