"use client";

import { useFormik, type FormikErrors, type FormikHelpers } from "formik";
import {
  useCallback,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { LoaderCircle, X } from "lucide-react";
import { z } from "zod";
import {
  mergeContactDraft,
  mergeContactTagDraft,
} from "@/lib/contacts/conflict-merge";
import { getApiErrorMessage } from "@/lib/api/error-schema";
import {
  contactWriteFieldsSchema,
  type ContactWriteFields,
} from "@/lib/contacts/validation";
import styles from "./contacts-workspace.module.css";
import { FormField } from "./form-field";
import { useFocusTrap } from "./use-focus-trap";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";
import { useContactActivity } from "./use-contact-activity";
import { ActivityList } from "./activity-list";
import { ConflictPanel, type ContactConflict } from "./conflict-panel";
import { TagPicker, type Tag } from "./tag-picker";

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

const mutationItemSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  version: z.number(),
});

const conflictPayloadSchema = z.object({
  error: z.object({
    code: z.literal("VERSION_CONFLICT"),
    message: z.string(),
  }),
  latest: mutationItemSchema.extend({
    tags: z.array(z.object({ id: z.string(), name: z.string() })),
  }),
});

function getIndianPhoneDigits(value: string | null) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");

  if (digits.length === 10) return digits;
  if (value.trim().startsWith("+91") && digits.length === 12) {
    return digits.slice(2);
  }
  return "";
}

function toFormValues(contact: EditableContact | null): ContactWriteFields {
  return {
    firstName: contact?.firstName ?? "",
    lastName: contact?.lastName ?? "",
    email: contact?.email ?? "",
    phone: getIndianPhoneDigits(contact?.phone ?? null),
    company: contact?.company ?? "",
  };
}

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
          const body = {
            ...values,
            ...(baseContact?.id ? { expectedVersion: baseContact.version ?? 1 } : {}),
          };
          const response = await fetch(
            baseContact?.id ? `/api/contacts/${baseContact.id}` : "/api/contacts",
            {
              method: baseContact?.id ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
          );
          const payload: unknown = await response.json().catch(() => null);
          if (!response.ok) {
            const parsedConflict = conflictPayloadSchema.safeParse(payload);
            if (
              parsedConflict.success &&
              parsedConflict.data.error.code === "VERSION_CONFLICT"
            ) {
              const { latest, error } = parsedConflict.data;
              setConflict({ latest, message: error.message });
              onError(error.message);
              return;
            }
            const message = getApiErrorMessage(
              payload,
              "Could not save contact.",
            );
            onError(message);
            return;
          }

          const savedContact = mutationItemSchema.safeParse(
            (payload as { item?: unknown } | null)?.item,
          );
          if (!savedContact.success) {
            throw new Error("The contacts service returned an invalid response.");
          }
          savedId = savedContact.data.id;
          savedVersion = savedContact.data.version;
          const nextBaseContact: EditableContact = {
            ...savedContact.data,
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
          const tagResponse = await fetch(`/api/contacts/${savedId}/tags`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tagIds: selectedTagIds,
              expectedVersion: savedVersion,
            }),
          });
          const tagPayload: unknown = await tagResponse.json().catch(() => null);
          if (!tagResponse.ok) {
            const parsedConflict = conflictPayloadSchema.safeParse(tagPayload);
            if (
              parsedConflict.success &&
              parsedConflict.data.error.code === "VERSION_CONFLICT"
            ) {
              const { latest, error } = parsedConflict.data;
              setConflict({ latest, message: error.message });
              onError(error.message);
              return;
            }
            throw new Error(
              getApiErrorMessage(tagPayload, "Could not save tags."),
            );
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
    validate(values) {
      const parsed = contactWriteFieldsSchema.safeParse(values);
      if (parsed.success) return {};

      const fieldErrors: FormikErrors<ContactWriteFields> = {};
      for (const issue of parsed.error.issues) {
        switch (issue.path[0]) {
          case "firstName":
            fieldErrors.firstName ??= issue.message;
            break;
          case "lastName":
            fieldErrors.lastName ??= issue.message;
            break;
          case "email":
            fieldErrors.email ??= issue.message;
            break;
          case "phone":
            fieldErrors.phone ??= issue.message;
            break;
          case "company":
            fieldErrors.company ??= issue.message;
            break;
        }
      }
      return fieldErrors;
    },
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

  function useLatestConflict() {
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
          <div className={styles.dialogFields}>
            <FormField
              name="firstName"
              label="First name"
              value={formik.values.firstName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={saving}
              maxLength={80}
              error={
                formik.touched.firstName ? formik.errors.firstName : undefined
              }
              initialFocus
            />
            <FormField
              name="lastName"
              label="Last name"
              value={formik.values.lastName}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={saving}
              maxLength={80}
              error={
                formik.touched.lastName ? formik.errors.lastName : undefined
              }
            />
            <FormField
              name="email"
              label="Email"
              type="email"
              value={formik.values.email}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={saving}
              maxLength={254}
              error={formik.touched.email ? formik.errors.email : undefined}
            />
            <FormField
              name="phone"
              label="Phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={formik.values.phone}
              onChange={(event) =>
                formik.setFieldValue(
                  "phone",
                  event.target.value.replace(/\D/g, "").slice(0, 10),
                )
              }
              onBlur={formik.handleBlur}
              disabled={saving}
              maxLength={10}
              pattern="[6-9][0-9]{9}"
              ariaLabel="10-digit Indian mobile number"
              error={formik.touched.phone ? formik.errors.phone : undefined}
              prefix="+91"
            />
            <FormField
              name="company"
              label="Company"
              value={formik.values.company}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={saving}
              maxLength={120}
              error={formik.touched.company ? formik.errors.company : undefined}
              fullWidth
            />
          </div>

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
              onUseLatest={useLatestConflict}
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
