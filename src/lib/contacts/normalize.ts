import type { ContactWriteFields } from "./validation";

export type ContactWriteValues = Omit<ContactWriteFields, "phone"> & {
  phone: string;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function toStoredPhone(digits: string) {
  return `+91 ${digits}`;
}

export function toContactWriteValues(
  parsed: ContactWriteFields,
): ContactWriteValues {
  return {
    ...parsed,
    phone: toStoredPhone(parsed.phone),
  };
}
