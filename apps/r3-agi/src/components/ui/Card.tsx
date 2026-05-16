import type { ReactNode } from "react";
import { Panel } from "../components/Panel";

export function Card({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <Panel elevation="raised" padding="sm" variant="default">
      <Panel.Header
        title={typeof title === "string" ? title : ""}
        icon={typeof title !== "string" ? title : undefined}
      />
      <Panel.Body>{children}</Panel.Body>
    </Panel>
  );
}
