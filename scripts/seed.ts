import {
  contactActivities,
  contactTags,
  contacts,
  tags,
  type ActivityType,
} from "../src/lib/db/schema";
import { db, pool } from "../src/lib/db/client";

const makeId = (value: number) =>
  `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

const tagRows = [
  { id: makeId(101), name: "Lead", nameNormalized: "lead" },
  { id: makeId(102), name: "Customer", nameNormalized: "customer" },
  { id: makeId(103), name: "VIP", nameNormalized: "vip" },
  { id: makeId(104), name: "Prospect", nameNormalized: "prospect" },
];

const firstNames = [
  "Aarav",
  "Aditi",
  "Amara",
  "Arjun",
  "Diya",
  "Ishaan",
  "Kabir",
  "Maya",
  "Neha",
  "Rohan",
  "Sana",
  "Vihaan",
];

const lastNames = [
  "Kapoor",
  "Mehta",
  "Patel",
  "Rao",
  "Shah",
  "Singh",
  "Verma",
  "Williams",
  "Brown",
];

const companies = [
  "Northstar Labs",
  "Juniper Works",
  "Brightside Co.",
  "Orbit Studio",
  "Fieldstone",
  "Maple & Main",
];

const contactRows = Array.from({ length: 36 }, (_, index) => {
  const firstName = firstNames[index % firstNames.length];
  const lastName =
    lastNames[Math.floor(index / firstNames.length) % lastNames.length];
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index + 1}@example.com`;
  const phone = `+1 415 555 ${String(1000 + index).slice(-4)}`;
  const createdAt = new Date(Date.UTC(2025, 0, index + 1, 10));

  return {
    id: makeId(index + 1),
    firstName,
    lastName,
    email,
    emailNormalized: email.toLowerCase(),
    phone,
    phoneNormalized: phone.replace(/\D/g, ""),
    company: companies[index % companies.length],
    createdAt,
    updatedAt: new Date(Date.UTC(2025, 0, index + 2, 10)),
    version: 1,
  };
});

const contactTagRows = contactRows.flatMap((contact, index) => {
  const assignedTagIds: number[] = [];

  if (index % 2 === 0) assignedTagIds.push(101);
  if (index % 3 === 0) assignedTagIds.push(102);
  if (index % 5 === 0) assignedTagIds.push(103);
  if (assignedTagIds.length === 0) assignedTagIds.push(104);

  return assignedTagIds.map((tagId) => ({
    contactId: contact.id,
    tagId: makeId(tagId),
    createdAt: contact.updatedAt,
  }));
});

const activityRows = contactRows.slice(0, 24).map((contact, index) => {
  const type: ActivityType =
    index % 3 === 0
      ? "TAG_ADDED"
      : index % 3 === 1
        ? "CONTACT_UPDATED"
        : "TAG_REMOVED";

  return {
    id: makeId(1001 + index),
    contactId: contact.id,
    type,
    timestamp: new Date(Date.UTC(2025, 1, index + 1, 12)),
    metadata: { source: "seed" },
  };
});

async function main() {
  try {
    await db.transaction(async (transaction) => {
      await transaction
        .insert(contacts)
        .values(contactRows)
        .onConflictDoNothing();
      await transaction.insert(tags).values(tagRows).onConflictDoNothing();
      await transaction
        .insert(contactTags)
        .values(contactTagRows)
        .onConflictDoNothing();
      await transaction
        .insert(contactActivities)
        .values(activityRows)
        .onConflictDoNothing();
    });

    console.info(
      `Seeded ${contactRows.length} contacts, ${tagRows.length} tags, and ${activityRows.length} activities.`,
    );
  } finally {
    await pool.end();
  }
}

void main().catch((error: unknown) => {
  console.error("Failed to seed PostgreSQL data.", error);
  process.exitCode = 1;
});
