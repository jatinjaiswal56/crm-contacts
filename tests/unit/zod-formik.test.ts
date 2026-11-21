import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodToFormikErrors } from "../../src/lib/forms/zod-formik";

const schema = z.object({
  code: z
    .string()
    .min(5, "Code must be 5 characters.")
    .regex(/^[A-Z]+$/, "Use capital letters only."),
  email: z.email("Enter a valid email."),
});

describe("zodToFormikErrors", () => {
  it("returns no errors for valid values", () => {
    expect(
      zodToFormikErrors(schema, { code: "ABCDE", email: "a@b.co" }),
    ).toEqual({});
  });

  it("maps every invalid field and keeps its first message", () => {
    expect(zodToFormikErrors(schema, { code: "ab", email: "nope" })).toEqual({
      code: "Code must be 5 characters.",
      email: "Enter a valid email.",
    });
  });
});
