import {
  contactExists,
  findAllTags,
  findContactById,
  findContactPage,
  findRecentActivity,
  findTagsForContact,
} from "./repository";
import type { ContactListQuery } from "./validation";

export async function listContacts(query: ContactListQuery) {
  const { contacts, tagsByContact, total } = await findContactPage(query);

  return {
    items: contacts.map((contact) => ({
      ...contact,
      tags: tagsByContact.get(contact.id) ?? [],
    })),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getContact(id: string) {
  const contact = await findContactById(id);
  if (!contact) return null;

  return {
    ...contact,
    tags: await findTagsForContact(id),
  };
}

export async function getContactActivity(id: string) {
  if (!(await contactExists(id))) return null;
  return findRecentActivity(id);
}

export async function getTags() {
  return findAllTags();
}
