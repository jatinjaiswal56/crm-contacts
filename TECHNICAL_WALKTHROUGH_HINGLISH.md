# CRM Project Walkthrough (Hinglish)

Yeh note interview ya review ke time architecture explain karne ke liye hai. Project ko intentionally simple rakha hai, lekin stale updates aur async states ko ignore nahi kiya.

## 1. Code structure

- `ContactsWorkspace` mostly contacts directory ka layout, filters, pagination, selection aur toast dikhata hai.
- `useContactDirectory` contacts/tags fetch karta hai, API response validate karta hai, loading/error state rakhta hai, aur purane requests ko cancel karta hai.
- `ContactDialog` sirf create/edit form, tags, activity aur save/conflict UI handle karta hai.
- API concerns Route Handlers mein hain. Validation `validation.ts` mein, DB queries `repository.ts` mein, aur read composition `service.ts` mein hai.
- Shared Zod schema frontend form aur backend request dono validate karte hain. Har chhoti cheez ke liye extra abstraction nahi banayi.

## 2. API aur server state

- Is single-screen app ke liye TanStack Query add nahi kiya. `useContactDirectory` mein explicit `fetch`, `AbortController`, refresh key aur response parsing kaafi hain. Iska trade-off: shared cache, automatic retries aur background refetch available nahi hain.
- Search/filter change par naya request aata hai; pichla request abort hota hai. Loading ke dauran last successful rows visible rehte hain, error aane par bhi unhe turant blank nahi karte.
- Formik submit ke waqt submit button aur fields disable hote hain. Success par dialog close hota hai aur success toast aata hai; failure par dialog aur entered draft rehta hai.

## 3. Search, filters aur navigation

- Search 300 ms debounce hoti hai; har keystroke par immediate request nahi bhejte.
- Search, company/tag filter, sorting aur page URL search parameters mein rehte hain. URL share/refresh karne par view restore hota hai.
- Search/filter/sort badalne par page reset hota hai, warna user galat empty page par pahunch sakta hai.
- Filtering aur pagination server-side hain; default page size 20 hai.

## 4. Form aur concurrent update

- Formik touched/dirty/submitting state manage karta hai; Zod required fields, email aur 10-digit Indian number validate karta hai.
- Close/cancel/Escape/backdrop se unsaved draft discard karne se pehle confirmation aata hai; tab/browser chhodte waqt `beforeunload` warning hai.
- Contact aur tag save dono `expectedVersion` bhejte hain. Database update mein `id + version` compare hota hai aur successful write version increment karta hai. Mismatch par API `409 Conflict` deta hai.
- Scenario: A aur B dono version 4 kholte hain. B save karke version 5 banata hai. A ka version-4 save reject hota hai. API version 5 ke latest field/tag values bhi bhejta hai.
- A ka draft modal mein rehta hai aur table latest vs draft values compare karta hai. A latest values accept kar sakta hai; ya “Merge my draft onto latest” chune to sirf uske badle fields/tags latest data par apply hote hain. Isse B ke untouched fields aur unrelated tag edits nahi mit-te. Phir A changes review karke dobara Save karta hai.
- Distributed lock nahi hai; optimistic concurrency app ke liye kaafi aur simpler hai.

## 5. Accessibility aur responsive UX

- Inputs ke visible labels, required marker, `aria-invalid`, aur touched error ke liye `aria-describedby` use hote hain.
- Dialog open par initial focus set hota hai, Tab focus dialog ke andar rehta hai, Escape kaam karta hai, aur close hone par purane focus element par wapas jaata hai.
- Loading/success/error ke liye `status`/`alert` roles, busy state aur clear text hai.
- Desktop par table; mobile par contact cards. Pagination panel ke neeche visible rehti hai, contact list apne area mein scroll karti hai.

## 6. React aur code quality

- Hooks component ke top level par hain; async effect cleanup mein `AbortController.abort()` chalta hai.
- List loading ek custom hook mein hai, UI aur DB repository ek hi component mein mix nahi kiye.
- Controlled form/query state use hoti hai. URL query source of truth hai; input draft debounce ke dauran local state mein rehta hai.
- Is scope mein unnecessary global state, generic framework ya query-cache layer avoid ki hai.

## 7. Tests

- Route tests create/update validation, duplicate email/phone, successful update, stale contact version aur stale tag version cover karte hain.
- Pure merge tests check karte hain ki user ka changed field apply ho, lekin latest server ke unchanged-by-user fields aur unrelated tags preserve hon.
- `npm test`, `npm run lint`, aur `npm run typecheck` run karne hain. UI browser verification loading, no-results, conflict compare aur mobile layout ke liye useful hai.
- Test strategy behavior par focused hai; fragile timers ya network timing par depend nahi karna chahiye.

## 8. Performance, trade-offs aur known gaps

- Server pagination aur DB indexes list ko bounded rakhte hain. 20 rows ke liye virtualization zaroori nahi.
- Request cancel karne se obsolete search response state ko replace nahi karta; component mein current results background loading ke dauran rehte hain.
- Auth/roles, offline queue, real-time updates, tag CRUD aur contact delete abhi nahi hain.
- Bulk tag operation multiple contacts par sequential hai, ek atomic transaction nahi. Beech mein conflict aaye to pehle contacts ke writes rollback nahi honge; updated list refresh hoti hai aur error dikhaya jaata hai.
- TanStack Query na use karne ka trade-off: app mein cache persistence/retry/prefetch nahi. Agar list aur API surface bade, TanStack Query use karna natural next step hoga.
