import { z } from "zod";

const apiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
});

export function getApiErrorMessage(payload: unknown, fallback: string) {
  const parsed = apiErrorSchema.safeParse(payload);
  return parsed.success ? parsed.data.error.message : fallback;
}
