import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { FormikHelpers } from "formik";
import type { ContactWriteFields } from "@/lib/contacts/validation";
import type { ContactConflict } from "@/features/contacts/components/dialog/conflict-panel";
import {
  getIndianPhoneDigits,
  toFormValues,
  type EditableContact,
} from "@/features/contacts/utils/contact-form-values";
import {
  saveContactFields,
  saveContactTags,
  type RequestFailure,
} from "@/features/contacts/requests/contact-requests";

type Options = {
  baseContact: EditableContact | null;
  selectedTagIds: string[];
  tagsDirty: boolean;
  setBaseContact: Dispatch<SetStateAction<EditableContact | null>>;
  setConflict: Dispatch<SetStateAction<ContactConflict | null>>;
  beginActivityLoading: () => void;
  onClose: () => void;
  onError: (message: string) => void;
  onSaved: (message: string) => void;
};

/**
 * Builds the Formik submit handler: saves changed contact fields first,
 * then the tag set against the version that save returned. A version
 * conflict from either request opens the conflict panel instead of closing.
 */
export function useContactSubmit({
  baseContact,
  selectedTagIds,
  tagsDirty,
  setBaseContact,
  setConflict,
  beginActivityLoading,
  onClose,
  onError,
  onSaved,
}: Options) {
  const reportFailure = useCallback(
    (failure: RequestFailure) => {
      if (failure.status === "conflict") {
        setConflict(failure.conflict);
        onError(failure.conflict.message);
        return;
      }
      onError(failure.message);
    },
    [onError, setConflict],
  );

  return useCallback(
    async (
      values: ContactWriteFields,
      helpers: FormikHelpers<ContactWriteFields>,
    ) => {
      const editingExisting = Boolean(baseContact?.id);
      try {
        const contactFieldsChanged =
          !baseContact?.id ||
          values.firstName !== baseContact.firstName ||
          values.lastName !== baseContact.lastName ||
          values.email !== (baseContact.email ?? "") ||
          values.phone !== getIndianPhoneDigits(baseContact.phone ?? null) ||
          values.company !== (baseContact.company ?? "");

        let savedId = baseContact?.id;
        let savedVersion = baseContact?.version ?? 1;
        if (contactFieldsChanged) {
          const result = await saveContactFields({
            contactId: baseContact?.id,
            expectedVersion: baseContact?.version ?? 1,
            values,
          });
          if (result.status !== "ok") {
            reportFailure(result);
            return;
          }

          savedId = result.data.id;
          savedVersion = result.data.version;
          const nextBaseContact: EditableContact = {
            ...result.data,
            tags: baseContact?.tags ?? [],
          };
          if (!baseContact?.id) {
            beginActivityLoading();
          }
          setBaseContact(nextBaseContact);
          helpers.resetForm({ values: toFormValues(nextBaseContact) });
        }

        if (!savedId) {
          throw new Error("The contacts service returned an invalid response.");
        }

        const shouldSaveTags =
          tagsDirty || (!baseContact?.id && selectedTagIds.length > 0);
        if (shouldSaveTags) {
          const result = await saveContactTags({
            contactId: savedId,
            expectedVersion: savedVersion,
            tagIds: selectedTagIds,
          });
          if (result.status !== "ok") {
            reportFailure(result);
            return;
          }
        }

        onSaved(
          editingExisting
            ? "Contact updated successfully."
            : "Contact saved successfully.",
        );
        onClose();
      } catch (saveError) {
        onError(
          saveError instanceof Error
            ? saveError.message
            : "Could not save contact.",
        );
      } finally {
        helpers.setSubmitting(false);
      }
    },
    [
      baseContact,
      beginActivityLoading,
      onClose,
      onError,
      onSaved,
      reportFailure,
      selectedTagIds,
      setBaseContact,
      tagsDirty,
    ],
  );
}
