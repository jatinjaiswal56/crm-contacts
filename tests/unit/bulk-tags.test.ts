import { describe, expect, it } from "vitest";
import { getBulkTagTarget } from "@/features/contacts/hooks/use-bulk-tagging";

describe("getBulkTagTarget", () => {
  it("adds chosen tags without removing existing ones", () => {
    expect(getBulkTagTarget(["vip"], ["lead"], "add")).toEqual(["vip", "lead"]);
  });

  it("replaces the tag set in replace mode", () => {
    expect(getBulkTagTarget(["vip", "lead"], ["customer"], "replace")).toEqual([
      "customer",
    ]);
    expect(getBulkTagTarget(["vip"], [], "replace")).toEqual([]);
  });

  it("returns null when the contact would not change", () => {
    expect(getBulkTagTarget(["vip", "lead"], ["lead"], "add")).toBeNull();
    expect(getBulkTagTarget(["lead", "vip"], ["vip", "lead"], "replace")).toBeNull();
  });
});
