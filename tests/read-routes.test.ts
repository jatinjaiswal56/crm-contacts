import { afterAll, describe, expect, it } from "vitest";
import { GET as getContact } from "../src/app/api/contacts/[id]/route";
import { GET as getContactActivity } from "../src/app/api/contacts/[id]/activity/route";
import { GET as getContacts } from "../src/app/api/contacts/route";
import { GET as getTags } from "../src/app/api/tags/route";
import { pool } from "../src/lib/db/client";

const seededContactId = "00000000-0000-4000-8000-000000000001";
const routeContext = (id: string) => ({ params: Promise.resolve({ id }) });
const request = (path: string) =>
  new Request(`http://localhost${path}`, { method: "GET" });

describe("read API routes", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("returns contacts with tags and pagination", async () => {
    const response = await getContacts(request("/api/contacts?pageSize=2"));
    const body = (await response.json()) as {
      items: { id: string; tags: { id: string; name: string }[] }[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    };

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items.every((contact) => Array.isArray(contact.tags))).toBe(
      true,
    );
    expect(body.pagination).toMatchObject({
      page: 1,
      pageSize: 2,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  it("ignores unknown query parameters", async () => {
    const response = await getContacts(
      request("/api/contacts?utm_source=x"),
    );

    expect(response.status).toBe(200);
  });

  it("filters by case-insensitive search and tag and rejects invalid query values", async () => {
    const filteredResponse = await getContacts(
      request("/api/contacts?search=aarav.kapoor1%40example.com&tag=VIP"),
    );
    const filteredBody = (await filteredResponse.json()) as {
      items: { id: string; tags: { name: string }[] }[];
      pagination: { total: number };
    };

    expect(filteredResponse.status).toBe(200);
    expect(filteredBody.pagination.total).toBe(1);
    expect(filteredBody.items[0]?.id).toBe(seededContactId);
    expect(filteredBody.items[0]?.tags.map((tag) => tag.name)).toContain("VIP");

    const literalWildcardResponse = await getContacts(
      request("/api/contacts?search=%25"),
    );
    const literalWildcardBody = (await literalWildcardResponse.json()) as {
      pagination: { total: number };
    };
    expect(literalWildcardResponse.status).toBe(200);
    expect(literalWildcardBody.pagination.total).toBe(0);

    const invalidResponse = await getContacts(
      request("/api/contacts?page=0&pageSize=101"),
    );
    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("filters companies, sorts by creation time, and paginates without duplicates", async () => {
    const firstPageResponse = await getContacts(
      request(
        "/api/contacts?company=northstar%20labs&sort=createdAt&order=desc&pageSize=3",
      ),
    );
    const firstPage = (await firstPageResponse.json()) as {
      items: { id: string; company: string; createdAt: string }[];
      pagination: { total: number };
    };
    const secondPageResponse = await getContacts(
      request(
        "/api/contacts?company=northstar%20labs&sort=createdAt&order=desc&page=2&pageSize=3",
      ),
    );
    const secondPage = (await secondPageResponse.json()) as {
      items: { id: string; company: string; createdAt: string }[];
    };

    expect(firstPageResponse.status).toBe(200);
    expect(firstPage.pagination.total).toBeGreaterThanOrEqual(3);
    expect(firstPage.items).toHaveLength(3);
    expect(
      firstPage.items.every((contact) =>
        contact.company.toLowerCase().includes("northstar labs"),
      ),
    ).toBe(true);
    expect(
      new Date(firstPage.items[0]!.createdAt).getTime(),
    ).toBeGreaterThanOrEqual(
      new Date(firstPage.items[1]!.createdAt).getTime(),
    );
    expect(secondPageResponse.status).toBe(200);
    expect(
      secondPage.items.every(
        (contact) => !firstPage.items.some((first) => first.id === contact.id),
      ),
    ).toBe(true);
  });

  it("filters companies by a case-insensitive partial match", async () => {
    const response = await getContacts(
      request("/api/contacts?company=north&pageSize=100"),
    );
    const body = (await response.json()) as {
      items: { company: string | null }[];
      pagination: { total: number };
    };

    expect(response.status).toBe(200);
    expect(body.pagination.total).toBeGreaterThan(0);
    expect(
      body.items.every((contact) =>
        contact.company?.toLowerCase().includes("north"),
      ),
    ).toBe(true);
  });

  it("returns a contact with its tags and distinguishes missing contacts", async () => {
    const response = await getContact(
      request(`/api/contacts/${seededContactId}`),
      routeContext(seededContactId),
    );
    const body = (await response.json()) as {
      item: { id: string; tags: { name: string }[] };
    };

    expect(response.status).toBe(200);
    expect(body.item.id).toBe(seededContactId);
    expect(body.item.tags.length).toBeGreaterThan(0);

    const missingResponse = await getContact(
      request("/api/contacts/00000000-0000-4000-8000-000000000999"),
      routeContext("00000000-0000-4000-8000-000000000999"),
    );
    expect(missingResponse.status).toBe(404);
  });

  it("returns recent activity and reports invalid contact IDs", async () => {
    const response = await getContactActivity(
      request(`/api/contacts/${seededContactId}/activity`),
      routeContext(seededContactId),
    );
    const body = (await response.json()) as {
      items: { timestamp: string }[];
    };

    expect(response.status).toBe(200);
    expect(body.items.length).toBeGreaterThan(0);
    expect(new Date(body.items[0]!.timestamp).getTime()).toBeGreaterThanOrEqual(
      new Date(body.items.at(-1)!.timestamp).getTime(),
    );

    const invalidResponse = await getContactActivity(
      request("/api/contacts/not-a-uuid/activity"),
      routeContext("not-a-uuid"),
    );
    expect(invalidResponse.status).toBe(400);
  });

  it("returns tags in alphabetical order", async () => {
    const response = await getTags();
    const body = (await response.json()) as {
      items: { name: string }[];
    };
    const names = body.items.map((tag) => tag.name);

    expect(response.status).toBe(200);
    expect(names.length).toBeGreaterThan(0);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
