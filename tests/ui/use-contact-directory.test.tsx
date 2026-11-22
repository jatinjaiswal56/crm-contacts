// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useContactDirectory,
  type ContactListResponse,
} from "@/features/contacts/hooks/use-contact-directory";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function contactsResponse(firstName: string) {
  return {
    items: [
      {
        id: firstName,
        firstName,
        lastName: "Tester",
        email: null,
        phone: null,
        company: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        version: 1,
        tags: [],
      },
    ],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  } satisfies ContactListResponse;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useContactDirectory", () => {
  it("transitions from loading to loaded contact and tag data", async () => {
    const pendingContacts = deferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input) === "/api/tags"
        ? Promise.resolve(jsonResponse({ items: [] }))
        : pendingContacts.promise,
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useContactDirectory("", 0));
    expect(result.current.isLoading).toBe(true);

    pendingContacts.resolve(jsonResponse(contactsResponse("Loaded")));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.result?.items[0]?.firstName).toBe("Loaded");
    expect(result.current.error).toBeNull();
    expect(result.current.isTagsLoading).toBe(false);
  });

  it("keeps the last successful contacts when a later request fails", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/tags") {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      if (url === "/api/contacts?search=broken") {
        return Promise.resolve(
          jsonResponse({ error: { message: "Directory unavailable." } }, 503),
        );
      }
      return Promise.resolve(jsonResponse(contactsResponse("Existing")));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ queryString }) => useContactDirectory(queryString, 0),
      { initialProps: { queryString: "" } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.result?.items[0]?.firstName).toBe("Existing");

    rerender({ queryString: "search=broken" });
    await waitFor(() =>
      expect(result.current.error).toBe("Directory unavailable."),
    );

    expect(result.current.result?.items[0]?.firstName).toBe("Existing");
  });

  it("does not let a superseded response replace newer contacts", async () => {
    const staleResponse = deferred<Response>();
    const staleJson = deferred<unknown>();
    const stalePayload = jsonResponse(contactsResponse("Stale"));
    const staleJsonSpy = vi.spyOn(stalePayload, "json").mockReturnValue(
      staleJson.promise,
    );
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/tags") {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      if (url === "/api/contacts?search=old") return staleResponse.promise;
      return Promise.resolve(jsonResponse(contactsResponse("Newest")));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(
      ({ queryString }) => useContactDirectory(queryString, 0),
      { initialProps: { queryString: "search=old" } },
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/contacts?search=old",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );

    staleResponse.resolve(stalePayload);
    await waitFor(() => expect(staleJsonSpy).toHaveBeenCalled());
    rerender({ queryString: "search=new" });
    await waitFor(() =>
      expect(result.current.result?.items[0]?.firstName).toBe("Newest"),
    );

    await act(async () => {
      staleJson.resolve(contactsResponse("Stale"));
      await staleJson.promise;
    });

    expect(result.current.result?.items[0]?.firstName).toBe("Newest");
  });

  it("aborts pending requests when unmounted", async () => {
    const contactsSignals: AbortSignal[] = [];
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        if (String(input) === "/api/tags") {
          return Promise.resolve(jsonResponse({ items: [] }));
        }
        const signal = init?.signal;
        if (signal) contactsSignals.push(signal);
        return new Promise((_, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = renderHook(() => useContactDirectory("", 0));
    await waitFor(() => expect(contactsSignals).toHaveLength(1));

    unmount();

    expect(contactsSignals[0]?.aborted).toBe(true);
  });
});
