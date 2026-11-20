import { internalServerErrorResponse } from "@/lib/api/responses";
import { getTags } from "@/lib/contacts/service";

export async function GET() {
  try {
    return Response.json({ items: await getTags() });
  } catch (error) {
    return internalServerErrorResponse("GET /api/tags", error);
  }
}
