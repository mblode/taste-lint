import type { PostHog } from "posthog-js";

/**
 * The shared landing-page event contract. Names match the other blode.co
 * zones (diffhub, Taste Training, blode-co) so one funnel covers every site.
 * `instrumentation-client.ts` loads PostHog after the page is idle, so the
 * library stays out of the first-paint bundle. Events captured before then
 * wait in a short queue; on localhost PostHog never loads and they are dropped.
 */
const SITE = "taste-lint";
const MAX_PENDING = 50;

let client: PostHog | null = null;
const pending: [string, Record<string, unknown>][] = [];

/** Called once PostHog has initialised; flushes anything captured earlier. */
export const setAnalyticsClient = (next: PostHog) => {
  client = next;
  for (const [event, properties] of pending.splice(0)) {
    next.capture(event, properties);
  }
};

interface ConversionClick {
  href: string;
  label: string;
  /** Where on the page the control sits, such as `hero` or `cta-close`. */
  location: string;
}

/**
 * `$pathname` / `$current_url` so a funnel can join this click to
 * `$pageview`. This app's basePath is `/taste-lint`, so
 * `window.location.pathname` already includes it.
 */
const pageLocation = ():
  | { $current_url: string; $pathname: string }
  | Record<string, never> => {
  if (typeof window === "undefined") {
    return {};
  }
  return {
    $current_url: `${window.location.origin}${window.location.pathname}`,
    $pathname: window.location.pathname,
  };
};

// Analytics must never fail a click, a copy or a disclosure.
const capture = (event: string, properties: Record<string, unknown>) => {
  try {
    const payload = { site: SITE, ...properties, ...pageLocation() };
    if (client) {
      client.capture(event, payload);
    } else if (pending.length < MAX_PENDING) {
      pending.push([event, payload]);
    }
  } catch {
    // Ignored on purpose.
  }
};

export const captureCtaClick = ({ href, label, location }: ConversionClick) =>
  capture("cta_clicked", { href, label, location });

export const captureInstallCopied = (variant: string) =>
  capture("install_command_copied", { variant });

export const captureDemoOpened = () => capture("demo_opened", {});

export const captureFaqOpened = (question: string) =>
  capture("faq_opened", { question });

/** `section` is the landing section's element id, such as `try` or `faq`. */
export const captureSectionViewed = (section: string) =>
  capture("section_viewed", { section });
