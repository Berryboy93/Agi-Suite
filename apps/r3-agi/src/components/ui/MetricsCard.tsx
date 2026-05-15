import { Panel } from "@/ui/components/Panel";

interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  variant?: "default" | "accent" | "warning" | "error" | "success";
}

export function MetricsCard({
  title,
  value,
  subtitle,
  variant = "default",
}: MetricsCardProps) {
  return (
    <Panel elevation="raised" padding="md" variant={variant}>
      <Panel.Header title={title} />
      <Panel.Body>
        <div
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--color-content-primary)",
          }}
        >
          {value}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--color-content-tertiary)",
              marginTop: "4px",
            }}
          >
            {subtitle}
          </div>
        )}
      </Panel.Body>
    </Panel>
  );
}
