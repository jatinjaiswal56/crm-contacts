# CRM Contacts

A responsive contacts directory with a Next.js UI and REST API, PostgreSQL-compatible storage, search, filters, pagination, tags, and optimistic concurrency protection.

## Run locally

Requirements: Node.js 24, npm, and a PostgreSQL connection. For local development, this project includes PGlite, a PostgreSQL-compatible engine that runs locally.

```bash
npm install
cp .env.example .env.local
```

Set `DATABASE_URL` in `.env.local` (the example uses `postgresql://postgres:postgres@127.0.0.1:5432/postgres`). Keep `.env.local` private.

Start the local database in one terminal:

```bash
npm run db:start
```

In another terminal, apply migrations, seed sample data, and run the frontend and API:

```bash
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Next.js Route Handlers serve the backend API from the same app; the database is the only separate local service. For a standard PostgreSQL database, set `DATABASE_URL` to its connection string instead of starting PGlite.

Useful commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Tech stack

- Next.js App Router, React, and TypeScript
- Next.js Route Handlers for REST endpoints
- PostgreSQL / local PGlite, Drizzle ORM, and SQL migrations
- Zod for request and form validation; Formik for form state
- Vitest for API and domain behavior tests

## Structure and technical decisions

- `src/app/contacts-workspace.tsx` focuses on the directory UI, URL controls, selection, and user feedback. `use-contact-directory.ts` owns directory/tag reads, response validation, cancellation, and loading/error state.
- Route Handlers validate HTTP input and map outcomes to status codes. `src/lib/contacts/service.ts` composes domain reads; `repository.ts` owns database queries and transactions.
- Search is debounced by 300 ms. Search, filters, sorting, and page are kept in URL parameters. Changing filters or sort resets the page.
- `useContactDirectory` cancels superseded fetches with `AbortController`. Existing rows stay visible while a request is in flight; request failures are shown without discarding the last successful result.
- A custom fetch hook is used instead of TanStack Query because this is a small, single-screen app with a small number of query types. It provides explicit cancellation and refresh behavior, but does not provide a shared cache, retries, or background refetching.
- Formik manages create/edit form state and shared Zod schemas validate both client and API input. Failed saves keep the dialog and draft open; successful saves show a toast.
- Email and phone are normalized and uniquely indexed. Indian phone input accepts ten digits beginning with 6–9 and stores a `+91` display value plus a digits-only comparison key.
- Data is paginated on the server (20 rows by default, API maximum 100). Database indexes support normalized uniqueness, name/company lookup, created-date sorting, tags, and activity.

## Data model

- `contacts`: identity and company fields, normalized email/phone keys, timestamps, and an integer `version`.
- `tags`: tag names and a normalized unique name.
- `contact_tags`: many-to-many contact/tag assignments with a composite primary key.
- `contact_activities`: timestamped contact and tag changes with JSON metadata.

## Concurrent updates

Each contact mutation includes the version observed when editing began. The API updates with a compare-and-swap condition (`id` plus expected `version`), increments the version in the same transaction, and returns `409 Conflict` if another user has already changed it. Tag replacement uses the same version check, so a stale tag-only edit cannot silently replace newer tags.

On conflict, the API includes the latest server record. The dialog keeps the user's draft and compares it with the current values. The user can load the latest version or merge their changed fields/tag changes onto it and then save again. Untouched fields and tags changed by the other user are preserved by that merge.

## Important states and accessibility

- Loading, empty/no-results, invalid-form, API failure, activity failure, save success, and conflict states are presented explicitly.
- Search results remain visible during background loading, and obsolete requests are aborted.
- Inputs have labels and validation descriptions; dialogs manage initial focus, trap keyboard focus, restore focus on close, support Escape, and warn before discarding unsaved changes.
- On narrow screens, the directory switches from wide rows to contact cards while pagination remains fixed and the list scrolls internally.

## Verification

With the database configured and seeded, `npm test` runs deterministic route/domain tests, including validation, duplicate handling, optimistic version conflicts, and draft merge behavior. Run `npm run lint` and `npm run typecheck` for static checks.

For a fuller checklist explanation in Hinglish, see [TECHNICAL_WALKTHROUGH_HINGLISH.md](./TECHNICAL_WALKTHROUGH_HINGLISH.md). A concise HTML version is available at [TECHNICAL_REVIEW.html](./TECHNICAL_REVIEW.html).
