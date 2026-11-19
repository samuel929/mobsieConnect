import { describe, expect, it } from "vitest";
import {
  applicationReference,
  childInitials,
  nextAvailableReference,
} from "./applicationReference";

describe("application references", () => {
  it("formats campus, child initials and birth date", () => {
    expect(applicationReference("Hebron Branch", "Carter Anderson", "2020-10-08")).toBe(
      "H1CA081020",
    );
    expect(applicationReference("Mamelodi Branch", "Naledi Sepuba", "2022-04-17")).toBe(
      "M1NS170422",
    );
    expect(applicationReference("Soshanguve 1", "Mob Magagula", "2021-01-02")).toBe(
      "S1MM020121",
    );
  });

  it("uses every name initial and ignores punctuation", () => {
    expect(childInitials("Lebo Anne-Marie van Wyk")).toBe("LAMVW");
  });

  it("adds a suffix only when the reference already exists", () => {
    expect(nextAvailableReference("H1CA081020", [])).toBe("H1CA081020");
    expect(nextAvailableReference("H1CA081020", ["H1CA081020", "H1CA081020-2"])).toBe(
      "H1CA081020-3",
    );
  });
});
