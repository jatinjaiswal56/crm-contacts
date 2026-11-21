import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const activityTypes = [
  "CONTACT_CREATED",
  "CONTACT_UPDATED",
  "TAG_ADDED",
  "TAG_REMOVED",
] as const;

export type ActivityType = (typeof activityTypes)[number];

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    emailNormalized: text("email_normalized"),
    phone: text("phone"),
    phoneNormalized: text("phone_normalized"),
    company: text("company"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("contacts_email_normalized_unique").on(table.emailNormalized),
    uniqueIndex("contacts_phone_normalized_unique").on(table.phoneNormalized),
    index("contacts_name_idx").on(table.lastName, table.firstName),
    index("contacts_company_idx").on(table.company),
    index("contacts_created_at_idx").on(table.createdAt),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    nameNormalized: text("name_normalized").notNull(),
  },
  (table) => [
    uniqueIndex("tags_name_normalized_unique").on(table.nameNormalized),
  ],
);

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.contactId, table.tagId] }),
    index("contact_tags_tag_id_idx").on(table.tagId),
  ],
);

export const contactActivities = pgTable(
  "contact_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    type: text("type").$type<ActivityType>().notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  },
  (table) => [
    index("contact_activities_contact_timestamp_idx").on(
      table.contactId,
      table.timestamp,
    ),
  ],
);
