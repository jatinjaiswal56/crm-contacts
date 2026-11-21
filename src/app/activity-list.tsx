import type { ActivityItem } from "./use-contact-activity";
import styles from "./contacts-workspace.module.css";
import type { Tag } from "./tag-picker";

type Props = {
  activity: ActivityItem[];
  loading: boolean;
  error: string | null;
  tags: Tag[];
  onRetry: () => void;
};

function formatActivityDescription(item: ActivityItem, tags: Tag[]) {
  const metadata = item.metadata ?? {};

  if (item.type === "CONTACT_CREATED") return "Contact created";
  if (item.type === "CONTACT_UPDATED") {
    const changedFields = metadata.changedFields ?? metadata.fields;
    if (Array.isArray(changedFields)) {
      const fieldLabels: Record<string, string> = {
        firstName: "first name",
        lastName: "last name",
        email: "email",
        phone: "phone",
        company: "company",
      };
      const fields = changedFields.filter(
        (field): field is string => typeof field === "string",
      );
      if (fields.length) {
        return `Updated ${fields.map((field) => fieldLabels[field] ?? field).join(", ")}`;
      }
    }
    return "Contact updated";
  }

  const tagName =
    typeof metadata.tagName === "string"
      ? metadata.tagName
      : typeof metadata.tagId === "string"
        ? tags.find((tag) => tag.id === metadata.tagId)?.name
        : undefined;
  const action = item.type === "TAG_ADDED" ? "Added" : "Removed";
  return tagName ? `${action} tag ${tagName}` : `${action} a tag`;
}

export function ActivityList({
  activity,
  loading,
  error,
  tags,
  onRetry,
}: Props) {
  return (
    <section className={styles.activitySection} aria-label="Recent activity">
      <h3>Recent activity</h3>
      {loading ? (
        <p role="status">Loading activity…</p>
      ) : error ? (
        <p role="alert">
          Could not load activity: {error}{" "}
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </p>
      ) : activity.length ? (
        <ul aria-label="Recent contact activity" tabIndex={0}>
          {activity.map((item) => (
            <li key={item.id}>
              <strong>{formatActivityDescription(item, tags)}</strong>
              <span>{new Date(item.timestamp).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No activity recorded.</p>
      )}
    </section>
  );
}
