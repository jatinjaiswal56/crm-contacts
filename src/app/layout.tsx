import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM Contact Workspace",
  description: "A full-stack CRM contacts workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
