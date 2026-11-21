import { Building2, Filter, Search, Tag, X } from "lucide-react";
import type { FormEvent } from "react";
import styles from "./contact-filters.module.css";
import shared from "./shared.module.css";
import type { FilterTag } from "./use-contact-directory";

export const sortOptions = [
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

type ContactFiltersProps = {
  searchText: string;
  companyText: string;
  selectedTag: string;
  onSearchTextChange: (value: string) => void;
  onCompanyTextChange: (value: string) => void;
  onSelectedTagChange: (value: string) => void;
  tags: FilterTag[];
  isTagsLoading: boolean;
  tagsError: string | null;
  hasActiveFilters: boolean;
  onApply: () => void;
  onClear: () => void;
};

export function ContactFilters({
  searchText,
  companyText,
  selectedTag,
  onSearchTextChange,
  onCompanyTextChange,
  onSelectedTagChange,
  tags,
  isTagsLoading,
  tagsError,
  hasActiveFilters,
  onApply,
  onClear,
}: ContactFiltersProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply();
  }

  return (
    <>
      <form className={styles.filters} onSubmit={handleSubmit}>
        <label className={styles.searchField}>
          <Search size={18} aria-hidden="true" />
          <span className={shared.visuallyHidden}>Search contacts</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
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
            onChange={(event) => onCompanyTextChange(event.target.value)}
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
            onChange={(event) => onSelectedTagChange(event.target.value)}
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
            onClick={onClear}
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
    </>
  );
}

type SortToolbarProps = {
  hasActiveFilters: boolean;
  selectedSort: string;
  onSortChange: (value: string) => void;
};

export function SortToolbar({
  hasActiveFilters,
  selectedSort,
  onSortChange,
}: SortToolbarProps) {
  return (
    <div className={styles.tableToolbar}>
      <p className={styles.tableHint}>
        {hasActiveFilters ? "Filtered results" : "Your contact directory"}
      </p>
      <label className={styles.sortControl}>
        <span>Sort by</span>
        <select
          value={selectedSort}
          onChange={(event) => onSortChange(event.target.value)}
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
  );
}
