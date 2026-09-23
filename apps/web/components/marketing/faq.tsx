"use client";

import { ChevronDownIcon } from "blode-icons-react";
import type { SyntheticEvent } from "react";

import type { FaqItem } from "./faq-json-ld.js";

// Native <details> keeps every answer in the server HTML (it must match the
// FAQPage JSON-LD) and gives keyboard support without script.
export function Faq({
  items,
  onOpen,
}: {
  items: FaqItem[];
  onOpen?: (question: string) => void;
}) {
  const toggle =
    (question: string) => (event: SyntheticEvent<HTMLDetailsElement>) => {
      if (event.currentTarget.open) {
        onOpen?.(question);
      }
    };
  return (
    <div className="max-w-3xl divide-y border-y">
      {items.map((item) => (
        <details
          className="group"
          key={item.question}
          onToggle={toggle(item.question)}
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-lg font-medium [&::-webkit-details-marker]:hidden">
            <h3>{item.question}</h3>
            <ChevronDownIcon
              aria-hidden="true"
              className="size-5 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.645,0.045,0.355,1)] group-open:rotate-180"
            />
          </summary>
          <p className="max-w-[62ch] pb-5 leading-7 text-pretty">
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  );
}
