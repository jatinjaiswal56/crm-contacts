import type { FormikProps } from "formik";
import type { ContactWriteFields } from "@/lib/contacts/validation";
import styles from "./contact-dialog.module.css";
import { FormField } from "./form-field";

type Props = {
  formik: FormikProps<ContactWriteFields>;
  disabled: boolean;
};

export function ContactFields({ formik, disabled }: Props) {
  const visibleError = (field: keyof ContactWriteFields) =>
    formik.touched[field] ? formik.errors[field] : undefined;

  return (
    <div className={styles.dialogFields}>
      <FormField
        name="firstName"
        label="First name"
        value={formik.values.firstName}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        disabled={disabled}
        maxLength={80}
        error={visibleError("firstName")}
        initialFocus
      />
      <FormField
        name="lastName"
        label="Last name"
        value={formik.values.lastName}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        disabled={disabled}
        maxLength={80}
        error={visibleError("lastName")}
      />
      <FormField
        name="email"
        label="Email"
        type="email"
        value={formik.values.email}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        disabled={disabled}
        maxLength={254}
        error={visibleError("email")}
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
        disabled={disabled}
        maxLength={10}
        pattern="[6-9][0-9]{9}"
        ariaLabel="10-digit Indian mobile number"
        error={visibleError("phone")}
        prefix="+91"
      />
      <FormField
        name="company"
        label="Company"
        value={formik.values.company}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        disabled={disabled}
        maxLength={120}
        error={visibleError("company")}
        fullWidth
      />
    </div>
  );
}
