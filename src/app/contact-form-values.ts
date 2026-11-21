import type { ContactWriteFields } from "@/lib/contacts/validation";

/** A contact as the dialog edits it; `id` and `version` are absent when creating. */
export type EditableContact = {
  id?: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  version?: number;
  tags: { id: string; name: string }[];
};

/** Returns the 10 local digits of a stored Indian number, or "" if unrecognized. */
export function getIndianPhoneDigits(value: string | null) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) return digits;
  if (value.trim().startsWith("+91") && digits.length === 12) {
    return digits.slice(2);
  }
  return "";
}

export function toFormValues(
  contact: EditableContact | null,
): ContactWriteFields {
  return {
    firstName: contact?.firstName ?? "",
    lastName: contact?.lastName ?? "",
    email: contact?.email ?? "",
    phone: getIndianPhoneDigits(contact?.phone ?? null),
    company: contact?.company ?? "",
  };
}
