import { describe, expect, it } from "vitest";

import {
  applicationSchema,
  consentSchema,
  eventSchema,
  parentSignupSchema,
} from "./validation";

describe("API validation", () => {
  it("accepts a complete parent application", () => {
    expect(
      applicationSchema.parse({
        parentName: "Samantha Molefe",
        parentEmail: "parent@example.com",
        parentPhone: "0821234567",
        relationship: "Mother",
        childName: "Prince Tau",
        childDateOfBirth: "2022-05-27",
        childGender: "BOY",
        currentGrade: "Nursery",
      }),
    ).toMatchObject({ childGender: "BOY" });
  });

  it("rejects incomplete consent", () => {
    expect(() =>
      consentSchema.parse({
        informationAccurate: true,
        privacyAccepted: false,
        termsAccepted: true,
      }),
    ).toThrow();
  });

  it("requires a strong parent account password and tenant", () => {
    expect(() =>
      parentSignupSchema.parse({
        tenantId: "91f4ba35-d676-4f48-9482-c51787e59292",
        name: "Samantha Molefe",
        email: "parent@example.com",
        phone: "0821234567",
        password: "short",
      }),
    ).toThrow();
  });

  it("rejects events whose end precedes the start", () => {
    expect(() =>
      eventSchema.parse({
        title: "Sports Day",
        category: "SPORT",
        audience: "ALL",
        startsAt: "2026-08-15T10:00:00.000Z",
        endsAt: "2026-08-15T09:00:00.000Z",
      }),
    ).toThrow();
  });
});
