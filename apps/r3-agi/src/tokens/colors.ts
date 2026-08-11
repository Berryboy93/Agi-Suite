export const colors = {
  semantic: {
    status: {
      healthy: "var(--success)",
      critical: "var(--danger)",
      warning: "var(--warn)",
    },
    data: {
      series1: "var(--acid)",
      series2: "var(--info)",
      series3: "var(--success)",
      series4: "var(--warn)",
      series5: "var(--danger)",
    },
    content: {
      primary: "var(--foreground)",
      secondary: "var(--muted)",
      tertiary: "var(--muted)",
    },
    border: {
      subtle: "var(--border)",
      strong: "var(--border)",
    },
    surface: {
      base: "var(--surface)",
      elevated: "var(--surface)",
    },
  },
  acid: "var(--acid)",
  warn: "var(--warn)",
  danger: "var(--danger)",
  info: "var(--info)",
  success: "var(--success)",
  muted: "var(--muted)",
  surface: "var(--surface)",
  background: "var(--background)",
  foreground: "var(--foreground)",
  border: "var(--border)",
} as const;
