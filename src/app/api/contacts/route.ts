import {
  conflictResponse,
  internalServerErrorResponse,
  validationErrorResponse,
} from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/request";
import { getContact, listContacts } from "@/lib/contacts/service";
import { toContactWriteValues } from "@/lib/contacts/normalize";
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
  const body = await parseJsonBody(request);
  if (!body.success) {
    return Response.json({ error: body.error }, { status: 400 });
  }

  const parsed = contactWriteFieldsSchema.safeParse(body.data);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  try {
    const result = await createContact(toContactWriteValues(parsed.data));

    if (result.kind === "duplicate") {
      return conflictResponse(
        "DUPLICATE_CONTACT",
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
        "DUPLICATE_CONTACT",
        "A contact with this email or phone number already exists.",
      );
    }
    return internalServerErrorResponse("POST /api/contacts", error);
  }
}
