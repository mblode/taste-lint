import type { CaptureResult } from "posthog-js";

import { setAnalyticsClient } from "./lib/conversion-events.js";

// Same public project key as the other blode.co zones, so taste-lint events
// land next to diffhub, edda and the rest. The env var overrides it.
const key =
  process.env.NEXT_PUBLIC_POSTHOG_KEY ??
  "phc_yYatHXysbRxjTyfmyCKSUyMSQpgepJPuxegz2HtpfX35";

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

const start = async () => {
  try {
    const { posthog } = await import("posthog-js");
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
    setAnalyticsClient(posthog);
  } catch {
    // Analytics must never break the page; a blocked script is fine.
  }
};

// PostHog is ~300 KB of script. Loading it after the load event, once the
// main thread is idle, keeps it off the path to the first paint and the LCP.
const whenIdle = () => {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(start, { timeout: 4000 });
  } else {
    setTimeout(start, 1);
  }
};

if (key && !isLocalHost()) {
  if (document.readyState === "complete") {
    whenIdle();
  } else {
    window.addEventListener("load", whenIdle, { once: true });
  }
}
