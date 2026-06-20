import { Card } from "@/components/Card";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400, padding: "0 16px" }}>
        <Card
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={18} color="var(--bad)" />
              <span>404 — Page Not Found</span>
            </div>
          }
        >
          <p style={{ fontSize: 13, color: "var(--text2)", margin: 0 }}>
            This route doesn't exist. Did you forget to add it to the router?
          </p>
        </Card>
      </div>
    </div>
  );
}
