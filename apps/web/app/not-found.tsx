import type { Metadata } from "next";

import { basePath } from "../lib/config.js";

export const metadata: Metadata = {
  alternates: { canonical: null },
  robots: { follow: true, index: false },
  title: "Page not found",
};
export default function NotFound() {
  return (
    <main className="px-(--row-padding) py-20" id="main-content">
      <h1 className="text-4xl font-medium tracking-tight">Page not found</h1>
      <p className="mt-6">This page does not exist.</p>
      <a
        className="mt-4 inline-flex min-h-12 items-center underline"
        href={basePath}
      >
        Return to Taste Lint
      </a>
    </main>
  );
}
