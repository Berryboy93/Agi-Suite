/**
 * Panel Primitive
 * @module ui/components/Panel
 */

import React from "react";
import { colors } from "@/tokens/colors";
import { spacing } from "@/tokens/spacing";
import { typography } from "@/tokens/typography";
import { motion } from "@/tokens/motion";

export type Elevation = "flat" | "raised" | "floating" | "inset";
export type PaddingSize = "none" | "xs" | "sm" | "md" | "lg";
export type PanelVariant =
  | "default"
  | "accent"
  | "warning"
  | "error"
  | "success";

interface PanelProps {
  children: React.ReactNode;
  elevation?: Elevation;
  padding?: PaddingSize;
  variant?: PanelVariant;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

interface PanelHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

interface PanelBodyProps {
  children: React.ReactNode;
  scrollable?: boolean;
  className?: string;
}

interface PanelFooterProps {
  children: React.ReactNode;
  align?: "left" | "center" | "right" | "between";
}

const elevationStyles: Record<Elevation, React.CSSProperties> = {
  flat: {
    backgroundColor: colors.semantic.background.surface,
    border: `1px solid ${colors.semantic.border.subtle}`,
    boxShadow: "none",
  },
  raised: {
    backgroundColor: colors.semantic.background.elevated,
    border: `1px solid ${colors.semantic.border.default}`,
    boxShadow: "0 1px 3px oklch(0% 0 0 / 0.3)",
  },
  floating: {
    backgroundColor: colors.semantic.background.elevated,
    border: `1px solid ${colors.semantic.border.default}`,
    boxShadow: "0 4px 12px oklch(0% 0 0 / 0.4)",
  },
  inset: {
    backgroundColor: colors.semantic.background.base,
    border: `1px solid ${colors.semantic.border.subtle}`,
    boxShadow: "inset 0 1px 3px oklch(0% 0 0 / 0.2)",
  },
};

const paddingStyles: Record<PaddingSize, string> = {
  none: spacing.semantic.component.xs,
  xs: spacing.semantic.component.xs,
  sm: spacing.semantic.component.sm,
  md: spacing.semantic.component.md,
  lg: spacing.semantic.component.lg,
};

const variantBorderColors: Record<PanelVariant, string> = {
  default: colors.semantic.border.default,
  accent: colors.semantic.interactive.default,
  warning: colors.semantic.status.warning,
  error: colors.semantic.status.critical,
  success: colors.semantic.status.healthy,
};

function PanelRoot({
  children,
  elevation = "raised",
  padding = "md",
  variant = "default",
  className = "",
  as: Component = "div",
}: PanelProps) {
  const baseStyle: React.CSSProperties = {
    ...elevationStyles[elevation],
    padding: paddingStyles[padding],
    borderRadius: spacing.semantic.radius.md,
    borderLeft:
      variant !== "default"
        ? `3px solid ${variantBorderColors[variant]}`
        : undefined,
    display: "flex",
    flexDirection: "column",
    gap: spacing.semantic.gap.sm,
    transition: `box-shadow ${motion.semantic.panelHover.duration} ${motion.semantic.panelHover.easing}, border-color ${motion.semantic.panelHover.duration} ${motion.semantic.panelHover.easing}`,
  };

  return (
    <Component
      style={baseStyle}
      className={`panel ${className}`}
      data-elevation={elevation}
      data-variant={variant}
    >
      {children}
    </Component>
  );
}

function PanelHeader({ title, subtitle, action, icon }: PanelHeaderProps) {
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.semantic.gap.sm,
    paddingBottom: spacing.semantic.gap.sm,
    borderBottom: `1px solid ${colors.semantic.border.subtle}`,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: typography.semantic.h4.size,
    fontWeight: typography.semantic.h4.weight,
    lineHeight: typography.semantic.h4.leading,
    color: colors.semantic.content.primary,
    display: "flex",
    alignItems: "center",
    gap: spacing.semantic.gap.xs,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: typography.semantic.caption.size,
    fontWeight: typography.semantic.caption.weight,
    lineHeight: typography.semantic.caption.leading,
    color: colors.semantic.content.tertiary,
    letterSpacing: typography.semantic.caption.tracking,
  };

  return (
    <header style={style} className="panel-header">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.semantic.gap.xs,
        }}
      >
        <h4 style={titleStyle}>
          {icon && <span style={{ display: "flex" }}>{icon}</span>}
          {title}
        </h4>
        {subtitle && <span style={subtitleStyle}>{subtitle}</span>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </header>
  );
}

function PanelBody({
  children,
  scrollable = false,
  className = "",
}: PanelBodyProps) {
  const style: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: scrollable ? "auto" : "visible",
    color: colors.semantic.content.secondary,
    fontSize: typography.semantic.body.size,
    lineHeight: typography.semantic.body.leading,
  };

  return (
    <div style={style} className={`panel-body ${className}`}>
      {children}
    </div>
  );
}

function PanelFooter({ children, align = "between" }: PanelFooterProps) {
  const alignMap: Record<string, string> = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
    between: "space-between",
  };

  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: alignMap[align],
    gap: spacing.semantic.gap.sm,
    paddingTop: spacing.semantic.gap.sm,
    borderTop: `1px solid ${colors.semantic.border.subtle}`,
    fontSize: typography.semantic.caption.size,
    color: colors.semantic.content.tertiary,
  };

  return (
    <footer style={style} className="panel-footer">
      {children}
    </footer>
  );
}

export const Panel = Object.assign(PanelRoot, {
  Header: PanelHeader,
  Body: PanelBody,
  Footer: PanelFooter,
});

export default Panel;
