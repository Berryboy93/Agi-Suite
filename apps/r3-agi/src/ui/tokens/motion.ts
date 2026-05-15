/**
 * Design Tokens — Motion
 * Animation timing for operational dashboards
 *
 * @module ui/tokens/motion
 */

export const duration = {
  instant: "0ms",
  fast: "100ms",
  normal: "200ms",
  slow: "300ms",
  slower: "500ms",
} as const;

export const easing = {
  out: "cubic-bezier(0, 0, 0.2, 1)",
  inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
} as const;

export const semantic = {
  panelHover: {
    duration: duration.fast,
    easing: easing.out,
  },
  modalOpen: {
    duration: duration.normal,
    easing: easing.spring,
  },
  statusChange: {
    duration: duration.fast,
    easing: easing.inOut,
  },
  dataUpdate: {
    duration: duration.instant,
    easing: easing.out,
  },
} as const;

export const cssVariables = {
  "--duration-instant": duration.instant,
  "--duration-fast": duration.fast,
  "--duration-normal": duration.normal,
  "--duration-slow": duration.slow,
  "--ease-out": easing.out,
  "--ease-in-out": easing.inOut,
  "--ease-spring": easing.spring,
} as const;

export type Duration = typeof duration;
export type Easing = typeof easing;
export type SemanticMotion = typeof semantic;
