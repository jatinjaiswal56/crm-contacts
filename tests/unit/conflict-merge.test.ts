import { describe, expect, it } from "vitest";
import {
  mergeContactDraft,
  mergeContactTagDraft,
} from "../../src/lib/contacts/conflict-merge";

describe("conflict draft merging", () => {
  it("preserves remote edits to untouched fields and reapplies only the user's changed fields", () => {
    const base = {
      firstName: "Alex",
      lastName: "Rao",
      email: "alex@example.com",
      phone: "9876543210",
      company: "Original Co",
    };
    const draft = { ...base, firstName: "Alec" };
    const latest = { ...base, company: "Updated Co" };

    expect(mergeContactDraft(base, draft, latest)).toEqual({
      ...latest,
      firstName: "Alec",
    });
  });

  it("merges tag additions/removals without dropping unrelated remote tags", () => {
    expect(
      mergeContactTagDraft({
        base: ["keep", "remove"],
        draft: ["keep", "add"],
        latest: ["keep", "remove", "remote"],
      }),
    ).toEqual(["keep", "remote", "add"]);
  });
});
