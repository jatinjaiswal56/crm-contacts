"use client";

import { useFormik, type FormikHelpers } from "formik";
import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { LoaderCircle, X } from "lucide-react";
import {
  mergeContactDraft,
  mergeContactTagDraft,
} from "@/lib/contacts/conflict-merge";
import { zodToFormikErrors } from "@/lib/forms/zod-formik";
import {
  contactWriteFieldsSchema,
  type ContactWriteFields,
} from "@/lib/contacts/validation";
import styles from "./contacts-workspace.module.css";
import { ContactFields } from "./contact-fields";
import { useFocusTrap } from "./use-focus-trap";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";
import { useContactActivity } from "./use-contact-activity";
import { ActivityList } from "./activity-list";
import { ConflictPanel, type ContactConflict } from "./conflict-panel";
import { TagPicker, type Tag } from "./tag-picker";
import { getIndianPhoneDigits, toFormValues } from "./contact-form-values";
import {
  saveContactFields,
  saveContactTags,
  type RequestFailure,
} from "./contact-requests";

export type EditableContact = {
  id?: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  version?: number;
  tags: { id: string; name: string }[];
};

type Props = {
  contact: EditableContact | null;
  tags: Tag[];
  open: boolean;
  onClose: () => void;
  onError: (message: string) => void;
  onSaved: (message: string) => void;
};

export function ContactDialog({
  contact,
  tags,
  open,
  onClose,
  onError,
  onSaved,
}: Props) {
  const [baseContact, setBaseContact] = useState(contact);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    () => contact?.tags.map((tag) => tag.id) ?? [],
  );
  const initialTagIds = baseContact?.tags.map((tag) => tag.id) ?? [];
  const tagsDirty =
    initialTagIds.length !== selectedTagIds.length ||
    initialTagIds.some((tagId) => !selectedTagIds.includes(tagId));
  const [conflict, setConflict] = useState<ContactConflict | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useFocusTrap(open, dialogRef);
  const {
    activity,
    loading: activityLoading,
    error: activityError,
    beginLoading: beginActivityLoading,
    retry: retryActivity,
  } = useContactActivity({
    open,
    contactId: baseContact?.id,
    onError,
  });

  const reportFailure = useCallback(
    (failure: RequestFailure) => {
      if (failure.status === "conflict") {
        setConflict(failure.conflict);
        onError(failure.conflict.message);
        return;
      }
      onError(failure.message);
    },
    [onError],
  );

  const submitContact = useCallback(
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
      tagsDirty,
    ],
  );

  const formik = useFormik<ContactWriteFields>({
    initialValues: toFormValues(baseContact),
    enableReinitialize: true,
    validateOnMount: true,
    validateOnBlur: true,
    validateOnChange: true,
    validate: (values) => zodToFormikErrors(contactWriteFieldsSchema, values),
    onSubmit: submitContact,
  });
  const saving = formik.isSubmitting;
  const hasUnsavedChanges = formik.dirty || tagsDirty;
  const validationErrorCount = Object.values(formik.errors).filter(Boolean).length;

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = contactWriteFieldsSchema.safeParse(formik.values);
    const firstInvalidField = parsed.success
      ? undefined
      : parsed.error.issues[0]?.path[0];

    void formik.submitForm();
    if (typeof firstInvalidField === "string") {
      formRef.current
        ?.querySelector<HTMLInputElement>(`[name="${firstInvalidField}"]`)
        ?.focus();
    }
  }

  const requestClose = useUnsavedChangesGuard({
    open,
    hasUnsavedChanges,
    saving,
    onClose,
  });

  function acceptLatestConflict() {
    if (!conflict) return;
    setBaseContact(conflict.latest);
    setSelectedTagIds(conflict.latest.tags.map((tag) => tag.id));
    formik.resetForm({ values: toFormValues(conflict.latest) });
    setConflict(null);
  }

  function keepDraftChangesOnLatest() {
    if (!conflict || !baseContact) return;
    const latestValues = toFormValues(conflict.latest);
    const mergedValues = mergeContactDraft(
      toFormValues(baseContact),
      formik.values,
      latestValues,
    );
    const mergedTagIds = mergeContactTagDraft({
      base: baseContact.tags.map((tag) => tag.id),
      draft: selectedTagIds,
      latest: conflict.latest.tags.map((tag) => tag.id),
    });

    setBaseContact(conflict.latest);
    setSelectedTagIds(mergedTagIds);
    formik.resetForm({ values: latestValues });
    void formik.setValues(mergedValues);
    setConflict(null);
  }

  if (!open) return null;

  return (
    <div
      className={styles.dialogBackdrop}
      role="presentation"
      onMouseDown={() => {
        if (!saving) requestClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !saving) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-dialog-title"
        aria-describedby={conflict ? "contact-conflict-message" : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.dialogHeader}>
          <div>
            <p className={styles.dialogEyebrow}>
              {baseContact?.id
                ? `Version ${baseContact.version ?? 1}`
                : "New record"}
            </p>
            <h2 id="contact-dialog-title">
              {baseContact?.id ? "Edit contact" : "Create contact"}
            </h2>
          </div>
          <button className={styles.dialogClose} type="button" onClick={requestClose} disabled={saving} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form
          ref={formRef}
          className={styles.dialogForm}
          onSubmit={handleFormSubmit}
          aria-busy={saving}
          noValidate
        >
          <ContactFields formik={formik} disabled={saving} />

          {formik.submitCount > 0 && validationErrorCount > 0 ? (
            <p className={styles.validationSummary} role="alert">
              Fix {validationErrorCount}{" "}
              {validationErrorCount === 1 ? "field" : "fields"} to save.
            </p>
          ) : null}

          <TagPicker
            tags={tags}
            selectedTagIds={selectedTagIds}
            disabled={saving}
            onChange={(tagId, checked) =>
              setSelectedTagIds((current) =>
                checked
                  ? [...current, tagId]
                  : current.filter((currentTagId) => currentTagId !== tagId),
              )
            }
          />

          {conflict ? (
            <ConflictPanel
              conflict={conflict}
              draft={formik.values}
              tags={tags}
              selectedTagIds={selectedTagIds}
              onUseLatest={acceptLatestConflict}
              onMergeDraft={keepDraftChangesOnLatest}
            />
          ) : null}

          {baseContact?.id ? (
            <ActivityList
              activity={activity}
              loading={activityLoading}
              error={activityError}
              tags={tags}
              onRetry={retryActivity}
            />
          ) : null}

          <div className={styles.dialogActions}>
            <button type="button" onClick={requestClose} disabled={saving}>Cancel</button>
            <button
              className={styles.dialogPrimary}
              type="submit"
              disabled={
                (!formik.dirty && !tagsDirty) || saving
              }
            >
              {saving ? <LoaderCircle className={styles.spinning} size={15} /> : null}
              {saving ? "Saving…" : "Save contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
