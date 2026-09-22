import assert from "node:assert/strict";
import { test } from "node:test";

import { observeSectionViews } from "./section-views.js";
import type { SectionViewEnv } from "./section-views.js";

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

const setup = (tops: Record<string, number>, height = 400) => {
  const observers: { callback: Callback; threshold: number }[] = [];
  class FakeObserver {
    callback: Callback;
    threshold: number;
    constructor(callback: Callback, options: { threshold: number }) {
      this.callback = callback;
      this.threshold = options.threshold;
      observers.push(this);
    }
    disconnect() {
      this.callback = () => null;
    }
    observed: Element[] = [];
    observe(node: Element) {
      this.observed.push(node);
    }
  }
  const env: SectionViewEnv = {
    IntersectionObserver:
      FakeObserver as unknown as typeof IntersectionObserver,
    find: (id) =>
      id in tops
        ? ({
            getBoundingClientRect: () => ({
              bottom: tops[id] + height,
              height,
              top: tops[id],
            }),
          } as Element)
        : null,
    innerHeight: 800,
  };
  return { env, observers };
};

const seen = (ratio: number) =>
  [{ intersectionRatio: ratio, isIntersecting: true }] as const;

test("fires once per section at 50% and skips sections on screen at load", () => {
  const { env, observers } = setup({ faq: 3000, hero: 0, rules: 2000 });
  const fired: string[] = [];
  observeSectionViews(
    ["hero", "rules", "faq", "missing"],
    (id) => fired.push(id),
    env
  );
  assert.equal(observers.length, 2);
  const [rules, faq] = observers;
  assert.equal(rules?.threshold, 0.5);
  rules?.callback([...seen(0.2)]);
  assert.deepEqual(fired, []);
  rules?.callback([...seen(0.5)]);
  rules?.callback([...seen(0.9)]);
  faq?.callback([...seen(0.6)]);
  assert.deepEqual(fired, ["rules", "faq"]);
});

test("a section taller than two viewports counts once it fills half the screen", () => {
  const { env, observers } = setup({ rules: 2000 }, 4000);
  observeSectionViews(["rules"], () => null, env);
  assert.equal(observers[0]?.threshold, 0.1);
});

test("does nothing without IntersectionObserver and never throws", () => {
  const { env } = setup({ rules: 2000 });
  assert.doesNotThrow(() =>
    observeSectionViews(["rules"], () => null, {
      ...env,
      IntersectionObserver: undefined,
    })()
  );
  assert.doesNotThrow(() => observeSectionViews(["rules"], () => null, null)());
  const broken: SectionViewEnv = {
    ...env,
    find: () => {
      throw new Error("detached");
    },
  };
  assert.doesNotThrow(() =>
    observeSectionViews(["rules"], () => null, broken)()
  );
  const { env: throwing, observers } = setup({ rules: 2000 });
  observeSectionViews(
    ["rules"],
    () => {
      throw new Error("capture failed");
    },
    throwing
  );
  assert.doesNotThrow(() => observers[0]?.callback([...seen(1)]));
});
