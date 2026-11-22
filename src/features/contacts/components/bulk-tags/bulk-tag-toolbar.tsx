import { Check, LoaderCircle, X } from "lucide-react";
import shared from "@/components/ui/shared.module.css";
import styles from "./bulk-tag-toolbar.module.css";
import type { FilterTag } from "@/features/contacts/hooks/use-contact-directory";

export type BulkTagMode = "add" | "replace";

type Props = {
  selectedCount: number;
  tags: FilterTag[];
  mode: BulkTagMode;
  onModeChange: (mode: BulkTagMode) => void;
  selectedTagIds: string[];
  onToggleTag: (tagId: string, checked: boolean) => void;
  isApplying: boolean;
  onApply: () => void;
  onClearSelection: () => void;
};

export function BulkTagToolbar({
  selectedCount,
  tags,
  mode,
  onModeChange,
  selectedTagIds,
  onToggleTag,
  isApplying,
  onApply,
  onClearSelection,
}: Props) {
  return (
    <div className={styles.bulkToolbar} aria-label="Bulk tag actions">
      <span className={styles.selectedCount} aria-live="polite">
        <span className={styles.countBadge}>{selectedCount}</span>
        selected
      </span>

      <span className={styles.divider} aria-hidden="true" />

      <label className={styles.modeControl}>
        <span className={shared.visuallyHidden}>Action</span>
        <select
          value={mode}
          disabled={isApplying}
          onChange={(event) =>
            onModeChange(event.target.value === "replace" ? "replace" : "add")
          }
        >
          <option value="add">Add tags</option>
          <option value="replace">Replace tags</option>
        </select>
      </label>

      <fieldset className={styles.tagFieldset}>
        <legend className={shared.visuallyHidden}>Tags</legend>
        {tags.map((tag) => (
          <label key={tag.id} className={styles.tagChip}>
            <input
              type="checkbox"
              checked={selectedTagIds.includes(tag.id)}
              disabled={isApplying}
              onChange={(event) => onToggleTag(tag.id, event.target.checked)}
            />
            <Check className={styles.chipCheck} size={13} aria-hidden="true" />
            {tag.name}
          </label>
        ))}
      </fieldset>

      <div className={styles.actions}>
        <button
          className={styles.clearButton}
          type="button"
          onClick={onClearSelection}
          disabled={isApplying}
        >
          <X size={14} aria-hidden="true" />
          Clear
        </button>
        <button
          className={styles.applyButton}
          type="button"
          onClick={onApply}
          disabled={isApplying || (mode === "add" && !selectedTagIds.length)}
        >
          {isApplying ? (
            <LoaderCircle className={shared.spinning} size={14} aria-hidden="true" />
          ) : null}
          {isApplying ? "Applying…" : "Apply tags"}
        </button>
      </div>
    </div>
  );
}
