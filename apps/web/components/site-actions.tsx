"use client";

import {
  captureFaqOpened,
  captureInstallCopied,
} from "../lib/conversion-events.js";
import { INSTALL_COMMANDS } from "../lib/install.js";
import { InstallCommand } from "./install-command.js";
import type { FaqItem } from "./marketing/faq-json-ld.js";
import { Faq } from "./marketing/faq.js";

// Client bindings between the presentational blocks and the analytics
// contract. Server components cannot pass callbacks, so they render these.
export function SiteInstallCommand() {
  return (
    <InstallCommand commands={INSTALL_COMMANDS} onCopy={captureInstallCopied} />
  );
}

export function SiteFaq({ items }: { items: FaqItem[] }) {
  return <Faq items={items} onOpen={captureFaqOpened} />;
}
