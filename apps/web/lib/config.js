export const basePath = "/taste-lint";
/** @param {string} path Zone-relative asset path. */
export const asset = (path) => `${basePath}${path}`;
export const siteConfig = {
  author: { name: "Matthew Blode", url: "https://blode.co" },
  description:
    "Taste Lint checks the empty states, error messages, labels, type and motion in your source, against 174 rules from Taste Training and Agent Skills.",
  links: {
    author: "https://blode.co",
    docs: `${basePath}/docs`,
    github: "https://github.com/mblode/taste-lint",
    license: "https://github.com/mblode/taste-lint/blob/main/LICENSE.md",
    npm: "https://www.npmjs.com/package/taste-lint",
  },
  name: "Taste Lint",
  title: "Taste Lint: UI and copy linter for AI-generated code",
  url: `https://blode.co${basePath}`,
};
