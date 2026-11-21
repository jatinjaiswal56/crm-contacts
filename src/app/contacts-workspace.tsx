"use client";

import {
  LoaderCircle,
  Plus,
  UsersRound,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/error-schema";
import styles from "./contacts-workspace.module.css";
import { ContactDialog, type EditableContact } from "./contact-dialog";
import { ContactFilters, SortToolbar, sortOptions } from "./contact-filters";
import { ContactsTable, type ContactRow } from "./contacts-table";
import { PaginationBar } from "./pagination-bar";
import { useContactDirectory } from "./use-contact-directory";
import { useQueryDraft } from "./use-query-draft";

type QueryUpdate = Record<string, string | null>;

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

  const [searchText, setSearchText, markSearchPushed] =
    useQueryDraft(searchParam);
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
      markSearchPushed(nextSearch);
      updateSearchParams(
        { search: nextSearch || null, page: null },
        "replace",
      );
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [markSearchPushed, searchParam, searchText, updateSearchParams]);

  function applyFilters() {
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

  function openEditDialog(contact: ContactRow) {
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

  function toggleSelected(contactId: string, selected: boolean) {
    setSelectedIds((current) =>
      selected
        ? [...current, contactId]
        : current.filter((id) => id !== contactId),
    );
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
          throw new Error(
            getApiErrorMessage(payload, "Could not apply bulk tags."),
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

          <ContactFilters
            searchText={searchText}
            companyText={companyText}
            selectedTag={selectedTag}
            onSearchTextChange={setSearchText}
            onCompanyTextChange={setCompanyText}
            onSelectedTagChange={setSelectedTag}
            tags={tags}
            isTagsLoading={isTagsLoading}
            tagsError={tagsError}
            hasActiveFilters={hasActiveFilters}
            onApply={applyFilters}
            onClear={clearFilters}
          />

          <SortToolbar
            hasActiveFilters={hasActiveFilters}
            selectedSort={selectedSort}
            onSortChange={changeSort}
          />

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

          <ContactsTable
            result={result}
            isLoading={isLoading}
            hasActiveFilters={hasActiveFilters}
            selectedIds={selectedIds}
            selectionDisabled={isBulkTagging}
            onToggleSelected={toggleSelected}
            onEdit={openEditDialog}
            onClearFilters={clearFilters}
          />

          <PaginationBar
            pagination={pagination}
            page={page}
            isLoading={isLoading}
            onPageChange={(nextPage) => updateSearchParams({ page: nextPage })}
          />
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
