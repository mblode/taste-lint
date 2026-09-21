"use client";

import { Tabs } from "@base-ui/react/tabs";
import { CheckIcon, CopyIcon } from "blode-icons-react";
import { Fragment, useState } from "react";

import { Button } from "./ui/button.js";

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
        <Button
          aria-label="Copy install command"
          className="size-12 shrink-0 motion-reduce:transition-none"
          variant="ghost"
          onClick={copy}
          type="button"
        >
          {status === "Install command copied." ? (
            <CheckIcon aria-hidden="true" data-icon="inline-start" />
          ) : (
            <CopyIcon aria-hidden="true" data-icon="inline-start" />
          )}
        </Button>
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

// Adapted from StrataSync's hero-install: line tabs, divider, and both
// commands in the served HTML so agents do not need to interact first.
export function InstallCommand() {
  const [selectedAudience, setAudience] = useState("humans");
  return (
    <Tabs.Root
      className="flex min-w-0 flex-col gap-4"
      onValueChange={setAudience}
      value={selectedAudience}
    >
      <Tabs.List
        aria-label="Install Taste Lint"
        className="flex w-fit items-center gap-4"
      >
        {audiences.map((audience, index) => (
          <Fragment key={audience.value}>
            {index > 0 ? (
              <span aria-hidden="true" className="h-4 w-px bg-border" />
            ) : null}
            <Tabs.Tab
              className="relative min-h-12 px-0 text-base font-medium text-muted-foreground transition-colors hover:text-foreground data-active:text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground after:opacity-0 data-active:after:opacity-100 motion-reduce:transition-none"
              value={audience.value}
            >
              {audience.label}
            </Tabs.Tab>
          </Fragment>
        ))}
      </Tabs.List>
      {audiences.map((audience) => (
        <Tabs.Panel key={audience.value} value={audience.value} keepMounted>
          <CommandPanel key={selectedAudience} command={audience.command} />
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
