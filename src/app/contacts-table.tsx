import { LoaderCircle, Pencil, UsersRound } from "lucide-react";
import styles from "./contacts-table.module.css";
import shared from "./shared.module.css";
import type { ContactListResponse } from "./use-contact-directory";

export type ContactRow = ContactListResponse["items"][number];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

type Props = {
  result: ContactListResponse | null;
  isLoading: boolean;
  hasActiveFilters: boolean;
  selectedIds: string[];
  selectionDisabled: boolean;
  onToggleSelected: (contactId: string, selected: boolean) => void;
  onEdit: (contact: ContactRow) => void;
  onClearFilters: () => void;
};

/**
 * Loading, empty and populated states of the contact list. On narrow
 * screens the same table is restyled into cards via data-label cells.
 */
export function ContactsTable({
  result,
  isLoading,
  hasActiveFilters,
  selectedIds,
  selectionDisabled,
  onToggleSelected,
  onEdit,
  onClearFilters,
}: Props) {
  const pagination = result?.pagination;

  return (
    <>
      {isLoading && !result ? (
        <div
          className={styles.loadingState}
          role="status"
          aria-label="Loading contacts"
        >
          <LoaderCircle
            className={shared.spinning}
            size={22}
            aria-hidden="true"
          />
          <span>Loading contacts…</span>
        </div>
      ) : null}

      {result && result.items.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <UsersRound size={22} />
          </span>
          <h3>
            {pagination?.total
              ? "No contacts on this page"
              : "No contacts found"}
          </h3>
          <p>
            {pagination?.total
              ? "Try going back to the previous page."
              : "Try changing your search or clearing the filters."}
          </p>
          {hasActiveFilters ? (
            <button
              className={styles.clearEmptyButton}
              type="button"
              onClick={onClearFilters}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}

      {result && result.items.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.contactsTable}>
            <thead>
              <tr>
                <th scope="col" className={styles.selectColumn}>
                  <span className={shared.visuallyHidden}>Select</span>
                </th>
                <th scope="col">Contact</th>
                <th scope="col">Company</th>
                <th scope="col">Phone</th>
                <th scope="col">Tags</th>
                <th scope="col">Updated</th>
                <th scope="col" className={styles.actionsColumn}>
                  <span className={shared.visuallyHidden}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((contact) => (
                <tr key={contact.id}>
                  <td className={`${styles.cell} ${styles.selectColumn}`} data-label="Select">
                    <input
                      type="checkbox"
                      aria-label={`Select ${contact.firstName} ${contact.lastName}`}
                      checked={selectedIds.includes(contact.id)}
                      disabled={selectionDisabled}
                      onChange={(event) =>
                        onToggleSelected(contact.id, event.target.checked)
                      }
                    />
                  </td>
                  <td
                    className={`${styles.cell} ${styles.contactCell}`}
                    data-label="Contact"
                  >
                    <div className={styles.contactIdentity}>
                      <span className={styles.avatar} aria-hidden="true">
                        {getInitials(contact.firstName, contact.lastName)}
                      </span>
                      <span className={styles.contactText}>
                        <span className={styles.contactName}>
                          {contact.firstName} {contact.lastName}
                        </span>
                        <span className={styles.contactEmail}>
                          {contact.email ?? "No email address"}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td
                    className={styles.cell}
                    data-label="Company"
                  >
                    {contact.company ?? (
                      <span className={styles.mutedValue}>—</span>
                    )}
                  </td>
                  <td
                    className={styles.cell}
                    data-label="Phone"
                  >
                    {contact.phone ?? (
                      <span className={styles.mutedValue}>—</span>
                    )}
                  </td>
                  <td
                    className={`${styles.cell} ${styles.tagsCell}`}
                    data-label="Tags"
                  >
                    {contact.tags.length ? (
                      <div className={styles.tagList}>
                        {contact.tags.map((contactTag) => (
                          <span
                            className={styles.tagChip}
                            key={contactTag.id}
                          >
                            {contactTag.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={styles.mutedValue}>No tags</span>
                    )}
                  </td>
                  <td
                    className={`${styles.cell} ${styles.updatedCell}`}
                    data-label="Updated"
                  >
                    {formatDate(contact.updatedAt)}
                  </td>
                  <td className={`${styles.cell} ${styles.actionsColumn}`} data-label="Actions">
                    <button
                      className={styles.editButton}
                      type="button"
                      onClick={() => onEdit(contact)}
                      aria-label={`Edit ${contact.firstName} ${contact.lastName}`}
                    >
                      <Pencil size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
