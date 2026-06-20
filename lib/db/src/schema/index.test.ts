import { describe, it, expect } from "vitest";
import { insertMetricsKvSchema } from "./index";

describe("metrics_kv schema", () => {
  it("should validate correct insert data", () => {
    const data = { key: "totalSubscribers", value: "42" };
    const result = insertMetricsKvSchema.parse(data);
    expect(result.key).toBe("totalSubscribers");
    expect(result.value).toBe("42");
  });

  it("should make updatedAt optional (has default)", () => {
    // updatedAt has .defaultNow(), so it should not be required
    const data = { key: "test", value: "42" };
    expect(() => insertMetricsKvSchema.parse(data)).not.toThrow();
  });

  it("should reject missing key", () => {
    const data = { value: "42" };
    expect(() => insertMetricsKvSchema.parse(data)).toThrow();
  });

  it("should reject missing value", () => {
    const data = { key: "test" };
    expect(() => insertMetricsKvSchema.parse(data)).toThrow();
  });

  it("should allow empty key (no min-length constraint)", () => {
    // drizzle-zod createInsertSchema does NOT add .min(1) to varchar
    const data = { key: "", value: "42" };
    expect(() => insertMetricsKvSchema.parse(data)).not.toThrow();
  });

  it("should allow empty value (no min-length constraint)", () => {
    const data = { key: "test", value: "" };
    expect(() => insertMetricsKvSchema.parse(data)).not.toThrow();
  });

  it("should reject extra fields", () => {
    const data = { key: "test", value: "42", extra: "field" };
    expect(() => insertMetricsKvSchema.parse(data)).toThrow();
  });

  it("should handle unicode keys", () => {
    const data = { key: "订阅者", value: "100" };
    const result = insertMetricsKvSchema.parse(data);
    expect(result.key).toBe("订阅者");
  });
});
