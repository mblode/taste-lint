// Fires `onView(id)` the first time each landing section is at least half
// visible, once per call (one call per page view). A section already on
// screen when this runs is skipped: the reader did not scroll to it. It never
// throws and does nothing where IntersectionObserver is missing.

export interface SectionViewEnv {
  IntersectionObserver?: typeof IntersectionObserver;
  find: (id: string) => Element | null;
  innerHeight: number;
}

const browserEnv = (): SectionViewEnv | null =>
  typeof window === "undefined"
    ? null
    : {
        IntersectionObserver: window.IntersectionObserver,
        find: (id) => document.querySelector(`#${CSS.escape(id)}`),
        innerHeight: window.innerHeight,
      };

const VISIBLE_SHARE = 0.5;

export const observeSectionViews = (
  ids: readonly string[],
  onView: (id: string) => void,
  env: SectionViewEnv | null = browserEnv()
): (() => void) => {
  const observers: IntersectionObserver[] = [];
  const disconnect = () => {
    for (const observer of observers) {
      try {
        observer.disconnect();
      } catch {
        // Ignored on purpose: analytics must never break the page.
      }
    }
  };
  try {
    const Observer = env?.IntersectionObserver;
    if (!(env && Observer)) {
      return disconnect;
    }
    for (const id of ids) {
      const node = env.find(id);
      if (!node) {
        continue;
      }
      const rect = node.getBoundingClientRect();
      if (rect.top < env.innerHeight && rect.bottom > 0) {
        continue;
      }
      // A section taller than twice the viewport never reaches 50%, so it
      // counts once it fills half the screen instead.
      const threshold =
        rect.height > 0
          ? Math.min(
              VISIBLE_SHARE,
              (env.innerHeight * VISIBLE_SHARE) / rect.height
            )
          : VISIBLE_SHARE;
      const observer = new Observer(
        (entries) => {
          if (
            entries.some(
              (entry) =>
                entry.isIntersecting &&
                entry.intersectionRatio >= threshold - 0.01
            )
          ) {
            observer.disconnect();
            try {
              onView(id);
            } catch {
              // Ignored on purpose.
            }
          }
        },
        { threshold }
      );
      observers.push(observer);
      observer.observe(node);
    }
  } catch {
    disconnect();
  }
  return disconnect;
};
