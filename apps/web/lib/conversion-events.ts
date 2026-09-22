import { posthog } from "posthog-js";

/**
 * The shared landing-page event contract. Names match the other blode.co
 * zones (diffhub, Taste Training, blode-co) so one funnel covers every site.
 * Every capture is a no-op until `instrumentation-client.ts` initialises
 * PostHog, which it skips on localhost.
 */
const SITE = "taste-lint";

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
    posthog.capture(event, { site: SITE, ...properties, ...pageLocation() });
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
