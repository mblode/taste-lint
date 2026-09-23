"use client";

import { useEffect } from "react";

import { captureSectionViewed } from "../lib/conversion-events.js";
import { observeSectionViews } from "../lib/section-views.js";

/**
 * Sends `section_viewed` once per landing section per page view. The hero
 * has no id and is never listed: it is on screen at load.
 */
export function SectionViews({ ids }: { ids: readonly string[] }) {
  const key = ids.join(",");
  useEffect(
    () => observeSectionViews(key.split(","), captureSectionViewed),
    [key]
  );
  return null;
}
