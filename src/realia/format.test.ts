import { describe, expect, it } from "vitest";
import { datasetDetail, formatBytes } from "./format.js";
import { sampleDatasets } from "../testing/fixtures.js";

describe("formatBytes", () => {
  it("treats zero as a size and null as unknown", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(null)).toBe("unknown size");
    expect(formatBytes(Number.NaN)).toBe("unknown size");
  });
});

describe("datasetDetail", () => {
  it("keeps a pipe in a field name inside one table cell", () => {
    const text = datasetDetail(
      {
        ...sampleDatasets[0]!,
        schema: [{ name: "a|b", type: "string", description: "left | right\nmore" }],
      },
      null,
    );
    expect(text).toContain("| `a\\|b` | string | left \\| right more |");
  });
});
