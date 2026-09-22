import { posthog } from "posthog-js";

/**
 * The shared landing-page event contract. Names match the other blode.co
 * zones (diffhub, Taste Training, blode-co) so one funnel covers every site.
 * Every capture is a no-op until `instrumentation-client.ts` initialises
 * PostHog, which it skips on localhost and when no key is set.
 */
export const SITE = "taste-lint";

export const CTA_CLICKED_EVENT = "cta_clicked";
export const INSTALL_COMMAND_COPIED_EVENT = "install_command_copied";
export const DEMO_OPENED_EVENT = "demo_opened";
export const FAQ_OPENED_EVENT = "faq_opened";

export interface ConversionClick {
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
  capture(CTA_CLICKED_EVENT, { href, label, location });

export const captureInstallCopied = (variant: string) =>
  capture(INSTALL_COMMAND_COPIED_EVENT, { variant });

export const captureDemoOpened = () => capture(DEMO_OPENED_EVENT, {});

export const captureFaqOpened = (question: string) =>
  capture(FAQ_OPENED_EVENT, { question });
