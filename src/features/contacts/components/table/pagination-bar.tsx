import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./pagination-bar.module.css";
import type { ContactListResponse } from "@/features/contacts/hooks/use-contact-directory";

type Props = {
  pagination: ContactListResponse["pagination"] | undefined;
  page: number;
  isLoading: boolean;
  /** `null` means the first page (the `page` param is dropped from the URL). */
  onPageChange: (page: string | null) => void;
};

export function PaginationBar({
  pagination,
  page,
  isLoading,
  onPageChange,
}: Props) {
  const start = pagination?.total
    ? (pagination.page - 1) * pagination.pageSize + 1
    : 0;
  const end = pagination
    ? Math.min(pagination.page * pagination.pageSize, pagination.total)
    : 0;
  const canGoBack = page > 1;
  const canGoForward = Boolean(pagination && page < pagination.totalPages);

  return (
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
          onClick={() => onPageChange(page > 2 ? String(page - 1) : null)}
        >
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <button
          className={styles.pageButton}
          type="button"
          aria-label="Next page"
          disabled={!canGoForward || isLoading}
          onClick={() => onPageChange(String(page + 1))}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
    </footer>
  );
}
