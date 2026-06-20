#!/usr/bin/env python3
import os, subprocess

P = os.path.expanduser("~/Agi-Suite/apps/r3-agi")
F = os.path.join(P, "src/ui/components/Panel.tsx")

c = open(F).read()

# Fix: restore original names and IMPLEMENT the props
old = '''export function Panel({
  children,
  variant = "default",
  _padding = "md",
  _elevation = "none",
  className = "",
  as: Component = "div",
  style,
}: PanelProps) {
  const baseStyle: React.CSSProperties = {
    background: colors.semantic.background.surface,
    borderRadius: spacing.semantic.radius.md,
    border: `1px solid ${colors.semantic.border.subtle}`,
    ...style,
  };'''

new = '''export function Panel({
  children,
  variant = "default",
  padding = "md",
  elevation = "none",
  className = "",
  as: Component = "div",
  style,
}: PanelProps) {
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
  };'''

if old in c:
    c = c.replace(old, new)
    print("[+] Implemented padding and elevation props")
else:
    # Fallback
    c = c.replace("_padding =", "padding =")
    c = c.replace("_elevation =", "elevation =")
    print("[*] Restored prop names")

open(F, "w").write(c)

r = subprocess.run(["pnpm", "tsc", "--noEmit"], cwd=P, capture_output=True, text=True, timeout=120)
print("[+]" if r.returncode == 0 else "[-]", "TypeScript:", "PASS" if r.returncode == 0 else (r.stdout or r.stderr)[:500])
