import { z } from "zod";

const optionalQueryText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .transform((value) => value || undefined)
    .optional();

export const contactListQuerySchema = z
  .object({
    search: optionalQueryText(100),
    company: optionalQueryText(100),
    tag: optionalQueryText(80),
    sort: z.enum(["name", "createdAt"]).default("name"),
    order: z.enum(["asc", "desc"]).default("asc"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  });

export const contactIdSchema = z.string().uuid();

export const contactWriteFieldsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(254),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .regex(
      /^[6-9]\d{9}$/,
      "Enter a valid 10-digit Indian mobile number starting with 6–9",
    ),
  company: z
    .string()
    .trim()
    .min(1, "Company is required")
    .max(120),
});

export const contactUpdateSchema = contactWriteFieldsSchema.extend({
  expectedVersion: z.number().int().min(1),
});

export const tagIdsSchema = z.object({
  tagIds: z.array(z.string().uuid()).max(100),
  expectedVersion: z.number().int().min(1),
});

export type ContactWriteFields = z.infer<typeof contactWriteFieldsSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;

export type ContactListQuery = z.infer<typeof contactListQuerySchema>;

export function parseContactListQuery(url: URL) {
  return contactListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
}
