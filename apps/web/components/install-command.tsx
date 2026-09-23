"use client";

import { CheckIcon, CopyIcon } from "blode-icons-react";
import { useEffect, useId, useRef, useState } from "react";

export interface InstallCommandProps {
  commands: { label: string; command: string }[];
  onCopy?: (label: string) => void;
}

type CopyState = "idle" | "copied" | "error";

const RESET_MS = 2000;

const selectText = (node: HTMLElement | null) => {
  const selection = window.getSelection();
  if (!(node && selection)) {
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
};

function CommandPanel({
  command,
  label,
  onCopy,
}: {
  command: string;
  label: string;
  onCopy?: (label: string) => void;
}) {
  const [state, setState] = useState<CopyState>("idle");
  const codeRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
  };

  useEffect(() => clear, []);

  const copy = async () => {
    clear();
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(command);
      setState("copied");
      onCopy?.(label);
      timer.current = setTimeout(() => setState("idle"), RESET_MS);
    } catch {
      // Leave the command selected so the keyboard shortcut still works.
      selectText(codeRef.current);
      setState("error");
    }
  };

  const status = {
    copied: "Copied. Paste it in your project folder.",
    error:
      "Your browser blocked the copy. The command is selected: press Ctrl+C or Cmd+C.",
    idle: "",
  }[state];

  return (
    <div className="min-w-0">
      <div className="flex w-full max-w-xl min-w-0 items-center gap-2 rounded-xl border bg-card/40 p-1.5">
        <code
          className="min-w-0 flex-1 px-3 py-2 font-mono text-sm break-words sm:text-base sm:whitespace-nowrap"
          ref={codeRef}
        >
          {command}
        </code>
        <button
          aria-label={`Copy install command ${label.toLowerCase()}`}
          className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 font-medium text-primary-foreground transition-[background-color,transform] duration-150 ease-out hover:bg-primary/90 active:scale-[0.97] [&_svg]:size-4"
          onClick={copy}
          type="button"
        >
          {state === "copied" ? (
            <CheckIcon aria-hidden="true" />
          ) : (
            <CopyIcon aria-hidden="true" />
          )}
          <span className="min-w-[6ch] text-start">
            {state === "copied" ? "Copied" : "Copy"}
          </span>
        </button>
      </div>
      <p
        aria-live="polite"
        className="mt-2 min-h-6 max-w-[56ch] text-sm text-muted-foreground"
        role="status"
      >
        {status}
      </p>
    </div>
  );
}

// Native radios switch panels through CSS before hydration and give arrow-key
// navigation for free. globals.css hides the unchecked panels (up to four).
export function InstallCommand({ commands, onCopy }: InstallCommandProps) {
  const name = useId();
  return (
    <div className="install-commands flex min-w-0 flex-col gap-3">
      {commands.length > 1 && (
        <fieldset className="flex w-fit items-center gap-5">
          <legend className="sr-only">Install command for</legend>
          {commands.map((item, index) => (
            <label
              className="relative flex min-h-12 cursor-pointer items-center text-base font-medium text-muted-foreground after:absolute after:inset-x-0 after:bottom-2 after:h-0.5 after:bg-foreground after:opacity-0 has-checked:text-foreground has-checked:after:opacity-100 has-focus-visible:outline-2 has-focus-visible:outline-offset-4"
              key={item.label}
            >
              <input
                className="sr-only"
                data-index={index}
                defaultChecked={index === 0}
                name={name}
                type="radio"
                value={item.label}
              />
              {item.label}
            </label>
          ))}
        </fieldset>
      )}
      {commands.map((item, index) => (
        <div data-panel={index} key={item.label}>
          <CommandPanel
            command={item.command}
            label={item.label}
            onCopy={onCopy}
          />
        </div>
      ))}
    </div>
  );
}
