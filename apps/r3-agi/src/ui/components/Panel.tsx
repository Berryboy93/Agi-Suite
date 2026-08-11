import React, { type ReactNode } from "react";
import { colors } from "@/tokens/colors";
import { spacing } from "@/tokens/spacing";
import { typography } from "@/tokens/typography";

type PanelVariant =
  | "default"
  | "raised"
  | "flat"
  | "ghost"
  | "error"
  | "accent"
  | "warning"
  | "success";
type PanelPadding = "none" | "sm" | "md" | "lg";

interface PanelProps {
  children: ReactNode;
  variant?: PanelVariant;
  padding?: PanelPadding;
  elevation?: "none" | "sm" | "md" | "lg" | "raised";
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  style?: React.CSSProperties;
}

const PanelComponent = ({
  children,
  variant = "default",
  padding = "md",
  elevation = "none",
  className = "",
  as: Component = "div",
  style,
}: PanelProps) => {
  const paddingMap: Record<PanelPadding, string> = {
    none: "0",
    sm: `${spacing.semantic.component.sm} ${spacing.semantic.component.md}`,
    md: `${spacing.semantic.component.md} ${spacing.semantic.component.lg}`,
    lg: `${spacing.semantic.component.lg} ${spacing.semantic.component.xl}`,
  };

  const elevationMap: Record<string, string> = {
    none: "none",
    sm: `0 1px 2px 0 ${colors.semantic.border.subtle}`,
    md: `0 4px 6px -1px ${colors.semantic.border.subtle}`,
    lg: `0 10px 15px -3px ${colors.semantic.border.subtle}`,
    raised: `0 20px 25px -5px ${colors.semantic.border.subtle}, 0 8px 10px -6px ${colors.semantic.border.subtle}`,
  };

  const baseStyle: React.CSSProperties = {
    background: colors.semantic.background.surface,
    borderRadius: spacing.semantic.radius.md,
    border: `1px solid ${colors.semantic.border.subtle}`,
    padding: paddingMap[padding],
    boxShadow: elevationMap[elevation] ?? "none",
    ...style,
  };

  return (
    <Component
      style={baseStyle}
      className={`panel ${className}`}
      data-variant={variant}
    >
      {children}
    </Component>
  );
};

interface PanelHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

const PanelHeader = ({ title, subtitle, icon, action }: PanelHeaderProps) => {
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${spacing.semantic.component.md} ${spacing.semantic.component.lg}`,
    borderBottom: `1px solid ${colors.semantic.border.subtle}`,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.semantic.content.primary,
    display: "flex",
    alignItems: "center",
    gap: spacing.semantic.gap.sm,
    margin: 0,
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: typography.size.xs,
    color: colors.semantic.content.secondary,
    margin: 0,
  };

  return (
    <header style={style} className="panel-header">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: spacing.semantic.gap.xs,
          flex: 1,
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
};

interface PanelBodyProps {
  children: ReactNode;
  className?: string;
}

const PanelBody = ({ children, className = "" }: PanelBodyProps) => {
  const style: React.CSSProperties = {
    padding: `${spacing.semantic.component.md} ${spacing.semantic.component.lg}`,
    color: colors.semantic.content.primary,
  };

  return (
    <div style={style} className={`panel-body ${className}`}>
      {children}
    </div>
  );
};

interface PanelFooterProps {
  children: ReactNode;
}

const PanelFooter = ({ children }: PanelFooterProps) => {
  const style: React.CSSProperties = {
    padding: `${spacing.semantic.component.md} ${spacing.semantic.component.lg}`,
    borderTop: `1px solid ${colors.semantic.border.subtle}`,
    display: "flex",
    justifyContent: "flex-end",
    gap: spacing.semantic.gap.sm,
  };

  return (
    <footer style={style} className="panel-footer">
      {children}
    </footer>
  );
};

export const Panel = Object.assign(PanelComponent, {
  Header: PanelHeader,
  Body: PanelBody,
  Footer: PanelFooter,
}) as unknown as typeof PanelComponent & {
  Header: typeof PanelHeader;
  Body: typeof PanelBody;
  Footer: typeof PanelFooter;
};
