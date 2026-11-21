"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import styles from "./contacts-workspace.module.css";
import { ContactDialog, type EditableContact } from "./contact-dialog";
import { ContactsListHeader, ContactsPageHeader } from "./contacts-header";
import { ContactFilters, SortToolbar, sortOptions } from "./contact-filters";
import { ContactsTable, type ContactRow } from "./contacts-table";
import { PaginationBar } from "./pagination-bar";
import { BulkTagToolbar } from "./bulk-tag-toolbar";
import { Toast } from "./toast";
import { useToast } from "./use-toast";
import { useBulkTagging } from "./use-bulk-tagging";
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
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast, notify: notifyToast, dismiss: dismissToast } = useToast();
  const { result, tags, isLoading, isTagsLoading, error, tagsError } =
    useContactDirectory(queryString, refreshKey);
  const bulk = useBulkTagging({
    items: result?.items,
    onSuccess: (message) => notifyToast(message, "success"),
    onUpdated: () => setRefreshKey((value) => value + 1),
  });
  const { resetSelection } = bulk;

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
        resetSelection();
      }

      if (historyMode === "replace") {
        router.replace(href, { scroll: false });
      } else {
        router.push(href, { scroll: false });
      }
    },
    [pathname, queryString, resetSelection, router],
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
        <ContactsPageHeader
          total={pagination?.total}
          hasActiveFilters={hasActiveFilters}
          onCreate={openCreateDialog}
        />

        <section
          className={styles.panel}
          aria-labelledby="contacts-heading"
          aria-busy={isLoading}
        >
          <ContactsListHeader
            total={pagination?.total}
            isRefreshing={isLoading && Boolean(result)}
          />

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

          {bulk.selectedIds.length ? (
            <BulkTagToolbar
              selectedCount={bulk.selectedIds.length}
              tags={tags}
              mode={bulk.mode}
              onModeChange={bulk.setMode}
              selectedTagIds={bulk.tagIds}
              onToggleTag={bulk.toggleTag}
              isApplying={bulk.isApplying}
              onApply={bulk.apply}
              onClearSelection={bulk.deselectAll}
            />
          ) : null}

          {error || bulk.error ? (
            <div className={styles.errorBanner} role="alert">
              <strong>{bulk.error ? "Couldn’t update tags." : "Couldn’t load contacts."}</strong>{" "}
              {bulk.error ?? error}
              {error && result ? " Showing the last loaded results." : null}
            </div>
          ) : null}

          <ContactsTable
            result={result}
            isLoading={isLoading}
            hasActiveFilters={hasActiveFilters}
            selectedIds={bulk.selectedIds}
            selectionDisabled={bulk.isApplying}
            onToggleSelected={bulk.toggleSelected}
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
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
