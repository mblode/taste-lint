// Run this function in the browser's read-only evaluation surface, after fonts
// have loaded. Save the return value as styles.json. It does not navigate or edit.
export function captureTastePage(state) {
  const root = document.body;
  const nodes = [root, ...root.querySelectorAll("*")];
  const ids = new Map(nodes.map((element, index) => [element, `e${index}`]));
  const hidden = new Map();
  const properties = [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "letter-spacing",
    "text-transform",
    "color",
    "background-color",
    "text-wrap",
    "font-synthesis",
    "font-variant-numeric",
    "transition-property",
    "transition-duration",
    "animation-name",
    "animation-duration",
    "display",
    "visibility",
    "opacity",
    "content-visibility",
    "clip",
    "clip-path",
  ];
  const selector = (element) => {
    if (element === root) {
      return "body";
    }
    const parent = element.parentElement;
    const index = [...parent.children].indexOf(element) + 1;
    return `${selector(parent)} > ${element.tagName.toLowerCase()}:nth-child(${index})`;
  };
  const elements = Object.fromEntries(
    nodes.map((element) => {
      const style = window.getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      const id = ids.get(element);
      const concealed =
        hidden.get(element.parentElement) ||
        style.display === "none" ||
        style.opacity === "0" ||
        style.contentVisibility === "hidden";
      hidden.set(element, concealed);
      return [
        id,
        {
          attributes: Object.fromEntries(
            [...element.attributes].map((attr) => [attr.name, attr.value])
          ),
          boundingBox: {
            bottom: bounds.bottom,
            height: bounds.height,
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            width: bounds.width,
            x: bounds.x,
            y: bounds.y,
          },
          children: [...element.children]
            .map((child) => ids.get(child))
            .filter(Boolean),
          classList: [...element.classList],
          id,
          parentId: ids.get(element.parentElement) ?? null,
          selector: selector(element),
          styles: Object.fromEntries(
            properties.map((property) => [
              property,
              style.getPropertyValue(property),
            ])
          ),
          tagName: element.tagName.toLowerCase(),
          text: [...element.childNodes]
            .filter((node) => node.nodeType === 3)
            .map((node) => node.textContent)
            .join(" ")
            .trim(),
          visible:
            !concealed &&
            style.visibility === "visible" &&
            bounds.width > 0 &&
            bounds.height > 0 &&
            style.clip.replaceAll(" ", "") !== "rect(0px,0px,0px,0px)" &&
            style.clipPath !== "inset(50%)",
        },
      ];
    })
  );
  return {
    elements,
    metadata: {
      capturedAt: new Date().toISOString(),
      state,
      title: document.title,
      url: window.location.href,
      viewport: { height: window.innerHeight, width: window.innerWidth },
    },
    order: [...ids.values()],
    rootElementId: "e0",
    rootOuterHtml: document.body.outerHTML,
    version: 1,
  };
}
