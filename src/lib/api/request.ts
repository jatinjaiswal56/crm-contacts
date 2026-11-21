type JsonBodyResult =
  | { success: true; data: unknown }
  | {
      success: false;
      error: {
        code: "INVALID_JSON";
        message: "Request body must be valid JSON.";
      };
    };

export async function parseJsonBody(
  request: Request,
): Promise<JsonBodyResult> {
  try {
    return { success: true, data: await request.json() };
  } catch {
    return {
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON.",
      },
    };
  }
}
