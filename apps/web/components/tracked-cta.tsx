"use client";

import type { ComponentProps, MouseEvent, ReactNode } from "react";

import { captureCtaClick } from "../lib/conversion-events.js";

type TrackedCtaProps = {
  children?: ReactNode;
  href: string;
  label: string;
  location: string;
} & Omit<ComponentProps<"a">, "href">;

/**
 * Anchor that sends `cta_clicked` before navigating. Plain anchors on
 * purpose: the docs live behind the zone proxy, outside the App Router.
 */
export const TrackedCta = ({
  children,
  href,
  label,
  location,
  onClick,
  ...rest
}: TrackedCtaProps) => {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    captureCtaClick({ href, label, location });
    onClick?.(event);
  };
  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children ?? label}
    </a>
  );
};
