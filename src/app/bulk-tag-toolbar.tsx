import styles from "./bulk-tag-toolbar.module.css";
import type { FilterTag } from "./use-contact-directory";

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
      <strong>{selectedCount} selected</strong>
      <label>
        <span>Action</span>
        <select
          value={mode}
          onChange={(event) =>
            onModeChange(event.target.value === "replace" ? "replace" : "add")
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
                checked={selectedTagIds.includes(tag.id)}
                disabled={isApplying}
                onChange={(event) => onToggleTag(tag.id, event.target.checked)}
              />
              {tag.name}
            </label>
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        onClick={onApply}
        disabled={isApplying || (mode === "add" && !selectedTagIds.length)}
      >
        {isApplying ? "Applying…" : "Apply tags"}
      </button>
      <button type="button" onClick={onClearSelection} disabled={isApplying}>
        Clear
      </button>
    </div>
  );
}
