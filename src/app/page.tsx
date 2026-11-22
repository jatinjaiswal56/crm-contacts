import { Suspense } from "react";
import { ContactsWorkspace } from "@/features/contacts/components/workspace/contacts-workspace";

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
