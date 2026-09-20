import { baseClass } from "../reduce/mechanical.js";

// Candidate extraction only. Jev decides whether the styling merits review.
export const literalArbitraryValues = (classes: string[]): string[] =>
  classes.filter((className) => {
    const value = baseClass(className)
      .match(/^-?[\w-]+-\[(.+?)\](?:\/[^\s]+)?!?$/u)?.[1]
      ?.replace(/^(?:length|color):/u, "");
    if (
      !value ||
      /var\(|env\(|theme\(|^--|^(?:calc|min|max|clamp|minmax|repeat|url)\(/u.test(
        value
      )
    ) {
      return false;
    }
    return (
      /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|ms|s|deg)?$/u.test(value) ||
      /^#[\da-f]{3,8}$/iu.test(value) ||
      /^(?:rgb|rgba|hsl|hsla|oklab|oklch|color)\(/u.test(value)
    );
  });
