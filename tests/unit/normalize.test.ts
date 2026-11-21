import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  normalizePhone,
  toContactWriteValues,
  toStoredPhone,
} from "../../src/lib/contacts/normalize";

describe("contact normalization", () => {
  it("normalizes email casing and strips phone formatting", () => {
    expect(normalizeEmail(" Ava@Example.COM ")).toBe("ava@example.com");
    expect(normalizePhone("+91 98765-43210")).toBe("919876543210");
  });

  it("converts validated phone digits to the stored display format", () => {
    expect(toStoredPhone("9876543210")).toBe("+91 9876543210");
    expect(
      toContactWriteValues({
        firstName: "Ava",
        lastName: "Rao",
        email: "ava@example.com",
        phone: "9876543210",
        company: "Acme",
      }),
    ).toEqual({
      firstName: "Ava",
      lastName: "Rao",
      email: "ava@example.com",
      phone: "+91 9876543210",
      company: "Acme",
    });
  });
});
