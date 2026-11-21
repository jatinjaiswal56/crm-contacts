import { describe, expect, it } from "vitest";
import { sanitizeContactQuery } from "../../src/lib/contacts/query-params";

describe("sanitizeContactQuery", () => {
  it("keeps supported filters in a stable order and removes unknown keys", () => {
    const params = new URLSearchParams(
      "utm_source=x&page=3&tag=VIP&company=Northstar&search=ada&sort=name&order=desc&pageSize=50",
    );

    expect(sanitizeContactQuery(params)).toBe(
      "search=ada&company=Northstar&tag=VIP&sort=name&order=desc&page=3",
    );
  });

  it.each(["abc", "0", "-1"])("drops invalid page %s", (page) => {
    expect(
      sanitizeContactQuery(new URLSearchParams(`page=${page}`)),
    ).toBe("");
  });

  it("drops unsupported sort and order values", () => {
    expect(
      sanitizeContactQuery(
        new URLSearchParams("sort=updatedAt&order=sideways"),
      ),
    ).toBe("");
  });

  it("passes valid sort, order, and page values through", () => {
    expect(
      sanitizeContactQuery(
        new URLSearchParams("page=2&order=desc&sort=createdAt"),
      ),
    ).toBe("sort=createdAt&order=desc&page=2");
  });
});
