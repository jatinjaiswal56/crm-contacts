import type { ContactWriteFields } from "@/lib/contacts/validation";
import styles from "./contact-dialog.module.css";
import type { Tag } from "./tag-picker";

type LatestContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  version: number;
  tags: { id: string; name: string }[];
};

export type ContactConflict = {
  message: string;
  latest: LatestContact;
};

type Props = {
  conflict: ContactConflict;
  draft: ContactWriteFields;
  tags: Tag[];
  selectedTagIds: string[];
  onUseLatest: () => void;
  onMergeDraft: () => void;
};

export function ConflictPanel({
  conflict,
  draft,
  tags,
  selectedTagIds,
  onUseLatest,
  onMergeDraft,
}: Props) {
  const rows: [string, string, string][] = [
    ["First name", draft.firstName, conflict.latest.firstName],
    ["Last name", draft.lastName, conflict.latest.lastName],
    ["Email", draft.email, conflict.latest.email ?? "—"],
    [
      "Phone",
      draft.phone ? `+91 ${draft.phone}` : "—",
      conflict.latest.phone ?? "—",
    ],
    ["Company", draft.company, conflict.latest.company ?? "—"],
    [
      "Tags",
      selectedTagIds
        .map((id) => tags.find((tag) => tag.id === id)?.name ?? id)
        .join(", ") || "—",
      conflict.latest.tags.map((tag) => tag.name).join(", ") || "—",
    ],
  ];

  return (
    <section
      className={styles.conflictSection}
      role="alert"
      aria-labelledby="contact-conflict-title"
    >
      <h3 id="contact-conflict-title">
        This contact changed while you were editing
      </h3>
      <p id="contact-conflict-message">{conflict.message}</p>
      <p>
        Compare your draft with the latest saved values. You can accept the
        latest version or merge only your changed fields, then save again.
      </p>
      <div className={styles.conflictCompare}>
        <table>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Your draft</th>
              <th scope="col">Latest server value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, draftValue, latestValue]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{draftValue || "—"}</td>
                <td>{latestValue || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.conflictActions}>
        <button type="button" onClick={onUseLatest}>
          Use latest values
        </button>
        <button
          className={styles.dialogPrimary}
          type="button"
          onClick={onMergeDraft}
        >
          Merge my draft onto latest
        </button>
      </div>
    </section>
  );
}
