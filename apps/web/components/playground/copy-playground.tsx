"use client";

import { useDeferredValue, useId, useRef, useState } from "react";

import { PLAYGROUND_SAMPLES } from "../../fixtures/playground-samples.js";
import { captureDemoOpened } from "../../lib/conversion-events.js";
import type { Finding, Match } from "../../lib/playground.js";
import {
  lintCopy,
  PLAYGROUND_RULES,
  ruleSourceUrl,
  splitMatches,
} from "../../lib/playground.js";

const MAX_LENGTH = 2000;

export function MarkedLine({
  matches,
  text,
}: {
  matches: Match[];
  text: string;
}) {
  return (
    <>
      {splitMatches(text, matches).map((piece, index) =>
        piece.marked ? (
          <mark
            className="rounded-sm bg-foreground px-0.5 text-background"
            // Pieces never reorder; the index is stable for this render.
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
          >
            {piece.text}
          </mark>
        ) : (
          // oxlint-disable-next-line react/no-array-index-key
          <span key={index}>{piece.text}</span>
        )
      )}
    </>
  );
}

export function FindingItem({ finding }: { finding: Finding }) {
  const { rule } = finding;
  return (
    <li className="border-s-2 border-foreground py-1 ps-4">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <a
          className="font-mono underline underline-offset-4 hover:decoration-2"
          href={ruleSourceUrl(rule.id)}
        >
          {rule.id}
        </a>
        <span className="text-muted-foreground">Line {finding.line}</span>
        {rule.decidedBy === "jev" && (
          <span className="text-muted-foreground">
            Jev makes the final call in the CLI
          </span>
        )}
      </p>
      <p className="mt-1 font-medium">{rule.title}</p>
      <p className="mt-2 font-mono text-sm leading-6 break-words">
        <MarkedLine matches={finding.matches} text={finding.text} />
      </p>
      <p className="mt-2 max-w-[56ch] text-sm leading-6">Fix: {rule.fix}</p>
    </li>
  );
}

export function CopyPlayground({ totalRules }: { totalRules: number }) {
  const ids = useId();
  const [sample, setSample] = useState(PLAYGROUND_SAMPLES[0].id);
  const [text, setText] = useState(PLAYGROUND_SAMPLES[0].text);
  const deferred = useDeferredValue(text);
  const findings = lintCopy(deferred);
  const opened = useRef(false);

  const open = () => {
    if (!opened.current) {
      opened.current = true;
      captureDemoOpened();
    }
  };

  const pick = (id: string) => {
    const next = PLAYGROUND_SAMPLES.find((item) => item.id === id);
    if (next) {
      open();
      setSample(id);
      setText(next.text);
    }
  };

  const ruleCount = PLAYGROUND_RULES.length;
  const summary =
    findings.length === 0
      ? `No findings from these ${ruleCount} rules.`
      : `${findings.length} finding${findings.length === 1 ? "" : "s"} from ${ruleCount} rules.`;

  return (
    <div className="grid min-w-0 items-start gap-8 lg:grid-cols-2 lg:gap-16">
      <div className="min-w-0">
        <fieldset className="flex flex-wrap gap-x-5">
          <legend className="mb-1 text-sm text-muted-foreground">
            Start from a sample
          </legend>
          {PLAYGROUND_SAMPLES.map((item) => (
            <label
              className="relative flex min-h-12 cursor-pointer items-center font-medium text-muted-foreground after:absolute after:inset-x-0 after:bottom-2 after:h-0.5 after:bg-foreground after:opacity-0 has-checked:text-foreground has-checked:after:opacity-100 has-focus-visible:outline-2 has-focus-visible:outline-offset-4"
              key={item.id}
            >
              <input
                checked={sample === item.id}
                className="sr-only"
                name={`${ids}-sample`}
                onChange={() => pick(item.id)}
                type="radio"
                value={item.id}
              />
              {item.label}
            </label>
          ))}
        </fieldset>
        <label className="mt-4 block font-medium" htmlFor={`${ids}-copy`}>
          UI copy to check
        </label>
        <textarea
          aria-describedby={`${ids}-hint`}
          className="mt-2 block min-h-48 w-full resize-y rounded-xl border bg-card/40 p-4 font-mono text-base leading-7 outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          id={`${ids}-copy`}
          maxLength={MAX_LENGTH}
          onChange={(event) => {
            open();
            setSample("");
            setText(event.target.value);
          }}
          onFocus={open}
          spellCheck={false}
          value={text}
        />
        <p className="mt-2 text-sm text-muted-foreground" id={`${ids}-hint`}>
          One line is one string. It runs in your browser and nothing leaves the
          page.
        </p>
      </div>
      <div className="min-w-0">
        <p aria-live="polite" className="font-medium" role="status">
          {summary}
        </p>
        {findings.length > 0 ? (
          <ol aria-label="Findings" className="mt-4 flex flex-col gap-6">
            {findings.map((finding) => (
              <FindingItem
                finding={finding}
                key={`${finding.line}-${finding.rule.id}`}
              />
            ))}
          </ol>
        ) : (
          <p className="mt-2 max-w-[56ch] leading-7">
            {text.trim()
              ? `The CLI runs all ${totalRules} rules on your repo, including the ones that read class names and layout.`
              : "Paste a button label, a toast or a hero line to check it."}
          </p>
        )}
      </div>
    </div>
  );
}
