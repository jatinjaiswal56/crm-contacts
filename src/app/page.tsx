import { Suspense } from "react";
import { ContactsWorkspace } from "./contacts-workspace";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="page-loading" aria-live="polite">
          Loading contacts workspace…
        </main>
      }
    >
      <ContactsWorkspace />
    </Suspense>
  );
}
