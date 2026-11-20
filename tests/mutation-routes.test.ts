import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { POST as createContact } from "../src/app/api/contacts/route";
import { PATCH as updateContact } from "../src/app/api/contacts/[id]/route";
import { PUT as replaceTags } from "../src/app/api/contacts/[id]/tags/route";
import { db, pool } from "../src/lib/db/client";
import { contacts, tags } from "../src/lib/db/schema";

const uniqueEmail = "mutation-test@example.com";
const secondUniqueEmail = "mutation-second@example.com";
let createdId: string | null = null;
let secondCreatedId: string | null = null;

const routeContext = (id: string) => ({ params: Promise.resolve({ id }) });
const jsonRequest = (url: string, method: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("contact mutation routes", () => {
  afterAll(async () => {
    if (createdId) {
      await db.delete(contacts).where(eq(contacts.id, createdId));
    }
    if (secondCreatedId) {
      await db.delete(contacts).where(eq(contacts.id, secondCreatedId));
    }
    await pool.end();
  });

  it("creates contacts and rejects duplicate normalized emails and phone numbers", async () => {
    await db.delete(contacts).where(eq(contacts.emailNormalized, uniqueEmail));
    await db.delete(contacts).where(eq(contacts.emailNormalized, secondUniqueEmail));

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
    expect((await duplicatePhone.json()).error.message).toContain("phone number");
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
    expect((await duplicatePhoneUpdate.json()).error.message).toContain(
      "phone number",
    );

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
    expect(conflictBody.latest.lastName).toBe("Updated");
    expect(conflictBody.latest.version).toBe(2);
  });

  it("replaces tags transactionally", async () => {
    expect(createdId).not.toBeNull();
    const availableTags = await db.select().from(tags).limit(2);
    expect(availableTags.length).toBeGreaterThan(0);

    const staleResponse = await replaceTags(
      jsonRequest(`/api/contacts/${createdId}/tags`, "PUT", {
        tagIds: availableTags.map((tag) => tag.id),
        expectedVersion: 1,
      }),
      routeContext(createdId!),
    );
    expect(staleResponse.status).toBe(409);
    expect((await staleResponse.json()).latest.version).toBe(2);

    const response = await replaceTags(
      jsonRequest(`/api/contacts/${createdId}/tags`, "PUT", {
        tagIds: availableTags.map((tag) => tag.id),
        expectedVersion: 2,
      }),
      routeContext(createdId!),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).item.version).toBe(3);
  });
});
