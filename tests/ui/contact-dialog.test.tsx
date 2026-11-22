// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContactDialog,
  type EditableContact,
} from "@/features/contacts/components/dialog/contact-dialog";

const availableTags = [
  { id: "vip", name: "VIP", nameNormalized: "vip" },
];

const baseContact: EditableContact = {
  id: "contact-1",
  firstName: "Alex",
  lastName: "Rao",
  email: "alex@example.com",
  phone: "+91 9876543210",
  company: "Original Co",
  version: 1,
  tags: [],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function mockActivityAndResponse(
  mutationResponse: Response,
  fetchMock = vi.fn((input: RequestInfo | URL) =>
    String(input).endsWith("/activity")
      ? Promise.resolve(jsonResponse({ items: [] }))
      : Promise.resolve(mutationResponse),
  ),
) {
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ContactDialog", () => {
  it("shows required and phone errors on submit and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ContactDialog
        contact={null}
        tags={availableTags}
        open
        onClose={vi.fn()}
        onError={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: "10-digit Indian mobile number" }),
      "123",
    );
    await user.click(screen.getByRole("button", { name: "Save contact" }));

    expect(await screen.findByText("First name is required")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Enter a valid 10-digit Indian mobile number starting with 6–9",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: /^First name/ }),
      ).toHaveFocus(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("prevents a second save while the first submission is pending", async () => {
    const user = userEvent.setup();
    const pendingResponse = deferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      String(input).endsWith("/activity")
        ? Promise.resolve(jsonResponse({ items: [] }))
        : pendingResponse.promise,
    );
    vi.stubGlobal("fetch", fetchMock);
    const onClose = vi.fn();
    render(
      <ContactDialog
        contact={null}
        tags={availableTags}
        open
        onClose={onClose}
        onError={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "First name" }), "Ava");
    await user.type(screen.getByRole("textbox", { name: "Last name" }), "Rao");
    await user.type(screen.getByRole("textbox", { name: "Email" }), "ava@example.com");
    await user.type(
      screen.getByRole("textbox", { name: "10-digit Indian mobile number" }),
      "9876543210",
    );
    await user.type(screen.getByRole("textbox", { name: "Company" }), "Acme");

    const saveButton = screen.getByRole("button", { name: "Save contact" });
    await user.click(saveButton);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Saving…" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    pendingResponse.resolve(
      jsonResponse({
        item: {
          id: "created-contact",
          firstName: "Ava",
          lastName: "Rao",
          email: "ava@example.com",
          phone: "+91 9876543210",
          company: "Acme",
          version: 1,
        },
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("shows a comparison table for VERSION_CONFLICT responses", async () => {
    const user = userEvent.setup();
    const latest = {
      ...baseContact,
      firstName: "Alexander",
      company: "Remote Co",
      version: 2,
      tags: [],
    };
    const fetchMock = mockActivityAndResponse(
      jsonResponse(
        {
          error: {
            code: "VERSION_CONFLICT",
            message: "This contact changed on another device.",
          },
          latest,
        },
        409,
      ),
    );
    render(
      <ContactDialog
        contact={baseContact}
        tags={availableTags}
        open
        onClose={vi.fn()}
        onError={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.clear(screen.getByRole("textbox", { name: "First name" }));
    await user.type(screen.getByRole("textbox", { name: "First name" }), "Alec");
    await user.click(screen.getByRole("button", { name: "Save contact" }));

    expect(
      await screen.findByText("This contact changed while you were editing"),
    ).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveTextContent("Your draft");
    expect(screen.getByRole("table")).toHaveTextContent("Latest server value");
    expect(screen.getByRole("table")).toHaveTextContent("Alec");
    expect(screen.getByRole("table")).toHaveTextContent("Alexander");
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/contacts/${baseContact.id}`,
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("merges the draft while keeping untouched server fields", async () => {
    const user = userEvent.setup();
    const latest = {
      ...baseContact,
      lastName: "Rao",
      company: "Remote Co",
      version: 2,
      tags: [],
    };
    mockActivityAndResponse(
      jsonResponse(
        {
          error: {
            code: "VERSION_CONFLICT",
            message: "This contact changed on another device.",
          },
          latest,
        },
        409,
      ),
    );
    render(
      <ContactDialog
        contact={baseContact}
        tags={availableTags}
        open
        onClose={vi.fn()}
        onError={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    await user.clear(screen.getByRole("textbox", { name: "First name" }));
    await user.type(screen.getByRole("textbox", { name: "First name" }), "Alec");
    await user.click(screen.getByRole("button", { name: "Save contact" }));
    await screen.findByText("This contact changed while you were editing");
    await user.click(
      screen.getByRole("button", { name: "Merge my draft onto latest" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "First name" })).toHaveValue(
        "Alec",
      );
      expect(screen.getByRole("textbox", { name: "Company" })).toHaveValue(
        "Remote Co",
      );
    });
    expect(screen.getByRole("textbox", { name: "Last name" })).toHaveValue(
      "Rao",
    );
    expect(
      screen.queryByText("This contact changed while you were editing"),
    ).not.toBeInTheDocument();
  });

  it("asks before discarding unsaved changes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <ContactDialog
        contact={baseContact}
        tags={availableTags}
        open
        onClose={onClose}
        onError={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await user.type(screen.getByRole("textbox", { name: "First name" }), "X");

    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledWith(
      "You have unsaved changes. Discard them and close?",
    );
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has an accessible name, focuses its first field, closes on Escape, and restores focus", async () => {
    const user = userEvent.setup();

    function DialogOpener() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open contact dialog
          </button>
          <ContactDialog
            contact={null}
            tags={availableTags}
            open={open}
            onClose={() => setOpen(false)}
            onError={vi.fn()}
            onSaved={vi.fn()}
          />
        </>
      );
    }

    render(<DialogOpener />);
    const opener = screen.getByRole("button", { name: "Open contact dialog" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Create contact" });
    expect(screen.getByRole("textbox", { name: "First name" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(opener).toHaveFocus();
  });
});
