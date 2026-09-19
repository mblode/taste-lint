import { expect, it } from "vitest";

import { parseFrontmatter } from "../lib/frontmatter.js";

it("blanks frontmatter lines without moving the body", () => {
  const src =
    "---\ntitle: X\ndescription: >\n  folded\n  text\n---\n\n# Heading\n";
  const result = parseFrontmatter(src);
  expect(result.fm).toEqual({ description: "folded text", title: "X" });
  expect(result.blanked.split("\n").length).toBe(src.split("\n").length);
  expect(result.blanked.split("\n")[7]).toBe("# Heading");
});

it("reports a missing fence", () => {
  expect(parseFrontmatter("no fence").error).toBe("missing opening fence");
  expect(parseFrontmatter("---\ntitle: x\n").error).toBe(
    "missing closing fence"
  );
});
