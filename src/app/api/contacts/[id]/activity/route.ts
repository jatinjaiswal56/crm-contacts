import {
  internalServerErrorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/responses";
import { getContactActivity } from "@/lib/contacts/service";
import { contactIdSchema } from "@/lib/contacts/validation";

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
    const items = await getContactActivity(parsedId.data);
    if (!items) return notFoundResponse("Contact");

    return Response.json({ items });
  } catch (error) {
    return internalServerErrorResponse(
      "GET /api/contacts/[id]/activity",
      error,
    );
  }
}
