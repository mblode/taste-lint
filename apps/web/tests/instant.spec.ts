import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

// The landing page is the only App Router page users land on. Its links to
// /taste-lint/docs are plain anchors to the zone proxy (a document load, not
// a client navigation), so the page load is the navigation to guard.
test.describe("Landing page (/taste-lint)", () => {
  test("is instant on an initial page load", async ({ baseURL, page }) => {
    await instant(
      page,
      async () => {
        await page.goto("/taste-lint");
        await expect(page.locator("h1")).toHaveText(
          "Catch AI slop before you ship"
        );
        // The playground, rule list and FAQ ship in the static shell, not
        // behind a fallback.
        await expect(
          page.getByRole("heading", { name: "Try it on your copy" })
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: /rules\. \d+ can fail your build/ })
        ).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Questions" })
        ).toBeVisible();
        await expect(
          page.getByRole("link", { name: "Read the setup guide" }).first()
        ).toHaveAttribute("href", "/taste-lint/docs");
      },
      { baseURL }
    );
  });
});
