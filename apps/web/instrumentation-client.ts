import type { CaptureResult } from "posthog-js";
import { posthog } from "posthog-js";

// [placeholder] Set NEXT_PUBLIC_POSTHOG_KEY (the project API key, phc_...)
// and NEXT_PUBLIC_POSTHOG_HOST in Vercel. The sibling sites hardcode their
// key; this zone has none yet, so analytics stay off until the env var lands.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

const isLocalHost = () => {
  const host = window.location.hostname;
  return (
    host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")
  );
};

const EXTENSION_EXCEPTION_MARKERS = [
  "runtime.sendMessage",
  "Extension context invalidated",
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "safari-web-extension://",
  "adoptedStyleSheets",
  "WNAdoptedStylesManager",
  "_makeContainerForSrcDocIFrame",
];

const NOISE_MESSAGE_MARKERS = [
  "AbortError",
  "The user aborted a request",
  "NetworkError",
  "A network error occurred",
  "Script error.",
  "Internal Next.js error",
];

const matchesMarker = (value: unknown, markers: string[]) =>
  typeof value === "string" && markers.some((m) => value.includes(m));

const isNextClientFrame = (value: unknown) =>
  typeof value === "string" && value.includes("node_modules/next/dist/client");

const isNoisyException = (event: CaptureResult): boolean => {
  if (event.event !== "$exception") {
    return false;
  }
  const exceptions = event.properties?.$exception_list;
  if (!Array.isArray(exceptions)) {
    return false;
  }
  return exceptions.some((exception) => {
    if (
      matchesMarker(exception?.value, EXTENSION_EXCEPTION_MARKERS) ||
      matchesMarker(exception?.type, EXTENSION_EXCEPTION_MARKERS) ||
      matchesMarker(exception?.value, NOISE_MESSAGE_MARKERS) ||
      matchesMarker(exception?.type, NOISE_MESSAGE_MARKERS)
    ) {
      return true;
    }
    const frames = exception?.stacktrace?.frames;
    return (
      Array.isArray(frames) &&
      frames.some(
        (frame: { abs_path?: unknown; filename?: unknown }) =>
          matchesMarker(frame?.filename, EXTENSION_EXCEPTION_MARKERS) ||
          matchesMarker(frame?.abs_path, EXTENSION_EXCEPTION_MARKERS) ||
          isNextClientFrame(frame?.filename) ||
          isNextClientFrame(frame?.abs_path)
      )
    );
  });
};

if (key && !isLocalHost()) {
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    before_send: (event) => {
      if (event && isNoisyException(event)) {
        return null;
      }
      return event;
    },
    defaults: "2026-05-30",
    ui_host: "https://us.posthog.com",
  });
}
