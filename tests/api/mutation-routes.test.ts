import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { POST as createContact } from "../../src/app/api/contacts/route";
import { PATCH as updateContact } from "../../src/app/api/contacts/[id]/route";
import { PUT as replaceTags } from "../../src/app/api/contacts/[id]/tags/route";
import { getDb, getPool } from "../../src/lib/db/client";
import { contactActivities, contacts, tags } from "../../src/lib/db/schema";

const uniqueEmail = "mutation-test@example.com";
const secondUniqueEmail = "mutation-second@example.com";
const concurrentUniqueEmail = "mutation-concurrent@example.com";
let createdId: string | null = null;
let secondCreatedId: string | null = null;
let concurrentCreatedId: string | null = null;

const routeContext = (id: string) => ({ params: Promise.resolve({ id }) });
const jsonRequest = (url: string, method: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const malformedJsonRequest = (url: string, method: string) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: "{",
  });

describe("contact mutation routes", () => {
  afterAll(async () => {
    if (createdId) {
      await getDb().delete(contacts).where(eq(contacts.id, createdId));
    }
    if (secondCreatedId) {
      await getDb().delete(contacts).where(eq(contacts.id, secondCreatedId));
    }
    if (concurrentCreatedId) {
      await getDb().delete(contacts).where(eq(contacts.id, concurrentCreatedId));
    }
    await getPool().end();
  });

  it("returns INVALID_JSON for malformed contact and tag mutation bodies", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const responses = [
      await createContact(malformedJsonRequest("/api/contacts", "POST")),
      await updateContact(
        malformedJsonRequest(`/api/contacts/${id}`, "PATCH"),
        routeContext(id),
      ),
      await replaceTags(
        malformedJsonRequest(`/api/contacts/${id}/tags`, "PUT"),
        routeContext(id),
      ),
    ];

    for (const response of responses) {
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      });
    }
  });

  it("creates contacts and rejects duplicate normalized emails and phone numbers", async () => {
    await getDb().delete(contacts).where(eq(contacts.emailNormalized, uniqueEmail));
    await getDb().delete(contacts).where(eq(contacts.emailNormalized, secondUniqueEmail));

    const invalid = await createContact(
      jsonRequest("/api/contacts", "POST", {
        firstName: "Incomplete",
        lastName: "",
      }),
    );
    expect(invalid.status).toBe(400);

    const invalidPhone = await createContact(
      jsonRequest("/api/contacts", "POST", {
        firstName: "Invalid",
        lastName: "Number",
        email: "invalid-number@example.com",
        phone: "1234567890",
        company: "Test Works",
      }),
    );
    expect(invalidPhone.status).toBe(400);

    const created = await createContact(
      jsonRequest("/api/contacts", "POST", {
        firstName: "Mutation",
        lastName: "Tester",
        email: "Mutation-Test@example.com",
        phone: "9876543210",
        company: "Test Works",
      }),
    );
    const createdBody = (await created.json()) as {
      item: { id: string; version: number; phone: string };
    };

    expect(created.status).toBe(201);
    expect(createdBody.item.phone).toBe("+91 9876543210");
    createdId = createdBody.item.id;
    const creationActivities = await getDb()
      .select()
      .from(contactActivities)
      .where(eq(contactActivities.contactId, createdId));
    expect(
      creationActivities.some((activity) => activity.type === "CONTACT_CREATED"),
    ).toBe(true);

    const duplicate = await createContact(
      jsonRequest("/api/contacts", "POST", {
        firstName: "Other",
        lastName: "Person",
        email: "mutation-test@EXAMPLE.com",
        phone: "9876543211",
        company: "Another Works",
      }),
    );
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error.code).toBe("DUPLICATE_CONTACT");

    const duplicatePhone = await createContact(
      jsonRequest("/api/contacts", "POST", {
        firstName: "Phone",
        lastName: "Duplicate",
        email: "different-email@example.com",
        phone: "9876543210",
        company: "Another Works",
      }),
    );
    expect(duplicatePhone.status).toBe(409);
    const duplicatePhoneBody = await duplicatePhone.json();
    expect(duplicatePhoneBody.error.code).toBe("DUPLICATE_CONTACT");
    expect(duplicatePhoneBody.error.message).toContain("phone number");
  });

  it("updates with optimistic concurrency and records a conflict", async () => {
    expect(createdId).not.toBeNull();

    const secondCreated = await createContact(
      jsonRequest("/api/contacts", "POST", {
        firstName: "Second",
        lastName: "Mutation",
        email: secondUniqueEmail,
        phone: "9876543212",
        company: "Test Works",
      }),
    );
    expect(secondCreated.status).toBe(201);
    const secondBody = (await secondCreated.json()) as { item: { id: string } };
    secondCreatedId = secondBody.item.id;

    const duplicatePhoneUpdate = await updateContact(
      jsonRequest(`/api/contacts/${createdId}`, "PATCH", {
        firstName: "Mutation",
        lastName: "Tester",
        email: uniqueEmail,
        phone: "9876543212",
        company: "Test Works",
        expectedVersion: 1,
      }),
      routeContext(createdId!),
    );
    expect(duplicatePhoneUpdate.status).toBe(409);
    const duplicatePhoneUpdateBody = await duplicatePhoneUpdate.json();
    expect(duplicatePhoneUpdateBody.error.code).toBe("DUPLICATE_CONTACT");
    expect(duplicatePhoneUpdateBody.error.message).toContain("phone number");

    const firstUpdate = await updateContact(
      jsonRequest(`/api/contacts/${createdId}`, "PATCH", {
        firstName: "Mutation",
        lastName: "Updated",
        email: uniqueEmail,
        phone: "9876543211",
        company: "Test Works",
        expectedVersion: 1,
      }),
      routeContext(createdId!),
    );
    expect(firstUpdate.status).toBe(200);
    const firstUpdateBody = await firstUpdate.json();
    expect(firstUpdateBody.item.tags).toEqual([]);
    const updateActivities = await getDb()
      .select()
      .from(contactActivities)
      .where(eq(contactActivities.contactId, createdId!));
    const updateActivity = updateActivities.find(
      (activity) => activity.type === "CONTACT_UPDATED",
    );
    expect(updateActivity?.metadata).toMatchObject({
      changedFields: ["lastName", "email", "phone"],
      previousVersion: 1,
      newVersion: 2,
    });

    const staleUpdate = await updateContact(
      jsonRequest(`/api/contacts/${createdId}`, "PATCH", {
        firstName: "Mutation",
        lastName: "Stale",
        email: uniqueEmail,
        phone: "9876543212",
        company: "Test Works",
        expectedVersion: 1,
      }),
      routeContext(createdId!),
    );
    expect(staleUpdate.status).toBe(409);
    const conflictBody = await staleUpdate.json();
    expect(conflictBody.error.code).toBe("VERSION_CONFLICT");
    expect(conflictBody.latest.lastName).toBe("Updated");
    expect(conflictBody.latest.version).toBe(2);
  });

  it("allows only one concurrent update for the same contact version", async () => {
    await getDb()
      .delete(contacts)
      .where(eq(contacts.emailNormalized, concurrentUniqueEmail));

    const created = await createContact(
      jsonRequest("/api/contacts", "POST", {
        firstName: "Concurrent",
        lastName: "Tester",
        email: concurrentUniqueEmail,
        phone: "9876543213",
        company: "Test Works",
      }),
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { item: { id: string } };
    const contactId = createdBody.item.id;
    concurrentCreatedId = contactId;

    const makeUpdate = (lastName: string) =>
      updateContact(
        jsonRequest(`/api/contacts/${contactId}`, "PATCH", {
          firstName: "Concurrent",
          lastName,
          email: concurrentUniqueEmail,
          phone: "9876543213",
          company: "Test Works",
          expectedVersion: 1,
        }),
        routeContext(contactId),
      );

    // PGlite may serialize local transactions; CI's PostgreSQL service exercises true contention.
    const responses = await Promise.all([
      makeUpdate("First"),
      makeUpdate("Second"),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200,
      409,
    ]);
    const conflict = responses.find((response) => response.status === 409);
    expect(conflict).toBeDefined();
    expect((await conflict!.json()).error.code).toBe("VERSION_CONFLICT");
  });

  it("replaces tags transactionally", async () => {
    expect(createdId).not.toBeNull();
    const availableTags = await getDb().select().from(tags).limit(2);
    expect(availableTags.length).toBeGreaterThan(0);

    const staleResponse = await replaceTags(
      jsonRequest(`/api/contacts/${createdId}/tags`, "PUT", {
        tagIds: availableTags.map((tag) => tag.id),
        expectedVersion: 1,
      }),
      routeContext(createdId!),
    );
    expect(staleResponse.status).toBe(409);
    const staleBody = await staleResponse.json();
    expect(staleBody.error.code).toBe("VERSION_CONFLICT");
    expect(staleBody.latest.version).toBe(2);

    const response = await replaceTags(
      jsonRequest(`/api/contacts/${createdId}/tags`, "PUT", {
        tagIds: availableTags.map((tag) => tag.id),
        expectedVersion: 2,
      }),
      routeContext(createdId!),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).item.version).toBe(3);
    const addedActivities = await getDb()
      .select()
      .from(contactActivities)
      .where(eq(contactActivities.contactId, createdId!));
    const addedActivity = addedActivities.find(
      (activity) => activity.type === "TAG_ADDED",
    );
    expect(addedActivity?.metadata).toMatchObject({
      tagId: availableTags[0]!.id,
      tagName: availableTags[0]!.name,
    });

    const removedResponse = await replaceTags(
      jsonRequest(`/api/contacts/${createdId}/tags`, "PUT", {
        tagIds: [],
        expectedVersion: 3,
      }),
      routeContext(createdId!),
    );
    expect(removedResponse.status).toBe(200);
    expect((await removedResponse.json()).item.version).toBe(4);
    const removedActivities = await getDb()
      .select()
      .from(contactActivities)
      .where(eq(contactActivities.contactId, createdId!));
    const removedActivity = removedActivities.find(
      (activity) => activity.type === "TAG_REMOVED",
    );
    expect(removedActivity?.metadata).toMatchObject({
      tagId: availableTags[0]!.id,
      tagName: availableTags[0]!.name,
    });

    const invalidTags = await replaceTags(
      jsonRequest(`/api/contacts/${createdId}/tags`, "PUT", {
        tagIds: ["00000000-0000-4000-8000-000000000099"],
        expectedVersion: 4,
      }),
      routeContext(createdId!),
    );
    expect(invalidTags.status).toBe(422);
    expect((await invalidTags.json()).error.code).toBe("INVALID_TAGS");
  });

  it("returns 404 when replacing tags for a missing contact", async () => {
    const missingId = "00000000-0000-4000-8000-000000000098";
    const response = await replaceTags(
      jsonRequest(`/api/contacts/${missingId}/tags`, "PUT", {
        tagIds: [],
        expectedVersion: 1,
      }),
      routeContext(missingId),
    );

    expect(response.status).toBe(404);
  });
});
