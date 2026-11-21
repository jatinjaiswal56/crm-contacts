import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../db/client";
import {
  contactActivities,
  contactTags,
  contacts,
  tags,
} from "../db/schema";
import type { ContactListQuery } from "./validation";

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function buildContactConditions(query: ContactListQuery) {
  const conditions: SQL[] = [];

  if (query.search) {
    const pattern = `%${escapeLike(query.search)}%`;
    const searchCondition = or(
      ilike(contacts.firstName, pattern),
      ilike(contacts.lastName, pattern),
      ilike(sql<string>`${contacts.firstName} || ' ' || ${contacts.lastName}`, pattern),
      ilike(contacts.email, pattern),
      ilike(contacts.company, pattern),
    );

    if (searchCondition) conditions.push(searchCondition);
  }

  if (query.company) {
    conditions.push(ilike(contacts.company, `%${escapeLike(query.company)}%`));
  }

  if (query.tag) {
    const matchingTag = db
      .select({ contactId: contactTags.contactId })
      .from(contactTags)
      .innerJoin(tags, eq(contactTags.tagId, tags.id))
      .where(
        and(
          eq(contactTags.contactId, contacts.id),
          eq(tags.nameNormalized, query.tag.toLowerCase()),
        ),
      );

    conditions.push(exists(matchingTag));
  }

  return conditions.length ? and(...conditions) : undefined;
}

export async function findContactPage(query: ContactListQuery) {
  const where = buildContactConditions(query);
  const direction = query.order === "asc" ? asc : desc;
  const orderBy =
    query.sort === "name"
      ? [
          direction(contacts.lastName),
          direction(contacts.firstName),
          direction(contacts.id),
        ]
      : [direction(contacts.createdAt), direction(contacts.id)];

  const contactRows = await db
      .select()
      .from(contacts)
      .where(where)
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
  const countRows = await db
    .select({ total: count() })
    .from(contacts)
    .where(where);
  const contactIds = contactRows.map((contact) => contact.id);
  const tagRows = contactIds.length
    ? await db
        .select({
          contactId: contactTags.contactId,
          id: tags.id,
          name: tags.name,
        })
        .from(contactTags)
        .innerJoin(tags, eq(contactTags.tagId, tags.id))
        .where(inArray(contactTags.contactId, contactIds))
        .orderBy(asc(tags.name))
    : [];
  const tagsByContact = new Map<string, { id: string; name: string }[]>();

  for (const tag of tagRows) {
    const contactTagList = tagsByContact.get(tag.contactId) ?? [];
    contactTagList.push({ id: tag.id, name: tag.name });
    tagsByContact.set(tag.contactId, contactTagList);
  }

  return {
    contacts: contactRows,
    total: countRows[0]?.total ?? 0,
    tagsByContact,
  };
}

export async function findContactById(id: string) {
  const [contact] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);

  return contact ?? null;
}

export async function findTagsForContact(contactId: string) {
  return db
    .select({ id: tags.id, name: tags.name })
    .from(contactTags)
    .innerJoin(tags, eq(contactTags.tagId, tags.id))
    .where(eq(contactTags.contactId, contactId))
    .orderBy(asc(tags.name));
}

export async function contactExists(id: string) {
  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.id, id))
    .limit(1);

  return Boolean(contact);
}

export async function findRecentActivity(contactId: string) {
  return db
    .select()
    .from(contactActivities)
    .where(eq(contactActivities.contactId, contactId))
    .orderBy(desc(contactActivities.timestamp), desc(contactActivities.id))
    .limit(20);
}

export async function findAllTags() {
  return db.select().from(tags).orderBy(asc(tags.name));
}

export type ContactWriteValues = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
};

function normalizePhone(phone: string | null) {
  return phone?.replace(/\D/g, "") || null;
}

export async function createContact(values: ContactWriteValues) {
  return db.transaction(async (tx) => {
    const emailNormalized = values.email?.trim().toLowerCase() || null;
    const phoneNormalized = normalizePhone(values.phone);

    if (emailNormalized) {
      const [duplicate] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.emailNormalized, emailNormalized))
        .limit(1);
      if (duplicate) {
        return { kind: "duplicate" as const, field: "email" as const };
      }
    }

    if (phoneNormalized) {
      const [duplicate] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.phoneNormalized, phoneNormalized))
        .limit(1);
      if (duplicate) {
        return { kind: "duplicate" as const, field: "phone" as const };
      }
    }

    const [created] = await tx
      .insert(contacts)
      .values({
        ...values,
        emailNormalized,
        phoneNormalized,
        version: 1,
      })
      .returning();

    return { kind: "created" as const, contact: created };
  });
}

export async function updateContact(
  id: string,
  expectedVersion: number,
  values: ContactWriteValues,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);

    if (!existing) return { kind: "missing" as const };
    if (existing.version !== expectedVersion) {
      return {
        kind: "conflict" as const,
        currentVersion: existing.version,
      };
    }

    const emailNormalized = values.email?.trim().toLowerCase() || null;
    const phoneNormalized = normalizePhone(values.phone);
    if (emailNormalized) {
      const [duplicate] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(sql`${contacts.emailNormalized} = ${emailNormalized} AND ${contacts.id} <> ${id}`)
        .limit(1);
      if (duplicate) {
        return { kind: "duplicate" as const, field: "email" as const };
      }
    }

    if (phoneNormalized) {
      const [duplicate] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.phoneNormalized, phoneNormalized),
            ne(contacts.id, id),
          ),
        )
        .limit(1);
      if (duplicate) {
        return { kind: "duplicate" as const, field: "phone" as const };
      }
    }

    const [updated] = await tx
      .update(contacts)
      .set({
        ...values,
        emailNormalized,
        phoneNormalized,
        updatedAt: new Date(),
        version: existing.version + 1,
      })
      .where(
        and(
          eq(contacts.id, id),
          eq(contacts.version, expectedVersion),
        ),
      )
      .returning();

    if (!updated) {
      return {
        kind: "conflict" as const,
        currentVersion: existing.version,
      };
    }

    await tx.insert(contactActivities).values({
      contactId: id,
      type: "CONTACT_UPDATED",
      metadata: {
        previousVersion: expectedVersion,
        newVersion: updated.version,
        fields: Object.keys(values),
      },
    });

    return { kind: "updated" as const, contact: updated };
  });
}

export async function replaceContactTags(
  contactId: string,
  tagIds: string[],
  expectedVersion: number,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);
    if (!existing) return { kind: "missing" as const };

    const uniqueTagIds = [...new Set(tagIds)];
    if (uniqueTagIds.length) {
      const existingTags = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.id, uniqueTagIds));
      if (existingTags.length !== uniqueTagIds.length) {
        return { kind: "invalid-tags" as const };
      }
    }

    const [updatedContact] = await tx
      .update(contacts)
      .set({
        version: sql`${contacts.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(contacts.id, contactId),
          eq(contacts.version, expectedVersion),
        ),
      )
      .returning({ version: contacts.version });

    if (!updatedContact) {
      const [existing] = await tx
        .select({ version: contacts.version })
        .from(contacts)
        .where(eq(contacts.id, contactId))
        .limit(1);
      if (!existing) return { kind: "missing" as const };
      return {
        kind: "conflict" as const,
        currentVersion: existing.version,
      };
    }

    const current = await tx
      .select({ tagId: contactTags.tagId })
      .from(contactTags)
      .where(eq(contactTags.contactId, contactId));
    const currentIds = new Set(current.map((item) => item.tagId));
    const nextIds = new Set(uniqueTagIds);
    const addedIds = uniqueTagIds.filter((tagId) => !currentIds.has(tagId));
    const removedIds = [...currentIds].filter((tagId) => !nextIds.has(tagId));

    await tx
      .delete(contactTags)
      .where(eq(contactTags.contactId, contactId));

    if (uniqueTagIds.length) {
      await tx.insert(contactTags).values(
        uniqueTagIds.map((tagId) => ({
          contactId,
          tagId,
        })),
      );
    }

    for (const tagId of addedIds) {
      await tx.insert(contactActivities).values({
        contactId,
        type: "TAG_ADDED",
        metadata: { tagId },
      });
    }
    for (const tagId of removedIds) {
      await tx.insert(contactActivities).values({
        contactId,
        type: "TAG_REMOVED",
        metadata: { tagId },
      });
    }

    return { kind: "updated" as const, version: updatedContact.version };
  });
}
