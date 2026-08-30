import type { Metadata } from "next";
import ThemeRegistry from "@/lib/ThemeRegistry";
import AppProviders from "@/lib/AppProviders";

export const metadata: Metadata = {
  title: "Email Scheduler | Outbox Labs",
  description: "ReachInbox assignment: production-grade email job scheduler",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <AppProviders>{children}</AppProviders>
        </ThemeRegistry>
      </body>
    </html>
  );
}
