"use client";

import { useFormik, type FormikErrors, type FormikHelpers } from "formik";
import {
  useCallback,
  useEffect,
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
import {
  contactWriteFieldsSchema,
  type ContactWriteFields,
} from "@/lib/contacts/validation";
import styles from "./contacts-workspace.module.css";

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

type Tag = { id: string; name: string; nameNormalized: string };

type Props = {
  contact: EditableContact | null;
  tags: Tag[];
  open: boolean;
  onClose: () => void;
  onError: (message: string) => void;
  onSaved: (message: string) => void;
};

const activityItemSchema = z.object({
  id: z.string(),
  type: z.enum(["CONTACT_UPDATED", "TAG_ADDED", "TAG_REMOVED"]),
  timestamp: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});
const activityResponseSchema = z.object({
  items: z.array(activityItemSchema),
});

type ActivityItem = z.infer<typeof activityItemSchema>;

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

function getErrorMessage(payload: unknown, fallback: string) {
  const parsed = z.object({ error: z.object({ message: z.string() }) }).safeParse(payload);
  return parsed.success ? parsed.data.error.message : fallback;
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
  const [conflict, setConflict] = useState<{
    message: string;
    latest: EditableContact & { version: number };
  } | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(
    Boolean(open && contact?.id),
  );
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
            const message = getErrorMessage(payload, "Could not save contact.");
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
            setActivityLoading(true);
            setActivityError(null);
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
            throw new Error(getErrorMessage(tagPayload, "Could not save tags."));
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

    void formik.submitForm().then(() => {
      if (typeof firstInvalidField !== "string") return;
      formRef.current
        ?.querySelector<HTMLInputElement>(`[name="${firstInvalidField}"]`)
        ?.focus();
    });
  }

  const requestClose = useCallback(() => {
    if (saving) {
      onClose();
      return;
    }
    if (
      hasUnsavedChanges &&
      !window.confirm("You have unsaved changes. Discard them and close?")
    ) {
      return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose, saving]);

  useEffect(() => {
    if (!open || !baseContact?.id) return;
    const controller = new AbortController();
    void fetch(`/api/contacts/${baseContact.id}/activity`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, "Could not load activity."));
        }
        const parsed = activityResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("The activity service returned invalid data.");
        }
        return parsed.data.items;
      })
      .then(setActivity)
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Could not load activity.";
        setActivityError(message);
        onError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setActivityLoading(false);
      });
    return () => controller.abort();
  }, [activityRefreshKey, baseContact?.id, onError, open]);

  useEffect(() => {
    if (!open || !hasUnsavedChanges) return;
    const preventLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventLeaving);
    return () => window.removeEventListener("beforeunload", preventLeaving);
  }, [hasUnsavedChanges, open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("[data-dialog-initial-focus]")?.focus();

    function trapTab(event: KeyboardEvent) {
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", trapTab);
    return () => {
      document.removeEventListener("keydown", trapTab);
      previouslyFocused?.focus();
    };
  }, [open]);

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
            <label>
              <span>
                First name<span className={styles.requiredMarker} aria-hidden="true">*</span>
              </span>
              <input
                name="firstName"
                data-dialog-initial-focus
                value={formik.values.firstName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                required
                disabled={saving}
                maxLength={80}
                aria-invalid={Boolean(
                  formik.touched.firstName && formik.errors.firstName,
                )}
                aria-describedby={
                  formik.touched.firstName && formik.errors.firstName
                    ? "firstName-error"
                    : undefined
                }
              />
              {formik.touched.firstName && formik.errors.firstName ? (
                <span className={styles.fieldError} id="firstName-error">
                  {formik.errors.firstName}
                </span>
              ) : null}
            </label>
            <label>
              <span>
                Last name<span className={styles.requiredMarker} aria-hidden="true">*</span>
              </span>
              <input
                name="lastName"
                value={formik.values.lastName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                required
                disabled={saving}
                maxLength={80}
                aria-invalid={Boolean(
                  formik.touched.lastName && formik.errors.lastName,
                )}
                aria-describedby={
                  formik.touched.lastName && formik.errors.lastName
                    ? "lastName-error"
                    : undefined
                }
              />
              {formik.touched.lastName && formik.errors.lastName ? (
                <span className={styles.fieldError} id="lastName-error">
                  {formik.errors.lastName}
                </span>
              ) : null}
            </label>
            <label>
              <span>
                Email<span className={styles.requiredMarker} aria-hidden="true">*</span>
              </span>
              <input
                name="email"
                type="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                required
                disabled={saving}
                maxLength={254}
                aria-invalid={Boolean(formik.touched.email && formik.errors.email)}
                aria-describedby={
                  formik.touched.email && formik.errors.email
                    ? "email-error"
                    : undefined
                }
              />
              {formik.touched.email && formik.errors.email ? (
                <span className={styles.fieldError} id="email-error">
                  {formik.errors.email}
                </span>
              ) : null}
            </label>
            <label>
              <span>
                Phone<span className={styles.requiredMarker} aria-hidden="true">*</span>
              </span>
              <span
                className={`${styles.phoneInput} ${
                  formik.touched.phone && formik.errors.phone
                    ? styles.invalidPhoneInput
                    : ""
                }`}
              >
                <span className={styles.phonePrefix} aria-hidden="true">+91</span>
                <input
                  name="phone"
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
                  required
                  disabled={saving}
                  maxLength={10}
                  pattern="[6-9][0-9]{9}"
                  aria-label="10-digit Indian mobile number"
                  aria-invalid={Boolean(formik.touched.phone && formik.errors.phone)}
                  aria-describedby={
                    formik.touched.phone && formik.errors.phone
                      ? "phone-error"
                      : undefined
                  }
                />
              </span>
              {formik.touched.phone && formik.errors.phone ? (
                <span className={styles.fieldError} id="phone-error">
                  {formik.errors.phone}
                </span>
              ) : null}
            </label>
            <label className={styles.dialogFullField}>
              <span>
                Company<span className={styles.requiredMarker} aria-hidden="true">*</span>
              </span>
              <input
                name="company"
                value={formik.values.company}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                required
                disabled={saving}
                maxLength={120}
                aria-invalid={Boolean(
                  formik.touched.company && formik.errors.company,
                )}
                aria-describedby={
                  formik.touched.company && formik.errors.company
                    ? "company-error"
                    : undefined
                }
              />
              {formik.touched.company && formik.errors.company ? (
                <span className={styles.fieldError} id="company-error">
                  {formik.errors.company}
                </span>
              ) : null}
            </label>
          </div>

          {formik.submitCount > 0 && validationErrorCount > 0 ? (
            <p className={styles.validationSummary} role="alert">
              Fix {validationErrorCount}{" "}
              {validationErrorCount === 1 ? "field" : "fields"} to save.
            </p>
          ) : null}

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
                    disabled={saving}
                    onChange={(event) =>
                      setSelectedTagIds((current) =>
                        event.target.checked
                          ? [...current, tag.id]
                          : current.filter((tagId) => tagId !== tag.id),
                      )
                    }
                  />
                  {tag.name}
                </label>
              ))}
            </div>
          </fieldset>

          {conflict ? (
            <section
              className={styles.conflictSection}
              role="alert"
              aria-labelledby="contact-conflict-title"
            >
              <h3 id="contact-conflict-title">This contact changed while you were editing</h3>
              <p id="contact-conflict-message">{conflict.message}</p>
              <p>
                Compare your draft with the latest saved values. You can accept
                the latest version or merge only your changed fields, then save
                again.
              </p>
              <div className={styles.conflictCompare}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Your draft</th>
                      <th scope="col">Latest server value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["First name", formik.values.firstName, conflict.latest.firstName],
                      ["Last name", formik.values.lastName, conflict.latest.lastName],
                      ["Email", formik.values.email, conflict.latest.email ?? "—"],
                      [
                        "Phone",
                        formik.values.phone ? `+91 ${formik.values.phone}` : "—",
                        conflict.latest.phone ?? "—",
                      ],
                      ["Company", formik.values.company, conflict.latest.company ?? "—"],
                      [
                        "Tags",
                        selectedTagIds
                          .map((id) => tags.find((tag) => tag.id === id)?.name ?? id)
                          .join(", ") || "—",
                        conflict.latest.tags.map((tag) => tag.name).join(", ") || "—",
                      ],
                    ].map(([label, draftValue, latestValue]) => (
                      <tr key={label}>
                        <th scope="row">{label}</th>
                        <td>{draftValue || "—"}</td>
                        <td>{latestValue || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.conflictActions}>
                <button type="button" onClick={useLatestConflict}>
                  Use latest values
                </button>
                <button
                  className={styles.dialogPrimary}
                  type="button"
                  onClick={keepDraftChangesOnLatest}
                >
                  Merge my draft onto latest
                </button>
              </div>
            </section>
          ) : null}

          {baseContact?.id ? (
            <section className={styles.activitySection} aria-label="Recent activity">
              <h3>Recent activity</h3>
              {activityLoading ? (
                <p role="status">Loading activity…</p>
              ) : activityError ? (
                <p role="alert">
                  Could not load activity: {activityError}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setActivityError(null);
                      setActivityLoading(true);
                      setActivityRefreshKey((key) => key + 1);
                    }}
                  >
                    Retry
                  </button>
                </p>
              ) : activity.length ? (
                <ul>
                  {activity.slice(0, 5).map((item) => (
                    <li key={item.id}>
                      <strong>{item.type.replaceAll("_", " ")}</strong>
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No activity recorded.</p>
              )}
            </section>
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
