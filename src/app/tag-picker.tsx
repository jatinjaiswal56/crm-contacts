import styles from "./contacts-workspace.module.css";

export type Tag = {
  id: string;
  name: string;
  nameNormalized: string;
};

type Props = {
  tags: Tag[];
  selectedTagIds: string[];
  disabled: boolean;
  onChange: (tagId: string, checked: boolean) => void;
};

export function TagPicker({
  tags,
  selectedTagIds,
  disabled,
  onChange,
}: Props) {
  return (
    <fieldset className={styles.tagFieldset}>
      <legend>Tags (optional)</legend>
      <p className={styles.tagHelp}>
        Select or clear tags to update this contact.
      </p>
      <div className={styles.tagChoices}>
        {tags.map((tag) => (
          <label key={tag.id}>
            <input
              type="checkbox"
              checked={selectedTagIds.includes(tag.id)}
              disabled={disabled}
              onChange={(event) => onChange(tag.id, event.target.checked)}
            />
            {tag.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
