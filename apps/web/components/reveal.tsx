"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type Phase = "static" | "waiting" | "shown";

/**
 * A once-only reveal for content below the fold. It renders visible on the
 * server and without script, stays static when the element is already on
 * screen at hydration or the reader prefers reduced motion, and otherwise
 * fades and lifts in once, the first time it scrolls into view.
 */
export function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("static");

  useEffect(() => {
    const node = ref.current;
    if (
      !node ||
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      node.getBoundingClientRect().top < window.innerHeight
    ) {
      return;
    }
    setPhase("waiting");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPhase("shown");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="reveal" data-phase={phase} ref={ref}>
      {children}
    </div>
  );
}
