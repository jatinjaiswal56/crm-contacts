// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ContactListResponse,
  FilterTag,
} from "@/features/contacts/hooks/use-contact-directory";
import { ContactsWorkspace } from "@/features/contacts/components/workspace/contacts-workspace";

const mocks = vi.hoisted(() => ({
  searchParams: "",
  push: vi.fn(),
  replace: vi.fn(),
  useContactDirectory: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/contacts",
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.searchParams),
}));

vi.mock("@/features/contacts/hooks/use-contact-directory", () => ({
  useContactDirectory: mocks.useContactDirectory,
}));

const tags: FilterTag[] = [
  { id: "vip", name: "VIP", nameNormalized: "vip" },
  { id: "lead", name: "Lead", nameNormalized: "lead" },
  { id: "customer", name: "Customer", nameNormalized: "customer" },
];

function contact(
  id: string,
  firstName: string,
  tagIds: string[] = [],
): ContactListResponse["items"][number] {
  return {
    id,
    firstName,
    lastName: "User",
    email: `${id}@example.com`,
    phone: "+91 9876543210",
    company: "Example",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: 1,
    tags: tagIds.map((id) => {
      const tag = tags.find((item) => item.id === id);
      if (!tag) throw new Error(`Unknown test tag: ${id}`);
      return { id: tag.id, name: tag.name };
    }),
  };
}

function directoryState(
  items: ContactListResponse["items"],
  pagination = {
    page: 1,
    pageSize: 20,
    total: items.length,
    totalPages: items.length ? 1 : 0,
  },
  error: string | null = null,
) {
  return {
    result: { items, pagination },
    tags,
    isLoading: false,
    isTagsLoading: false,
    error,
    tagsError: null,
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mocks.searchParams = "";
  mocks.push.mockReset();
  mocks.replace.mockReset();
  mocks.useContactDirectory.mockReturnValue(
    directoryState([contact("alex", "Alex")]),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ContactsWorkspace", () => {
  it("debounces search once for 300 ms and resets pagination", async () => {
    mocks.searchParams = "page=4&order=desc";
    vi.useFakeTimers();
    render(<ContactsWorkspace />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search contacts" }), {
      target: { value: "Alex" },
    });
    await vi.advanceTimersByTimeAsync(299);
    expect(mocks.replace).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(mocks.replace).toHaveBeenCalledTimes(1);
    const [href] = mocks.replace.mock.calls[0] ?? [];
    const params = new URL(`http://localhost${href}`).searchParams;
    expect(params.get("search")).toBe("Alex");
    expect(params.has("page")).toBe(false);
    expect(params.get("order")).toBe("desc");
  });

  it("keeps characters typed while the debounced URL update is in flight", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<ContactsWorkspace />);
    const searchbox = screen.getByRole("searchbox", { name: "Search contacts" });

    fireEvent.change(searchbox, { target: { value: "Ale" } });
    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.replace).toHaveBeenCalledTimes(1);

    // The user keeps typing before the router has applied "search=Ale".
    fireEvent.change(searchbox, { target: { value: "Alex" } });
    mocks.searchParams = "search=Ale";
    rerender(<ContactsWorkspace />);

    expect(searchbox).toHaveValue("Alex");
  });

  it("follows the URL when history navigation clears a pushed search", async () => {
    vi.useFakeTimers();
    const { rerender } = render(<ContactsWorkspace />);
    const searchbox = screen.getByRole("searchbox", { name: "Search contacts" });

    fireEvent.change(searchbox, { target: { value: "Alex" } });
    await vi.advanceTimersByTimeAsync(300);
    mocks.searchParams = "search=Alex";
    rerender(<ContactsWorkspace />);
    expect(searchbox).toHaveValue("Alex");

    // Browser back to the unfiltered list.
    mocks.searchParams = "";
    rerender(<ContactsWorkspace />);
    expect(searchbox).toHaveValue("");

    await vi.advanceTimersByTimeAsync(300);
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });

  it("applies filters while clearing the current page", () => {
    mocks.searchParams = "page=5&sort=name";
    vi.useFakeTimers();
    render(<ContactsWorkspace />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search contacts" }), {
      target: { value: "Alex" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Company" }), {
      target: { value: "North" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by tag" }), {
      target: { value: "lead" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

    expect(mocks.push).toHaveBeenCalledTimes(1);
    const [href] = mocks.push.mock.calls[0] ?? [];
    const params = new URL(`http://localhost${href}`).searchParams;
    expect(params.get("search")).toBe("Alex");
    expect(params.get("company")).toBe("North");
    expect(params.get("tag")).toBe("lead");
    expect(params.has("page")).toBe(false);
  });

  it("distinguishes no matches from an empty later page", () => {
    mocks.useContactDirectory.mockReturnValue(directoryState([]));
    const { rerender } = render(<ContactsWorkspace />);
    expect(
      screen.getByRole("heading", { name: "No contacts found" }),
    ).toBeInTheDocument();

    mocks.useContactDirectory.mockReturnValue(
      directoryState([], {
        page: 2,
        pageSize: 20,
        total: 25,
        totalPages: 2,
      }),
    );
    rerender(<ContactsWorkspace />);

    expect(
      screen.getByRole("heading", { name: "No contacts on this page" }),
    ).toBeInTheDocument();
  });

  it("explains when an error leaves the previous results visible", () => {
    mocks.useContactDirectory.mockReturnValue(
      directoryState([contact("alex", "Alex")], undefined, "Network unavailable."),
    );
    render(<ContactsWorkspace />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Showing the last loaded results.",
    );
  });

  it("adds selected tags without removing existing tags", async () => {
    const requests: { url: string; body: unknown }[] = [];
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({
          url: String(input),
          body: JSON.parse(String(init?.body)),
        });
        return Promise.resolve(response({ item: {} }));
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    mocks.useContactDirectory.mockReturnValue(
      directoryState([contact("alex", "Alex", ["vip"])]),
    );
    render(<ContactsWorkspace />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Alex User" }));
    expect(screen.getByRole("button", { name: "Apply tags" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Lead" }));
    expect(screen.getByRole("button", { name: "Apply tags" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply tags" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(requests[0]?.url).toBe("/api/contacts/alex/tags");
    expect(requests[0]?.body).toEqual({
      tagIds: ["vip", "lead"],
      expectedVersion: 1,
    });
  });

  it("replaces tags and confirms before removing all tags", async () => {
    const requests: { url: string; body: unknown }[] = [];
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({
          url: String(input),
          body: JSON.parse(String(init?.body)),
        });
        return Promise.resolve(response({ item: {} }));
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    mocks.useContactDirectory.mockReturnValue(
      directoryState([contact("alex", "Alex", ["vip", "lead"])]),
    );
    render(<ContactsWorkspace />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Alex User" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "replace" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Customer" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply tags" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(requests[0]?.body).toMatchObject({ tagIds: ["customer"] });
    await screen.findByText("Tags updated successfully.");

    fetchMock.mockClear();
    requests.length = 0;
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Alex User" }));
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole("button", { name: "Apply tags" }));

    expect(confirm).toHaveBeenCalledWith("Remove all tags from 1 contacts?");
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply tags" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(requests[0]?.body).toMatchObject({ tagIds: [] });
  });

  it("reports partial bulk progress and leaves failed contacts selected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ item: {} }))
      .mockResolvedValueOnce(
        response({ error: { message: "Version changed." } }, 409),
      );
    vi.stubGlobal("fetch", fetchMock);
    mocks.useContactDirectory.mockReturnValue(
      directoryState([
        contact("alex", "Alex"),
        contact("blair", "Blair"),
      ]),
    );
    render(<ContactsWorkspace />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Alex User" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Blair User" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Lead" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply tags" }));

    expect(
      await screen.findByText(
        "Updated 1 of 2. Stopped at Blair User: Version changed.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Select Alex User" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Select Blair User" }),
    ).toBeChecked();
  });
});
