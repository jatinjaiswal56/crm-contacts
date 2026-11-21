import { LoaderCircle, Plus, UsersRound } from "lucide-react";
import styles from "./contacts-workspace.module.css";

type PageHeaderProps = {
  total: number | undefined;
  hasActiveFilters: boolean;
  onCreate: () => void;
};

export function ContactsPageHeader({
  total,
  hasActiveFilters,
  onCreate,
}: PageHeaderProps) {
  return (
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
          <span className={styles.totalValue}>{total ?? "—"}</span>
          <span className={styles.totalLabel}>
            {hasActiveFilters ? "matching contacts" : "total contacts"}
          </span>
        </div>
        <button className={styles.createButton} type="button" onClick={onCreate}>
          <Plus size={16} />
          New contact
        </button>
      </div>
    </section>
  );
}

type ListHeaderProps = {
  total: number | undefined;
  /** True while a refetch runs with previous results still on screen. */
  isRefreshing: boolean;
};

export function ContactsListHeader({ total, isRefreshing }: ListHeaderProps) {
  return (
    <div className={styles.panelHeader}>
      <div>
        <h2 id="contacts-heading">All contacts</h2>
        <p>Browse contact details, companies, and tags.</p>
      </div>
      <div className={styles.matchCount} aria-live="polite">
        {isRefreshing ? (
          <>
            <LoaderCircle
              className={styles.spinning}
              size={15}
              aria-hidden="true"
            />
            Updating…
          </>
        ) : total !== undefined ? (
          `${total} ${total === 1 ? "match" : "matches"}`
        ) : (
          "Loading…"
        )}
      </div>
    </div>
  );
}
