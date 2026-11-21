"use client";

import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Tag,
  UsersRound,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import styles from "./contacts-workspace.module.css";
import { ContactDialog, type EditableContact } from "./contact-dialog";
import {
  useContactDirectory,
  type ContactListResponse,
} from "./use-contact-directory";

const sortOptions = [
  { value: "name:asc", label: "Name: A to Z", sort: "name", order: "asc" },
  { value: "name:desc", label: "Name: Z to A", sort: "name", order: "desc" },
  {
    value: "createdAt:desc",
    label: "Recently added",
    sort: "createdAt",
    order: "desc",
  },
  {
    value: "createdAt:asc",
    label: "Oldest added",
    sort: "createdAt",
    order: "asc",
  },
] as const;

type QueryUpdate = Record<string, string | null>;

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

function useQueryDraft(queryValue: string) {
  const [draft, setDraft] = useState({ queryValue, value: queryValue });
  const value = draft.queryValue === queryValue ? draft.value : queryValue;

  return [
    value,
    (nextValue: string) => setDraft({ queryValue, value: nextValue }),
  ] as const;
}

export function ContactsWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const searchParam = searchParams.get("search") ?? "";
  const companyParam = searchParams.get("company") ?? "";
  const tagParam = searchParams.get("tag") ?? "";
  const pageParam = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const currentSort = searchParams.get("sort") === "createdAt" ? "createdAt" : "name";
  const currentOrder = searchParams.get("order") === "desc" ? "desc" : "asc";
  const selectedSort =
    sortOptions.find(
      (option) =>
        option.sort === currentSort && option.order === currentOrder,
    )?.value ?? "name:asc";

  const [searchText, setSearchText] = useQueryDraft(searchParam);
  const [companyText, setCompanyText] = useQueryDraft(companyParam);
  const [selectedTag, setSelectedTag] = useQueryDraft(tagParam);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContact, setDialogContact] = useState<EditableContact | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<"add" | "replace">("add");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isBulkTagging, setIsBulkTagging] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const toastId = useRef(0);
  const { result, tags, isLoading, isTagsLoading, error, tagsError } =
    useContactDirectory(queryString, refreshKey);

  const notifyToast = useCallback(
    (message: string, tone: "error" | "success") => {
      toastId.current += 1;
      setToast({ id: toastId.current, message, tone });
    },
    [],
  );

  const notifyError = useCallback(
    (message: string) => notifyToast(message, "error"),
    [notifyToast],
  );

  const notifySaved = useCallback(
    (message: string) => {
      setRefreshKey((value) => value + 1);
      notifyToast(message, "success");
    },
    [notifyToast],
  );

  useEffect(() => {
    if (!toast || toast.tone !== "success") return;
    const timeout = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const updateSearchParams = useCallback(
    (
      updates: QueryUpdate,
      historyMode: "push" | "replace" = "push",
    ) => {
      const nextParams = new URLSearchParams(queryString);

      for (const [key, value] of Object.entries(updates)) {
        if (value) nextParams.set(key, value);
        else nextParams.delete(key);
      }

      const nextQuery = nextParams.toString();
      const href = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      if (nextQuery !== queryString) {
        setSelectedIds([]);
        setBulkTagIds([]);
      }

      if (historyMode === "replace") {
        router.replace(href, { scroll: false });
      } else {
        router.push(href, { scroll: false });
      }
    },
    [pathname, queryString, router],
  );

  useEffect(() => {
    const nextSearch = searchText.trim();
    if (nextSearch === searchParam) return;

    const timeout = window.setTimeout(() => {
      updateSearchParams(
        { search: nextSearch || null, page: null },
        "replace",
      );
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchParam, searchText, updateSearchParams]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSearchParams({
      search: searchText.trim() || null,
      company: companyText.trim() || null,
      tag: selectedTag || null,
      page: null,
    });
  }

  function clearFilters() {
    setSearchText("");
    setCompanyText("");
    setSelectedTag("");
    updateSearchParams({
      search: null,
      company: null,
      tag: null,
      page: null,
    });
  }

  function changeSort(value: string) {
    const option = sortOptions.find((item) => item.value === value);
    if (!option) return;

    updateSearchParams({
      sort: option.sort,
      order: option.order,
      page: null,
    });
  }

  function openCreateDialog() {
    setDialogContact(null);
    setDialogOpen(true);
  }

  function openEditDialog(contact: ContactListResponse["items"][number]) {
    setDialogContact({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      company: contact.company,
      version: contact.version,
      tags: contact.tags,
    });
    setDialogOpen(true);
  }

  async function applyBulkTags() {
    if (
      !selectedIds.length ||
      isBulkTagging ||
      (bulkMode === "add" && !bulkTagIds.length)
    ) {
      return;
    }
    if (
      bulkMode === "replace" &&
      !bulkTagIds.length &&
      !window.confirm(`Remove all tags from ${selectedIds.length} contacts?`)
    ) {
      return;
    }

    setBulkError(null);
    setIsBulkTagging(true);
    const total = selectedIds.length;
    let updated = 0;
    let completed = 0;
    let stoppedAt = "";
    try {
      for (const contactId of selectedIds) {
        const selectedContact = result?.items.find((item) => item.id === contactId);
        if (!selectedContact) {
          stoppedAt = "a contact no longer on this page";
          throw new Error("A selected contact is no longer on this page. Refresh and try again.");
        }
        stoppedAt = `${selectedContact.firstName} ${selectedContact.lastName}`;
        const tagIds =
          bulkMode === "add"
            ? Array.from(
                new Set([
                  ...selectedContact.tags.map((tag) => tag.id),
                  ...bulkTagIds,
                ]),
              )
            : bulkTagIds;
        const currentTagIds = selectedContact.tags.map((tag) => tag.id);
        if (
          tagIds.length === currentTagIds.length &&
          tagIds.every((tagId) => currentTagIds.includes(tagId))
        ) {
          completed += 1;
          continue;
        }

        const response = await fetch(`/api/contacts/${contactId}/tags`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tagIds,
            expectedVersion: selectedContact.version,
          }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const parsed = z
            .object({ error: z.object({ message: z.string() }) })
            .safeParse(payload);
          throw new Error(
            parsed.success
              ? parsed.data.error.message
              : "Could not apply bulk tags.",
          );
        }
        updated += 1;
        completed += 1;
      }
      setSelectedIds([]);
      setBulkTagIds([]);
      notifyToast(
        updated ? "Tags updated successfully." : "Tags are already up to date.",
        "success",
      );
    } catch (bulkError) {
      const message =
        bulkError instanceof Error
          ? bulkError.message
          : "Could not apply bulk tags.";
      setSelectedIds(selectedIds.slice(completed));
      setBulkError(
        `Updated ${updated} of ${total}. Stopped at ${stoppedAt}: ${message}`,
      );
    } finally {
      if (updated > 0) setRefreshKey((value) => value + 1);
      setIsBulkTagging(false);
    }
  }

  const hasActiveFilters = Boolean(searchParam || companyParam || tagParam);
  const pagination = result?.pagination;
  const start = pagination?.total
    ? (pagination.page - 1) * pagination.pageSize + 1
    : 0;
  const end = pagination
    ? Math.min(pagination.page * pagination.pageSize, pagination.total)
    : 0;
  const canGoBack = page > 1;
  const canGoForward = Boolean(
    pagination && page < pagination.totalPages,
  );

  return (
    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <div className={styles.brandLockup}>
          <div className={styles.brandMark} aria-hidden="true">
            C
          </div>
          <span>
            CRM <span className={styles.brandDivider}>/</span> Contacts
          </span>
        </div>
      </header>

      <main>
        <section className={styles.pageHeader} aria-labelledby="page-title">
          <div>
            <p className={styles.eyebrow}>CONTACT MANAGEMENT</p>
            <h1 id="page-title">Contacts</h1>
            <p className={styles.pageDescription}>
              Search, filter, and browse the people in your workspace.
            </p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.totalCard} aria-live="polite">
              <span className={styles.totalIcon} aria-hidden="true">
                <UsersRound size={19} />
              </span>
              <span className={styles.totalValue}>
                {pagination ? pagination.total : "—"}
              </span>
              <span className={styles.totalLabel}>
                {hasActiveFilters ? "matching contacts" : "total contacts"}
              </span>
            </div>
            <button className={styles.createButton} type="button" onClick={openCreateDialog}>
              <Plus size={16} />
              New contact
            </button>
          </div>
        </section>

        <section
          className={styles.panel}
          aria-labelledby="contacts-heading"
          aria-busy={isLoading}
        >
          <div className={styles.panelHeader}>
            <div>
              <h2 id="contacts-heading">All contacts</h2>
              <p>Browse contact details, companies, and tags.</p>
            </div>
            <div className={styles.matchCount} aria-live="polite">
              {isLoading && result ? (
                <>
                  <LoaderCircle
                    className={styles.spinning}
                    size={15}
                    aria-hidden="true"
                  />
                  Updating…
                </>
              ) : pagination ? (
                `${pagination.total} ${pagination.total === 1 ? "match" : "matches"}`
              ) : (
                "Loading…"
              )}
            </div>
          </div>

          <form className={styles.filters} onSubmit={applyFilters}>
            <label className={styles.searchField}>
              <Search size={18} aria-hidden="true" />
              <span className={styles.visuallyHidden}>Search contacts</span>
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search names, emails, or companies"
                autoComplete="off"
              />
            </label>

            <label className={styles.filterField}>
              <span className={styles.filterLabel}>
                <Building2 size={15} aria-hidden="true" />
                Company
              </span>
              <input
                type="text"
                value={companyText}
                onChange={(event) => setCompanyText(event.target.value)}
                placeholder="Any company"
              />
            </label>

            <label className={styles.filterField}>
              <span className={styles.filterLabel}>
                <Tag size={15} aria-hidden="true" />
                Tag
              </span>
              <select
                value={selectedTag}
                onChange={(event) => setSelectedTag(event.target.value)}
                aria-label="Filter by tag"
              >
                <option value="">
                  {isTagsLoading ? "Loading tags…" : "All tags"}
                </option>
                {selectedTag &&
                !tags.some((tag) => tag.nameNormalized === selectedTag) ? (
                  <option value={selectedTag}>{selectedTag}</option>
                ) : null}
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.nameNormalized}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>

            <button className={styles.applyButton} type="submit">
              <Filter size={16} aria-hidden="true" />
              Apply filters
            </button>
            {hasActiveFilters ? (
              <button
                className={styles.clearButton}
                type="button"
                onClick={clearFilters}
              >
                <X size={15} aria-hidden="true" />
                Clear
              </button>
            ) : null}
          </form>

          {tagsError ? (
            <p className={styles.inlineError} role="alert">
              Tag filters are unavailable: {tagsError}
            </p>
          ) : null}

          <div className={styles.tableToolbar}>
            <p className={styles.tableHint}>
              {hasActiveFilters ? "Filtered results" : "Your contact directory"}
            </p>
            <label className={styles.sortControl}>
              <span>Sort by</span>
              <select
                value={selectedSort}
                onChange={(event) => changeSort(event.target.value)}
                aria-label="Sort contacts"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedIds.length ? (
            <div className={styles.bulkToolbar} aria-label="Bulk tag actions">
              <strong>{selectedIds.length} selected</strong>
              <label>
                <span>Action</span>
                <select
                  value={bulkMode}
                  onChange={(event) =>
                    setBulkMode(
                      event.target.value === "replace" ? "replace" : "add",
                    )
                  }
                >
                  <option value="add">Add tags</option>
                  <option value="replace">Replace tags</option>
                </select>
              </label>
              <fieldset className={styles.bulkTagFieldset}>
                <legend>Tags</legend>
                <div className={styles.bulkTagChoices}>
                  {tags.map((tag) => (
                    <label key={tag.id}>
                      <input
                        type="checkbox"
                        checked={bulkTagIds.includes(tag.id)}
                        disabled={isBulkTagging}
                        onChange={(event) =>
                          setBulkTagIds((current) =>
                            event.target.checked
                              ? [...current, tag.id]
                              : current.filter((tagId) => tagId !== tag.id),
                          )
                        }
                      />
                      {tag.name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="button"
                onClick={applyBulkTags}
                disabled={
                  isBulkTagging || (bulkMode === "add" && !bulkTagIds.length)
                }
              >
                {isBulkTagging ? "Applying…" : "Apply tags"}
              </button>
              <button type="button" onClick={() => setSelectedIds([])} disabled={isBulkTagging}>Clear</button>
            </div>
          ) : null}

          {error || bulkError ? (
            <div className={styles.errorBanner} role="alert">
              <strong>{bulkError ? "Couldn’t update tags." : "Couldn’t load contacts."}</strong>{" "}
              {bulkError ?? error}
              {error && result ? " Showing the last loaded results." : null}
            </div>
          ) : null}

          {isLoading && !result ? (
            <div
              className={styles.loadingState}
              role="status"
              aria-label="Loading contacts"
            >
              <LoaderCircle
                className={styles.spinning}
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
                  onClick={clearFilters}
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
                      <span className={styles.visuallyHidden}>Select</span>
                    </th>
                    <th scope="col">Contact</th>
                    <th scope="col">Company</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Tags</th>
                    <th scope="col">Updated</th>
                    <th scope="col" className={styles.actionsColumn}>
                      <span className={styles.visuallyHidden}>Actions</span>
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
                          disabled={isBulkTagging}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? [...current, contact.id]
                                : current.filter((id) => id !== contact.id),
                            )
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
                          onClick={() => openEditDialog(contact)}
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

          <footer className={styles.pagination}>
            <p className={styles.paginationText}>
              {pagination
                ? `Showing ${start}–${end} of ${pagination.total} contacts`
                : "Waiting for contacts"}
            </p>
            <div className={styles.paginationControls}>
              <span className={styles.pageIndicator}>
                {pagination?.totalPages
                  ? `Page ${page} of ${pagination.totalPages}`
                  : "Page —"}
              </span>
              <button
                className={styles.pageButton}
                type="button"
                aria-label="Previous page"
                disabled={!canGoBack || isLoading}
                onClick={() =>
                  updateSearchParams({
                    page: page > 2 ? String(page - 1) : null,
                  })
                }
              >
                <ChevronLeft size={17} aria-hidden="true" />
              </button>
              <button
                className={styles.pageButton}
                type="button"
                aria-label="Next page"
                disabled={!canGoForward || isLoading}
                onClick={() =>
                  updateSearchParams({ page: String(page + 1) })
                }
              >
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </div>
          </footer>
        </section>
      </main>
      <ContactDialog
        key={`${dialogContact?.id ?? "new"}-${dialogOpen}`}
        open={dialogOpen}
        contact={dialogContact}
        tags={tags}
        onClose={() => setDialogOpen(false)}
        onError={notifyError}
        onSaved={notifySaved}
      />
      {toast ? (
        <div
          className={`${styles.toast} ${
            toast.tone === "error" ? styles.toastError : styles.toastSuccess
          }`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
