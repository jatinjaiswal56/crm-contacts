import type { ContactWriteFields } from "@/lib/contacts/validation";

type ContactFieldSource = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
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
  contact: ContactFieldSource | null,
): ContactWriteFields {
  return {
    firstName: contact?.firstName ?? "",
    lastName: contact?.lastName ?? "",
    email: contact?.email ?? "",
    phone: getIndianPhoneDigits(contact?.phone ?? null),
    company: contact?.company ?? "",
  };
}
