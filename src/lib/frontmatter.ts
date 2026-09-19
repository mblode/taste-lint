// YAML frontmatter slice. The fences are found by hand so `blanked` keeps
// line numbers intact (frontmatter lines become empty lines and mdast
// positions still point at the original file); the mapping itself is parsed
// by the `yaml` dependency the rule loader already uses.

import { parse } from "yaml";

export type Frontmatter = Record<string, string | undefined>;

export interface FrontmatterResult {
  fm: Frontmatter;
  body: string;
  /** The source with frontmatter lines blanked, same length in lines. */
  blanked: string;
  error: string | null;
}

// A BOM becomes a space rather than disappearing, so every offset in
// `blanked` still lines up with the caller's source string.
const stripBom = (text: string): string =>
  text.codePointAt(0) === 0xfe_ff ? ` ${text.slice(1)}` : text;

// Frontmatter consumers read scalars; nested values are kept as JSON text.
const scalar = (value: unknown): string | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    // A folded or literal block keeps its final newline; consumers want the text.
    return value.replace(/\n+$/u, "");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
};

export const parseFrontmatter = (text: string): FrontmatterResult => {
  const src = stripBom(text);
  const lines = src.split("\n");
  if (lines.length === 0 || lines[0].trim() !== "---") {
    return { blanked: src, body: src, error: "missing opening fence", fm: {} };
  }
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    return { blanked: src, body: src, error: "missing closing fence", fm: {} };
  }
  const blanked = [
    ...Array.from({ length: closeIdx + 1 }, () => ""),
    ...lines.slice(closeIdx + 1),
  ].join("\n");
  const body = lines.slice(closeIdx + 1).join("\n");
  const fm: Frontmatter = {};
  let problem: string | null = null;
  try {
    const parsed: unknown = parse(lines.slice(1, closeIdx).join("\n"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      for (const [key, value] of Object.entries(parsed)) {
        fm[key] = scalar(value);
      }
    } else if (parsed !== null && parsed !== undefined) {
      problem = "frontmatter is not a mapping";
    }
  } catch (error) {
    problem = `frontmatter did not parse: ${(error as Error).message}`;
  }
  return { blanked, body, error: problem, fm };
};
