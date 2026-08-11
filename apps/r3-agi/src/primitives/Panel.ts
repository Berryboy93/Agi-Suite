import { jsx as _jsx } from "react/jsx-runtime";

export function Panel({ children, title, style }: any) {
  return _jsx("div", {
    style: {
      border: "1px solid var(--border)",
      borderRadius: "0.5rem",
      padding: "1rem",
      background: "var(--surface)",
      ...style,
    },
    children: title
      ? _jsx("div", {
          style: { marginBottom: "0.75rem", fontWeight: 600 },
          children: title,
        })
      : undefined,
  });
}
