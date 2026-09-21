import { renderZoneOgImage } from "./og-image-shared.js";

export {
  OG_CONTENT_TYPE as contentType,
  OG_SIZE as size,
} from "./og-image-shared.js";
export const alt = "Taste Lint";
export default function OpengraphImage() {
  return renderZoneOgImage({
    background: "#fbb6cd",
    color: "#8b1a0a",
    logo: null,
    title: "Taste Lint",
  });
}
