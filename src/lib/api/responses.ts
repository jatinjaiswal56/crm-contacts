import type { ZodError } from "zod";

type ConflictCode = "VERSION_CONFLICT" | "DUPLICATE_CONTACT";

export function validationErrorResponse(error: ZodError) {
  return Response.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        details: error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          message: issue.message,
        })),
      },
    },
    { status: 400 },
  );
}

export function notFoundResponse(resource: string) {
  return Response.json(
    {
      error: {
        code: "NOT_FOUND",
        message: `${resource} not found.`,
      },
    },
    { status: 404 },
  );
}

export function conflictResponse(
  code: ConflictCode,
  message: string,
  details?: Record<string, unknown>,
) {
  return Response.json(
    {
      error: {
        code,
        message,
      },
      ...details,
    },
    { status: 409 },
  );
}

export function unprocessableEntityResponse(
  code: "INVALID_TAGS",
  message: string,
) {
  return Response.json(
    {
      error: {
        code,
        message,
      },
    },
    { status: 422 },
  );
}

export function internalServerErrorResponse(context: string, error: unknown) {
  console.error(`${context} failed:`, error);

  return Response.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    },
    { status: 500 },
  );
}
