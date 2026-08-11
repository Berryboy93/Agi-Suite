/**
 * Layout Primitives — R3 AGI OS
 * Bridges inline-style patterns to Tailwind v4 utilities
 */

import { cn } from "../../lib/utils";
import type { ReactNode, ElementType, ComponentPropsWithoutRef } from "react";

/* ── GlassPanel ── */
interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  elevate?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  as?: ElementType;
}

export function GlassPanel({
  children,
  className,
  elevate = false,
  padding = "md",
  as: Tag = "div",
}: GlassPanelProps) {
  const padMap = { none: "", sm: "p-2", md: "p-3", lg: "p-4" };
  return (
    <Tag
      className={cn(
        "rounded-[16px] bg-[rgba(20,20,28,0.55)] backdrop-blur-[16px] border border-[rgba(255,255,255,0.06)]",
        padMap[padding],
        elevate &&
          "transition-all duration-180 ease-out hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ── StatusBadge ── */
interface StatusBadgeProps {
  text: string;
  variant?: "ok" | "warn" | "bad" | "done" | "vi" | "neutral";
  className?: string;
}

const badgeMap = {
  ok: "bg-[rgba(163,230,53,.1)]   text-good   border-[rgba(163,230,53,.2)]",
  warn: "bg-[rgba(245,158,11,.1)]   text-warn   border-[rgba(245,158,11,.2)]",
  bad: "bg-[rgba(255,61,113,.12)]  text-bad    border-[rgba(255,61,113,.2)]",
  done: "bg-[rgba(16,185,129,.1)]   text-done   border-[rgba(16,185,129,.2)]",
  vi: "bg-[rgba(139,92,246,.1)]   text-violet border-[rgba(139,92,246,.2)]",
  neutral: "bg-surface text-text2 border-border-default",
};

export function StatusBadge({
  text,
  variant = "neutral",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-[7px] py-[2px] text-[10px] font-semibold tracking-wide uppercase rounded-[2px] border",
        badgeMap[variant],
        className,
      )}
    >
      {text}
    </span>
  );
}

/* ── StatusDot ── */
interface StatusDotProps {
  connected?: boolean;
  className?: string;
}
export function StatusDot({ connected, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-block w-[7px] h-[7px] rounded-full",
        connected ? "bg-good shadow-[0_0_6px_var(--good)]" : "bg-bad",
        className,
      )}
    />
  );
}

/* ── MonoText ── */
interface MonoTextProps {
  children: ReactNode;
  size?: "xs" | "sm" | "base";
  color?: "text" | "text2" | "dim" | "accent" | "acid";
  className?: string;
}
export function MonoText({
  children,
  size = "sm",
  color = "text2",
  className,
}: MonoTextProps) {
  const sizeMap = { xs: "text-[10px]", sm: "text-[11px]", base: "text-[13px]" };
  return (
    <span
      className={cn(
        "font-mono tracking-wide",
        sizeMap[size],
        `text-${color}`,
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── IconButton ── */
interface IconButtonProps {
  icon: ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  variant?: "ghost" | "subtle" | "accent";
  size?: "sm" | "md";
  className?: string;
}

const ibVariant = {
  ghost:
    "bg-transparent text-text2 hover:text-text hover:bg-[rgba(255,255,255,0.04)]",
  subtle:
    "bg-surface text-text2 hover:text-text border border-border-default hover:border-bor2",
  accent:
    "bg-[rgba(163,230,53,.12)] text-accent border border-[rgba(163,230,53,.25)] hover:bg-[rgba(163,230,53,.18)]",
};

const ibSize = { sm: "w-7 h-7", md: "w-9 h-9" };

export function IconButton({
  icon,
  onClick,
  title,
  active,
  variant = "ghost",
  size = "md",
  className,
}: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center justify-center rounded-lg transition-all duration-150",
        ibVariant[variant],
        ibSize[size],
        active &&
          variant === "ghost" &&
          "text-accent bg-[rgba(163,230,53,.08)]",
        className,
      )}
    >
      {icon}
    </button>
  );
}

/* ── SectionTitle ── */
interface SectionTitleProps {
  label: string;
  className?: string;
  action?: ReactNode;
}

export function SectionTitle({ label, className, action }: SectionTitleProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-[13px] py-[6px]",
        className,
      )}
    >
      <span className="text-[8px] font-semibold tracking-[3px] uppercase text-dim">
        {label}
      </span>
      {action}
    </div>
  );
}

/* ── Divider ── */
interface DividerProps {
  vertical?: boolean;
  className?: string;
  spacing?: "none" | "sm" | "md";
}

export function Divider({ vertical, className, spacing = "sm" }: DividerProps) {
  const spaceMap = {
    none: "",
    sm: vertical ? "mx-2" : "my-2",
    md: vertical ? "mx-4" : "my-4",
  };
  return (
    <div
      className={cn(
        spaceMap[spacing],
        vertical
          ? "w-px h-full bg-border-default"
          : "w-full h-px bg-border-default",
        className,
      )}
    />
  );
}

/* ── Toolbar ── */
interface ToolbarProps {
  children: ReactNode;
  className?: string;
  gap?: "sm" | "md";
}

export function Toolbar({ children, className, gap = "sm" }: ToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center",
        gap === "sm" ? "gap-1" : "gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── ScrollContainer ── */
interface ScrollContainerProps {
  children: ReactNode;
  className?: string;
  horizontal?: boolean;
}

export function ScrollContainer({
  children,
  className,
  horizontal,
}: ScrollContainerProps) {
  return (
    <div
      className={cn(
        "overflow-auto",
        horizontal ? "overflow-y-hidden" : "overflow-x-hidden",
        "scrollbar-thin",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── DataRow ── */
interface DataRowProps {
  label: string;
  value: ReactNode;
  className?: string;
  mono?: boolean;
}

export function DataRow({ label, value, className, mono }: DataRowProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-[13px] py-[5px] text-[11px]",
        className,
      )}
    >
      <span className="text-text2">{label}</span>
      <span className={cn("text-text", mono && "font-mono")}>{value}</span>
    </div>
  );
}
