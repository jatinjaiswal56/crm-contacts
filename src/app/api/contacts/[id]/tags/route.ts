import {
  conflictResponse,
  internalServerErrorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/responses";
import { parseJsonBody } from "@/lib/api/request";
import { replaceContactTags } from "@/lib/contacts/repository";
import {
  contactIdSchema,
  tagIdsSchema,
} from "@/lib/contacts/validation";
import { getContact } from "@/lib/contacts/service";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsedId = contactIdSchema.safeParse(id);
  if (!parsedId.success) {
    return validationErrorResponse(parsedId.error);
  }

  const body = await parseJsonBody(request);
  if (!body.success) {
    return Response.json({ error: body.error }, { status: 400 });
  }

  const parsed = tagIdsSchema.safeParse(body.data);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  try {
    const result = await replaceContactTags(
      parsedId.data,
      parsed.data.tagIds,
      parsed.data.expectedVersion,
    );
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
    if (result.kind === "invalid-tags") {
      return conflictResponse("One or more selected tags no longer exist.");
    }
    return Response.json({
      item: {
        id: parsedId.data,
        tagIds: parsed.data.tagIds,
        version: result.version,
      },
    });
  } catch (error) {
    return internalServerErrorResponse("PUT /api/contacts/[id]/tags", error);
  }
}
