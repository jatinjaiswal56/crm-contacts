import { describe, expect, it } from "vitest";
import { getApiErrorMessage } from "../../src/lib/api/error-schema";

describe("getApiErrorMessage", () => {
  it("returns an API error message when the payload has the expected shape", () => {
    expect(
      getApiErrorMessage(
        { error: { code: "INVALID_INPUT", message: "Invalid contact." } },
        "Fallback message.",
      ),
    ).toBe("Invalid contact.");
  });

  it("uses the fallback when the payload is not an API error", () => {
    expect(getApiErrorMessage({ message: "Not nested." }, "Fallback message."))
      .toBe("Fallback message.");
  });
});
