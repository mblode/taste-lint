// Live proof for the landing page, fetched on the server and cached for a
// day. Every helper fails closed: any network, status or shape problem
// returns null and the stat is not rendered. Never substitute a number.

const DAY = 86_400;
const TIMEOUT_MS = 5000;

const getJson = async (url: string): Promise<unknown> => {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "taste-lint-web" },
      next: { revalidate: DAY },
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

const numberField = (data: unknown, field: string): number | null => {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const value = (data as Record<string, unknown>)[field];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
};

export const fetchGithubStars = async (repo: string): Promise<number | null> =>
  numberField(
    await getJson(`https://api.github.com/repos/${repo}`),
    "stargazers_count"
  );

export const fetchNpmWeeklyDownloads = async (
  pkg: string
): Promise<number | null> =>
  numberField(
    await getJson(`https://api.npmjs.org/downloads/point/last-week/${pkg}`),
    "downloads"
  );
