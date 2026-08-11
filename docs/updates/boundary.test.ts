import { describe, it, expect } from "vitest";
import { checkBoundary, isSkillFile } from "../src/analysis/boundary.js";

describe("checkBoundary", () => {
  it("excludes node_modules", () => {
    const result = checkBoundary(
      "/home/r3v/Stable/node_modules/lodash/index.ts",
    );
    expect(result.inScope).toBe(false);
  });

  it("excludes dist", () => {
    const result = checkBoundary("/home/r3v/Stable/dist/index.js");
    expect(result.inScope).toBe(false);
  });

  it("excludes .d.ts files", () => {
    const result = checkBoundary("/home/r3v/Stable/client/src/types.d.ts");
    expect(result.inScope).toBe(false);
  });

  it("includes .ts files in src", () => {
    const result = checkBoundary(
      "/home/r3v/Stable/packages/llpte-core/src/index.ts",
    );
    expect(result.inScope).toBe(true);
  });

  it("includes .tsx files", () => {
    const result = checkBoundary(
      "/home/r3v/Stable/client/src/components/DAW.tsx",
    );
    expect(result.inScope).toBe(true);
  });

  it("excludes .js files", () => {
    const result = checkBoundary("/home/r3v/Stable/scripts/setup.js");
    expect(result.inScope).toBe(false);
  });
});

describe("isSkillFile", () => {
  it("identifies SKILL.md", () => {
    expect(isSkillFile("/home/r3v/Stable/packages/llpte-core/SKILL.md")).toBe(
      true,
    );
  });

  it("rejects SKILL.md inside node_modules", () => {
    expect(isSkillFile("/home/r3v/Stable/node_modules/pkg/SKILL.md")).toBe(
      false,
    );
  });

  it("rejects non-SKILL.md files", () => {
    expect(isSkillFile("/home/r3v/Stable/README.md")).toBe(false);
  });
});
