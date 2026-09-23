// Live proof for the landing page, fetched on the server and cached for a
// day (a miss for minutes). Every helper fails closed: any network, status or shape problem
// returns null and the stat is not rendered. Never substitute a number.

import { cacheLife } from "next/cache";

const TIMEOUT_MS = 5000;

const numberField = (data: unknown, field: string): number | null => {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const value = (data as Record<string, unknown>)[field];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
};

const readJson = async (url: string): Promise<unknown> => {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "taste-lint-web" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
};

// A number is kept for a day (`days`: revalidate 1 day), so the landing page
// keeps it in the static shell. A miss is cached for minutes only, so one
// failed request does not hide a stat for a whole day.
const fetchNumber = async (
  url: string,
  field: string
): Promise<number | null> => {
  "use cache";
  const value = numberField(await readJson(url), field);
  if (value === null) {
    cacheLife("minutes");
  } else {
    cacheLife("days");
  }
  return value;
};

export const fetchGithubStars = (repo: string): Promise<number | null> =>
  fetchNumber(`https://api.github.com/repos/${repo}`, "stargazers_count");

export const fetchNpmWeeklyDownloads = (pkg: string): Promise<number | null> =>
  fetchNumber(
    `https://api.npmjs.org/downloads/point/last-week/${pkg}`,
    "downloads"
  );
