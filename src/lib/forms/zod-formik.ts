import type { FormikErrors } from "formik";
import type { z } from "zod";

/**
 * Validates `values` with a Zod schema and maps the issues to Formik's
 * error shape. Only the first message per top-level field is kept, which
 * matches how Formik shows a single error under each input.
 */
export function zodToFormikErrors<Values extends object>(
  schema: z.ZodType<unknown>,
  values: Values,
): FormikErrors<Values> {
  const parsed = schema.safeParse(values);
  if (parsed.success) return {};

  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field] = issue.message;
    }
  }
  return errors as FormikErrors<Values>;
}
