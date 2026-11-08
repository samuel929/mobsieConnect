import { describe, expect, it } from "vitest";

import { schoolPrice } from "./schoolPackages";

describe("2027 branch fee structures", () => {
  it("uses Mamelodi fees instead of Hebron fees", () => {
    expect(schoolPrice("CHILD_DAY_CARE", "STAGE_1", "Mamelodi Branch")).toMatchObject({
      applicationFeeCents: 95_000,
      monthlyFeeCents: 150_000,
    });
    expect(schoolPrice("CHILD_DAY_CARE", "STAGE_1", "Hebron Branch")).toMatchObject({
      applicationFeeCents: 95_000,
      monthlyFeeCents: 120_000,
    });
  });

  it.each([
    ["STAGE_1", 150_000],
    ["STAGE_2", 130_000],
    ["STAGE_3", 130_000],
    ["STAGE_4", 110_000],
    ["GRADE_R", 110_000],
  ] as const)("uses the official Mamelodi rate for %s", (stage, monthlyFeeCents) => {
    expect(schoolPrice("CHILD_DAY_CARE", stage, "Mamelodi").monthlyFeeCents).toBe(
      monthlyFeeCents,
    );
  });
});
