import { describe, expect, it } from "vitest";
import {
  duplicateContactResponse,
  isUniqueConstraintViolation,
} from "../../src/lib/api/responses";

describe("duplicate contact responses", () => {
  it("uses a field-specific message when the repository identifies a duplicate", async () => {
    const response = duplicateContactResponse("email");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "DUPLICATE_CONTACT",
        message: "A contact with this email already exists.",
      },
    });
  });

  it("uses a general message for a database uniqueness violation", async () => {
    const response = duplicateContactResponse();

    expect(response.status).toBe(409);
    expect((await response.json()).error.message).toBe(
      "A contact with this email or phone number already exists.",
    );
  });

  it("recognizes PostgreSQL unique-constraint errors", () => {
    expect(isUniqueConstraintViolation({ code: "23505" })).toBe(true);
    expect(isUniqueConstraintViolation({ code: "23503" })).toBe(false);
    expect(isUniqueConstraintViolation(null)).toBe(false);
  });
});
