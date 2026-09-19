// Dependency-free YAML frontmatter slice. Handles plain scalars, quoted
// strings and block scalars. `blanked` keeps line numbers intact by
// replacing frontmatter lines with empty lines, so mdast positions still
// point at the original file.

export type Frontmatter = Record<string, string | undefined>;

export interface FrontmatterResult {
  fm: Frontmatter;
  body: string;
  /** The source with frontmatter lines blanked, same length in lines. */
  blanked: string;
  error: string | null;
}

const stripBom = (text: string): string =>
  text.codePointAt(0) === 0xfe_ff ? text.slice(1) : text;

const parseScalar = (raw: string): string => {
  const v = raw.trim();
  if (v.length >= 2) {
    const [first] = v;
    const last = v.at(-1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return v.slice(1, -1);
    }
  }
  return v;
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
  const fmLines = lines.slice(1, closeIdx);
  const fm: Frontmatter = {};
  for (let i = 0; i < fmLines.length; i += 1) {
    const line = fmLines[i];
    if (line.trim() === "" || /^\s*#/.test(line)) {
      continue;
    }
    const m = line.match(/^([A-Za-z0-9_-]+):(.*)$/);
    if (!m) {
      continue;
    }
    const [, key, rest] = m as [string, string, string];
    const trimmedRest = rest.trim();
    if (/^[>|][+-]?\s*$/.test(trimmedRest)) {
      const folded = trimmedRest[0] === ">";
      const block: string[] = [];
      let j = i + 1;
      for (; j < fmLines.length; j += 1) {
        const bl = fmLines[j];
        if (bl.trim() === "") {
          block.push("");
          continue;
        }
        if (/^\s/.test(bl)) {
          block.push(bl.replace(/^\s+/, ""));
        } else {
          break;
        }
      }
      while (block.length && block.at(-1) === "") {
        block.pop();
      }
      fm[key] = folded
        ? block.join(" ").replaceAll(/\s+/gu, " ").trim()
        : block.join("\n");
      i = j - 1;
      continue;
    }
    fm[key] = parseScalar(rest);
  }
  const blanked = [
    ...Array.from({ length: closeIdx + 1 }, () => ""),
    ...lines.slice(closeIdx + 1),
  ].join("\n");
  return {
    blanked,
    body: lines.slice(closeIdx + 1).join("\n"),
    error: null,
    fm,
  };
};
