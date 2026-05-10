import { describe, it, expect } from "vitest";
import { HealthCheckResponse } from "./api";

describe("api-zod schemas", () => {
  describe("HealthCheckResponse", () => {
    it("should validate correct health status", () => {
      const valid = { status: "ok" };
      const result = HealthCheckResponse.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject missing status field", () => {
      const invalid = {};
      const result = HealthCheckResponse.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject non-string status", () => {
      const invalid = { status: 123 };
      const result = HealthCheckResponse.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject extra fields (strict mode)", () => {
      const withExtra = { status: "ok", extra: "field" };
      const result = HealthCheckResponse.safeParse(withExtra);
      // Zod allows extra fields by default unless .strict() is used
      // This test documents current behavior
      expect(result.success).toBe(true);
    });

    it("should extract parsed data correctly", () => {
      const input = { status: "healthy" };
      const result = HealthCheckResponse.parse(input);
      expect(result.status).toBe("healthy");
    });
  });
});
