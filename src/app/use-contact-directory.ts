"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { sanitizeContactQuery } from "../lib/contacts/query-params";

const contactTagSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const contactListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      email: z.string().nullable(),
      phone: z.string().nullable(),
      company: z.string().nullable(),
      createdAt: z.string(),
      updatedAt: z.string(),
      version: z.number(),
      tags: z.array(contactTagSchema),
    }),
  ),
  pagination: z.object({
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

const tagListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      nameNormalized: z.string(),
    }),
  ),
});

const apiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
  }),
});

export type ContactListResponse = z.infer<typeof contactListResponseSchema>;
export type FilterTag = z.infer<typeof tagListResponseSchema>["items"][number];

async function readResponseJson(response: Response, fallback: string) {
  try {
    return await response.json();
  } catch {
    throw new Error(fallback);
  }
}

function getApiErrorMessage(payload: unknown, fallback: string) {
  const parsed = apiErrorSchema.safeParse(payload);
  return parsed.success ? parsed.data.error.message : fallback;
}

export function useContactDirectory(queryString: string, refreshKey: number) {
  const [result, setResult] = useState<ContactListResponse | null>(null);
  const [tags, setTags] = useState<FilterTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTagsLoading, setIsTagsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadContacts() {
      setIsLoading(true);
      setError(null);

      try {
        const sanitizedQuery = sanitizeContactQuery(
          new URLSearchParams(queryString),
        );
        const url = sanitizedQuery
          ? `/api/contacts?${sanitizedQuery}`
          : "/api/contacts";
        const response = await fetch(url, { signal: controller.signal });
        const payload = await readResponseJson(
          response,
          "The contacts service returned an unreadable response.",
        );

        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(payload, "Could not load contacts."),
          );
        }

        const parsed = contactListResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("The contacts service returned invalid data.");
        }

        setResult(parsed.data);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load contacts.",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadContacts();
    return () => controller.abort();
  }, [queryString, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTags() {
      setIsTagsLoading(true);
      setTagsError(null);

      try {
        const response = await fetch("/api/tags", {
          signal: controller.signal,
        });
        const payload = await readResponseJson(
          response,
          "The tags service returned an unreadable response.",
        );

        if (!response.ok) {
          throw new Error(getApiErrorMessage(payload, "Could not load tags."));
        }

        const parsed = tagListResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new Error("The tags service returned invalid data.");
        }

        setTags(parsed.data.items);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setTagsError(
          loadError instanceof Error ? loadError.message : "Could not load tags.",
        );
      } finally {
        if (!controller.signal.aborted) setIsTagsLoading(false);
      }
    }

    void loadTags();
    return () => controller.abort();
  }, []);

  return { result, tags, isLoading, isTagsLoading, error, tagsError };
}
