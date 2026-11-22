# CRM Contacts

A responsive contacts directory with a Next.js UI and REST API, PostgreSQL-compatible storage, search, filters, pagination, tags, bulk tagging, an activity log, and optimistic concurrency protection.

## Run locally

Requirements: Node.js 24 (see `.nvmrc`), npm, and a PostgreSQL connection. For local development the project includes PGlite, a PostgreSQL-compatible engine that runs in-process.

```bash
npm install
cp .env.example .env.local
```

`.env.example` already points at the bundled PGlite server (`postgresql://postgres:postgres@127.0.0.1:5432/postgres`). For a standard PostgreSQL database, set `DATABASE_URL` in `.env.local` to its connection string instead of starting PGlite. Keep `.env.local` private.

Start the local database in one terminal:

```bash
npm run db:start
```

In another terminal, apply migrations, seed sample data, and run the app:

```bash
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Next.js Route Handlers serve the API from the same app; the database is the only separate service.

The seed script uses `onConflictDoNothing`, so re-running `npm run db:setup` does not replace existing sample contacts. To reload the sample data (for example, to get the valid `+91` sample phone numbers), stop the database, back up anything you need, delete `data/pglite`, and run `npm run db:setup` again.

## Commands

```bash
npm run lint
npm run typecheck   # generates Next route types, then runs tsc
npm run test:unit   # unit + UI tests (jsdom), no database needed
npm run test:api    # route tests, need a migrated and seeded database
npm test            # both of the above
npm run build       # does not need DATABASE_URL
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit/UI tests, then starts a PostgreSQL service, runs `db:setup` and the API tests, and finally builds.

## Tech stack

- Next.js App Router, React, and TypeScript
- Next.js Route Handlers for REST endpoints
- PostgreSQL / local PGlite, Drizzle ORM, and SQL migrations
- Zod for request and form validation; Formik for form state
- Vitest with Testing Library and jsdom

## Structure and technical decisions

```
src/
├── app/                        # routing only: page.tsx, layout.tsx, globals.css
│   └── api/                    # REST route handlers (route.ts per URL)
├── features/contacts/          # everything for the contacts screen
│   ├── components/
│   │   ├── workspace/          # ContactsWorkspace (URL state + wiring), headers
│   │   ├── filters/            # search, company, tag, sort
│   │   ├── table/              # table / mobile cards, pagination
│   │   ├── bulk-tags/          # bulk tag toolbar
│   │   └── dialog/             # create/edit dialog, fields, tag picker, conflict panel, activity
│   ├── hooks/                  # useContactDirectory, useBulkTagging, useContactSubmit, ...
│   ├── requests/               # browser -> API calls (contact-requests.ts)
│   └── utils/                  # stored value <-> form value mapping
├── components/ui/              # reusable UI: Toast, shared styles
├── hooks/                      # reusable hooks: useToast, useFocusTrap, useUnsavedChangesGuard
└── lib/                        # shared + server: validation, normalization, repository, db, API helpers
```

- **Page wiring.** `features/contacts/components/workspace/contacts-workspace.tsx` owns URL state (search, filters, sort, page) and wires it to presentational components: `ContactFilters`, `ContactsTable`, `PaginationBar`, `BulkTagToolbar`, `Toast`. Each component has its own CSS module; `src/components/ui/shared.module.css` holds the few cross-component utilities.
- **Data hooks.** `useContactDirectory` owns directory and tag reads, response validation, cancellation, and loading/error state. `useBulkTagging` owns row selection and bulk tag writes. `useQueryDraft` keeps input drafts in sync with the URL.
- **Dialog.** `ContactDialog` composes `ContactFields`, `TagPicker`, `ConflictPanel`, and `ActivityList`. Behavior lives in hooks: `useContactSubmit` (save flow), `useFocusTrap`, `useUnsavedChangesGuard`, and `useContactActivity`. Requests and response parsing are in `features/contacts/requests/contact-requests.ts`.
- **API.** Route Handlers validate HTTP input and map outcomes to status codes. `src/lib/contacts/service.ts` composes reads; `repository.ts` owns queries and transactions; `normalize.ts` is the single home for email/phone normalization. The DB client connects lazily on first use.
- **URL as source of truth.** Search is debounced by 300 ms. Search, filters, sort, and page live in URL parameters, so views are shareable and survive refresh. Changing filters or sort resets the page. The client sanitizes URL params before calling the API, so a bad `page` or `sort` in a shared link still loads the list. The API ignores unknown params such as `utm_source`.
- **Filtering.** Search matches name, email, and company. The company filter is a case-insensitive partial match. The tag filter matches a tag's normalized name.
- **Server state.** `useContactDirectory` cancels superseded fetches with `AbortController`. Existing rows stay visible while a request is in flight, and failures are shown without discarding the last successful result.
- **Why no TanStack Query.** This is a single-screen app with few query types, so a custom fetch hook was chosen instead. It provides explicit cancellation and refresh, but no shared cache, retries, or background refetching. If the API surface grows, TanStack Query is the natural next step.
- **Forms.** Formik manages create/edit state, and shared Zod schemas validate both client and API input. On a failed submit, a summary ("Fix N fields to save") is announced and focus moves to the first invalid field. Failed saves keep the dialog and draft open; successful saves show a toast.
- **Normalization.** Email and phone are normalized and uniquely indexed. Phone input accepts ten digits starting with 6–9 and stores a `+91` display value plus a digits-only comparison key.
- **Pagination.** Lists are paginated on the server (20 rows by default, API maximum 100) using offset pagination.
- **Indexes.** Name sort, created-date sort, normalized email/phone/tag uniqueness, tag lookups, and activity are indexed. The `ILIKE '%…%'` search and company filter cannot use a B-tree index and scan the table; at larger scale, a `pg_trgm` trigram index is the next step.

## Bulk tagging

Select contacts on the current page, choose tags, and pick a mode:

- **Add tags** merges the chosen tags into each contact's existing tags and never removes any. Apply is disabled until at least one tag is chosen.
- **Replace tags** sets each contact's tags to exactly the chosen set. Replacing with no tags asks for confirmation first ("Remove all tags from N contacts?").

Contacts whose tags would not change are skipped, so their version is not bumped. Updates are sequential, not one atomic transaction. If one fails, the run stops and reports "Updated X of Y. Stopped at <name>: <reason>". The failed and remaining contacts stay selected, and the list refreshes if anything changed. Changing page, filters, or sort clears the selection.

## API errors

Errors use the shape `{ "error": { "code", "message" } }`.

| Status | Code | When |
| --- | --- | --- |
| 400 | `INVALID_JSON` | The request body is not valid JSON |
| 400 | `VALIDATION_ERROR` | The body or query fails schema validation |
| 404 | `NOT_FOUND` | The contact does not exist |
| 409 | `VERSION_CONFLICT` | `expectedVersion` is stale; the response also includes `latest` |
| 409 | `DUPLICATE_CONTACT` | The normalized email or phone already belongs to another contact |
| 422 | `INVALID_TAGS` | One or more tag ids do not exist |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected failure (details are logged server-side) |

`POST` and `PATCH` return the saved contact including its tags.

## Data model

- `contacts`: identity and company fields, normalized email/phone keys, timestamps, and an integer `version`.
- `tags`: tag names and a normalized unique name.
- `contact_tags`: many-to-many contact/tag assignments with a composite primary key.
- `contact_activities`: timestamped events with JSON metadata:
  - `CONTACT_CREATED`
  - `CONTACT_UPDATED`, with the fields that actually changed and the previous and new version
  - `TAG_ADDED` / `TAG_REMOVED`, with the tag id and name

## Concurrent updates

Each contact mutation includes the version observed when editing began. The API updates with a compare-and-swap condition (`id` plus expected `version`) and increments the version in the same transaction. If another user has already changed the contact, it returns `409 VERSION_CONFLICT`. Tag replacement uses the same check, so a stale tag-only edit cannot silently replace newer tags.

On conflict, the API includes the latest server record. The dialog keeps the user's draft and shows it next to the current values. The user can load the latest version, or merge their changed fields and tags onto it and save again. The merge preserves untouched fields and tags changed by the other user.

## Important states and accessibility

- Loading, empty and no-results, "no contacts on this page", invalid form, API failure, activity failure, save success, and conflict states are all shown explicitly.
- Search results remain visible during background loading, and obsolete requests are aborted.
- Success toasts dismiss themselves after 5 seconds. Error toasts stay until dismissed and use `role="alert"`.
- Inputs have labels and linked validation messages. The dialog sets initial focus, traps keyboard focus, restores focus on close, supports Escape, and warns before discarding unsaved changes. Tag pickers use a fieldset and legend with checkboxes.
- On narrow screens, the directory switches from table rows to contact cards. Pagination stays fixed and the list scrolls internally.

## Tests

- `tests/unit`: pure logic, including normalization, query sanitizing, conflict merge, API error parsing, response helpers, Zod-to-Formik mapping, and bulk tag computation.
- `tests/ui`: the directory hook (loading, errors, stale responses, abort), the workspace (debounced search, filters, pagination, empty states, error banner, bulk add/replace and partial failure, typing during URL updates), and the dialog (validation, double submit, conflicts and merge, discard confirmation, focus, Escape).
- `tests/api`: route handlers against a real database, including validation, invalid JSON, duplicates, version conflicts, invalid tags, missing resources, and concurrent updates. PGlite may serialize connections, so the concurrency test is most meaningful against real PostgreSQL in CI.

## Known gaps

- No authentication or authorization.
- No tag create/rename/delete, and no contact deletion.
- Offset pagination: rows can shift between pages while data changes. Keyset pagination would fix this at scale.
- Bulk tagging is sequential and can partially succeed (reported as described above).
- No offline queue or real-time updates.

## Further reading

- [docs/TECHNICAL_REVIEW.html](./docs/TECHNICAL_REVIEW.html): concise answers to the review checklist.
- [docs/TECHNICAL_WALKTHROUGH_HINGLISH.md](./docs/TECHNICAL_WALKTHROUGH_HINGLISH.md): a fuller walkthrough in Hinglish.
