import { useCallback, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/error-schema";
import type { BulkTagMode } from "./bulk-tag-toolbar";
import type { ContactRow } from "./contacts-table";

/** Tag ids a contact should end up with; `null` when nothing would change. */
export function getBulkTagTarget(
  currentTagIds: string[],
  chosenTagIds: string[],
  mode: BulkTagMode,
): string[] | null {
  const tagIds =
    mode === "add"
      ? Array.from(new Set([...currentTagIds, ...chosenTagIds]))
      : chosenTagIds;
  const unchanged =
    tagIds.length === currentTagIds.length &&
    tagIds.every((tagId) => currentTagIds.includes(tagId));
  return unchanged ? null : tagIds;
}

type Options = {
  /** Rows on the current page; selection only refers to these. */
  items: ContactRow[] | undefined;
  onSuccess: (message: string) => void;
  /** Called once after a run that changed at least one contact. */
  onUpdated: () => void;
};

/**
 * Row selection plus sequential bulk tag writes. Each contact is updated
 * with its own expected version; on the first failure the run stops, the
 * failed and remaining contacts stay selected and the error reports
 * progress ("Updated X of Y").
 */
export function useBulkTagging({ items, onSuccess, onUpdated }: Options) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [mode, setMode] = useState<BulkTagMode>("add");
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const toggleSelected = useCallback((contactId: string, selected: boolean) => {
    setSelectedIds((current) =>
      selected
        ? [...current, contactId]
        : current.filter((id) => id !== contactId),
    );
  }, []);

  const toggleTag = useCallback((tagId: string, checked: boolean) => {
    setTagIds((current) =>
      checked
        ? [...current, tagId]
        : current.filter((currentTagId) => currentTagId !== tagId),
    );
  }, []);

  const deselectAll = useCallback(() => setSelectedIds([]), []);

  /** Clears rows and chosen tags, e.g. when the page or filters change. */
  const resetSelection = useCallback(() => {
    setSelectedIds([]);
    setTagIds([]);
  }, []);

  async function apply() {
    if (!selectedIds.length || isApplying || (mode === "add" && !tagIds.length)) {
      return;
    }
    if (
      mode === "replace" &&
      !tagIds.length &&
      !window.confirm(`Remove all tags from ${selectedIds.length} contacts?`)
    ) {
      return;
    }

    setError(null);
    setIsApplying(true);
    const total = selectedIds.length;
    let updated = 0;
    let completed = 0;
    let stoppedAt = "";
    try {
      for (const contactId of selectedIds) {
        const selectedContact = items?.find((item) => item.id === contactId);
        if (!selectedContact) {
          stoppedAt = "a contact no longer on this page";
          throw new Error("A selected contact is no longer on this page. Refresh and try again.");
        }
        stoppedAt = `${selectedContact.firstName} ${selectedContact.lastName}`;
        const nextTagIds = getBulkTagTarget(
          selectedContact.tags.map((tag) => tag.id),
          tagIds,
          mode,
        );
        if (!nextTagIds) {
          completed += 1;
          continue;
        }

        const response = await fetch(`/api/contacts/${contactId}/tags`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tagIds: nextTagIds,
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
      setTagIds([]);
      onSuccess(
        updated ? "Tags updated successfully." : "Tags are already up to date.",
      );
    } catch (applyError) {
      const message =
        applyError instanceof Error
          ? applyError.message
          : "Could not apply bulk tags.";
      setSelectedIds(selectedIds.slice(completed));
      setError(
        `Updated ${updated} of ${total}. Stopped at ${stoppedAt}: ${message}`,
      );
    } finally {
      if (updated > 0) onUpdated();
      setIsApplying(false);
    }
  }

  return {
    selectedIds,
    toggleSelected,
    deselectAll,
    resetSelection,
    tagIds,
    toggleTag,
    mode,
    setMode,
    error,
    isApplying,
    apply,
  };
}
