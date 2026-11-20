import {
  conflictResponse,
  internalServerErrorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/responses";
import { getContact } from "@/lib/contacts/service";
import { updateContact } from "@/lib/contacts/repository";
import {
  contactIdSchema,
  contactUpdateSchema,
} from "@/lib/contacts/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsedId = contactIdSchema.safeParse(id);
  if (!parsedId.success) {
    return validationErrorResponse(parsedId.error);
  }

  try {
    const contact = await getContact(parsedId.data);
    if (!contact) return notFoundResponse("Contact");

    return Response.json({ item: contact });
  } catch (error) {
    return internalServerErrorResponse("GET /api/contacts/[id]", error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsedId = contactIdSchema.safeParse(id);
  if (!parsedId.success) {
    return validationErrorResponse(parsedId.error);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = contactUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  try {
    const result = await updateContact(parsedId.data, parsed.data.expectedVersion, {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: parsed.data.email ?? null,
      phone: `+91 ${parsed.data.phone}`,
      company: parsed.data.company ?? null,
    });

    if (result.kind === "missing") {
      return notFoundResponse("Contact");
    }
    if (result.kind === "conflict") {
      const latest = await getContact(parsedId.data);
      if (!latest) return notFoundResponse("Contact");
      return conflictResponse(
        `This contact changed on another device (server version ${result.currentVersion}). Compare the latest values before retrying.`,
        { latest },
      );
    }
    if (result.kind === "duplicate") {
      return conflictResponse(
        result.field === "email"
          ? "A contact with this email already exists."
          : "A contact with this phone number already exists.",
      );
    }

    return Response.json({
      item: {
        ...result.contact,
      },
    });
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
    return internalServerErrorResponse("PATCH /api/contacts/[id]", error);
  }
}
