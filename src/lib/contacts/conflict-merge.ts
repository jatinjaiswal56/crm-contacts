import type { ContactWriteFields } from "./validation";

type ContactTagIds = {
  base: string[];
  draft: string[];
  latest: string[];
};

const fieldNames = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
] as const satisfies readonly (keyof ContactWriteFields)[];

export function mergeContactDraft(
  base: ContactWriteFields,
  draft: ContactWriteFields,
  latest: ContactWriteFields,
): ContactWriteFields {
  const merged = { ...latest };

  for (const field of fieldNames) {
    if (draft[field] !== base[field]) {
      merged[field] = draft[field];
    }
  }

  return merged;
}

export function mergeContactTagDraft({
  base,
  draft,
  latest,
}: ContactTagIds): string[] {
  const baseIds = new Set(base);
  const draftIds = new Set(draft);
  const latestIds = new Set(latest);
  const addedIds = draft.filter((id) => !baseIds.has(id));
  const removedIds = new Set(base.filter((id) => !draftIds.has(id)));

  return [
    ...latest.filter((id) => !removedIds.has(id)),
    ...addedIds.filter((id) => !latestIds.has(id)),
  ];
}
