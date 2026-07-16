import { describe, expect, it } from "vitest";

import { stampGridLayout } from "../stamp-card-templates/layout";

describe("stampGridLayout", () => {
  // Exact expectations for every supported total (goal 3–12 → 4–13 spots).
  const TABLE: Record<number, { cols: number; rows: number[] }> = {
    4: { cols: 4, rows: [4] },
    5: { cols: 5, rows: [5] },
    6: { cols: 3, rows: [3, 3] },
    7: { cols: 4, rows: [4, 3] },
    8: { cols: 4, rows: [4, 4] },
    9: { cols: 3, rows: [3, 3, 3] },
    10: { cols: 5, rows: [5, 5] },
    11: { cols: 4, rows: [4, 4, 3] },
    12: { cols: 4, rows: [4, 4, 4] },
    13: { cols: 5, rows: [5, 5, 3] },
  };

  for (const [total, expected] of Object.entries(TABLE)) {
    it(`lays out ${total} spots as ${expected.rows.join("+")}`, () => {
      expect(stampGridLayout(Number(total))).toEqual(expected);
    });
  }

  it("rows always add up to the total", () => {
    for (let total = 4; total <= 13; total += 1) {
      const { rows } = stampGridLayout(total);
      expect(rows.reduce((s, r) => s + r, 0)).toBe(total);
    }
  });

  it("no row is wider than cols and only the last may be shorter", () => {
    for (let total = 4; total <= 13; total += 1) {
      const { cols, rows } = stampGridLayout(total);
      for (const [i, r] of rows.entries()) {
        expect(r).toBeLessThanOrEqual(cols);
        if (i < rows.length - 1) expect(r).toBe(cols);
      }
    }
  });
});
