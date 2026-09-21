"use client";

import { CheckIcon, CopyIcon } from "blode-icons-react";
import { useState } from "react";

const audiences = [
  {
    command: "npx taste-lint@latest init",
    label: "For humans",
    value: "humans",
  },
  {
    command: "npx taste-lint@latest init --agent",
    label: "For agents",
    value: "agents",
  },
] as const;

function CommandPanel({ command }: { command: string }) {
  const [status, setStatus] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setStatus("Install command copied.");
    } catch {
      setStatus(
        "Could not copy. Select the command above and copy it manually."
      );
    }
  };

  return (
    <div className="min-w-0">
      <div className="flex w-fit max-w-full items-center gap-2 rounded-lg border p-1">
        <code className="min-w-0 break-words px-3 py-2 font-mono text-base">
          {command}
        </code>
        <button
          aria-label="Copy install command"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 [&_svg]:size-4"
          onClick={copy}
          type="button"
        >
          {status === "Install command copied." ? (
            <CheckIcon aria-hidden="true" data-icon="inline-start" />
          ) : (
            <CopyIcon aria-hidden="true" data-icon="inline-start" />
          )}
        </button>
      </div>
      <p
        aria-live="polite"
        className="mt-3 min-h-6 max-w-[56ch] text-sm text-muted-foreground"
        role="status"
      >
        {status}
      </p>
    </div>
  );
}

// Native radios provide selection and arrow-key navigation before hydration.
export function InstallCommand() {
  return (
    <div className="install-commands flex min-w-0 flex-col gap-4">
      <fieldset className="flex w-fit items-center gap-4">
        <legend className="sr-only">Install Taste Lint</legend>
        {audiences.map((audience) => (
          <label
            className="relative flex min-h-12 cursor-pointer items-center text-base font-medium text-muted-foreground has-checked:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-4 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground after:opacity-0 has-checked:after:opacity-100"
            key={audience.value}
          >
            <input
              className="sr-only"
              type="radio"
              name="install-audience"
              value={audience.value}
              defaultChecked={audience.value === "humans"}
            />
            {audience.label}
          </label>
        ))}
      </fieldset>
      {audiences.map((audience) => (
        <div key={audience.value} data-audience={audience.value}>
          <CommandPanel command={audience.command} />
        </div>
      ))}
    </div>
  );
}
