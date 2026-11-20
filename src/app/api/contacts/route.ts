import {
  conflictResponse,
  internalServerErrorResponse,
  validationErrorResponse,
} from "@/lib/api/responses";
import { getContact, listContacts } from "@/lib/contacts/service";
import { createContact } from "@/lib/contacts/repository";
import {
  contactWriteFieldsSchema,
  parseContactListQuery,
} from "@/lib/contacts/validation";

export async function GET(request: Request) {
  const parsedQuery = parseContactListQuery(new URL(request.url));
  if (!parsedQuery.success) {
    return validationErrorResponse(parsedQuery.error);
  }

  try {
    return Response.json(await listContacts(parsedQuery.data));
  } catch (error) {
    return internalServerErrorResponse("GET /api/contacts", error);
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = contactWriteFieldsSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  try {
    const result = await createContact({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email ?? null,
      phone: `+91 ${parsed.data.phone}`,
      company: parsed.data.company ?? null,
    });

    if (result.kind === "duplicate") {
      return conflictResponse(
        result.field === "email"
          ? "A contact with this email already exists."
          : "A contact with this phone number already exists.",
      );
    }

    const item = await getContact(result.contact.id);
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return conflictResponse(
        "A contact with this email or phone number already exists.",
      );
    }
    return internalServerErrorResponse("POST /api/contacts", error);
  }
}
