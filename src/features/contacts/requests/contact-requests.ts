import { z } from "zod";
import { getApiErrorMessage } from "@/lib/api/error-schema";
import type { ContactWriteFields } from "@/lib/contacts/validation";
import type { ContactConflict } from "@/features/contacts/components/dialog/conflict-panel";

const mutationItemSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  version: z.number(),
});

const conflictPayloadSchema = z.object({
  error: z.object({
    code: z.literal("VERSION_CONFLICT"),
    message: z.string(),
  }),
  latest: mutationItemSchema.extend({
    tags: z.array(z.object({ id: z.string(), name: z.string() })),
  }),
});

export type SavedContact = z.infer<typeof mutationItemSchema>;

export type RequestFailure =
  | { status: "conflict"; conflict: ContactConflict }
  | { status: "error"; message: string };

export type RequestResult<T> = { status: "ok"; data: T } | RequestFailure;

async function sendJson(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  return { response, payload };
}

function toFailure(payload: unknown, fallback: string): RequestFailure {
  const parsedConflict = conflictPayloadSchema.safeParse(payload);
  if (parsedConflict.success) {
    const { latest, error } = parsedConflict.data;
    return { status: "conflict", conflict: { latest, message: error.message } };
  }
  return { status: "error", message: getApiErrorMessage(payload, fallback) };
}

/** Creates a contact (no id) or updates one with optimistic locking. */
export async function saveContactFields({
  contactId,
  expectedVersion,
  values,
}: {
  contactId?: string;
  expectedVersion: number;
  values: ContactWriteFields;
}): Promise<RequestResult<SavedContact>> {
  const { response, payload } = await sendJson(
    contactId ? `/api/contacts/${contactId}` : "/api/contacts",
    contactId ? "PATCH" : "POST",
    { ...values, ...(contactId ? { expectedVersion } : {}) },
  );
  if (!response.ok) return toFailure(payload, "Could not save contact.");

  const savedContact = mutationItemSchema.safeParse(
    (payload as { item?: unknown } | null)?.item,
  );
  if (!savedContact.success) {
    throw new Error("The contacts service returned an invalid response.");
  }
  return { status: "ok", data: savedContact.data };
}

/** Replaces a contact's tag set with optimistic locking. */
export async function saveContactTags({
  contactId,
  expectedVersion,
  tagIds,
}: {
  contactId: string;
  expectedVersion: number;
  tagIds: string[];
}): Promise<RequestResult<null>> {
  const { response, payload } = await sendJson(
    `/api/contacts/${contactId}/tags`,
    "PUT",
    { tagIds, expectedVersion },
  );
  if (!response.ok) return toFailure(payload, "Could not save tags.");
  return { status: "ok", data: null };
}
