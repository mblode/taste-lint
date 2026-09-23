// Ask several models for the same UI and copy, the way a user would, and save
// what they write so taste-lint (and a reader) can find each model's slop.
// Usage: AI_GATEWAY_API_KEY=... node scripts/generate-slop.mjs [outDir] [model,...] [task,...]

import fs from "node:fs";
import path from "node:path";

const MODELS = [
  "openai/gpt-6-astra",
  "openai/gpt-6-sol",
  "anthropic/claude-opus-5.5",
  "anthropic/claude-fable-5.1",
  "spacexai/grok-4.7",
];

// The only facts a model gets. No customers, stats, logos or quotes exist, so
// any the output contains are invented.
const FACTS = `Product facts (the only facts you have):
- Northwind is a desktop app that keeps a folder in sync across a small team's laptops.
- When two people edit the same file offline, it keeps both versions side by side instead of overwriting one.
- It works over the local network first and falls back to an encrypted relay.
- Price: $8 per seat per month. 14-day free trial, no card required.
- Built by two people in Melbourne, launched in 2026. macOS and Windows; Linux is in beta.`;

const UI =
  "Reply with one self-contained React component in a single ```tsx code block, styled with Tailwind CSS classes. No explanation.";
const COPY = "Reply with the text only, in Markdown. No preamble.";

export const TASKS = [
  {
    id: "ui-landing",
    kind: "ui",
    prompt: "Build a landing page for Northwind.",
  },
  {
    id: "ui-pricing",
    kind: "ui",
    prompt: "Build the pricing page for Northwind.",
  },
  {
    id: "ui-settings",
    kind: "ui",
    prompt:
      "Build the sync settings screen for Northwind, including what the user sees when saving fails.",
  },
  {
    id: "ui-empty",
    kind: "ui",
    prompt:
      "Build the first screen a new Northwind user sees after installing, before any folder is synced.",
  },
  {
    id: "ui-signup",
    kind: "ui",
    prompt: "Build the sign-up page for Northwind's free trial.",
  },
  {
    id: "ui-conflict",
    kind: "ui",
    prompt:
      "Build the dialog Northwind shows when two versions of a file conflict.",
  },
  {
    id: "copy-readme",
    kind: "copy",
    prompt:
      "Write the README for Northwind's open-source command-line companion, `nw`, which lists sync status and resolves conflicts from the terminal.",
  },
  {
    id: "copy-launch",
    kind: "copy",
    prompt: "Write the launch blog post announcing Northwind.",
  },
  {
    id: "copy-store",
    kind: "copy",
    prompt: "Write Northwind's Mac App Store description.",
  },
  {
    id: "copy-errors",
    kind: "copy",
    prompt:
      "Write the error messages Northwind shows for: relay unreachable, disk full, file locked by another app, and trial expired.",
  },
  {
    id: "copy-about",
    kind: "copy",
    prompt: "Write the About page for Northwind's website.",
  },
  {
    id: "copy-email",
    kind: "copy",
    prompt: "Write the onboarding email a new trial user gets on day 3.",
  },
];

const extract = (text, kind) => {
  if (kind === "ui") {
    const m = text.match(
      /```(?:tsx|jsx|typescript|javascript)?\n([\s\S]*?)```/
    );
    return m ? m[1] : text;
  }
  const m = text.match(/^```(?:markdown|md)?\n([\s\S]*?)```\s*$/);
  return `${(m ? m[1] : text).trim()}\n`;
};

const generate = async (model, task, key) => {
  const started = Date.now();
  const response = await fetch(
    "https://ai-gateway.vercel.sh/v1/chat/completions",
    {
      body: JSON.stringify({
        max_tokens: 16_000,
        messages: [
          {
            content: `${task.prompt}\n\n${FACTS}\n\n${task.kind === "ui" ? UI : COPY}`,
            role: "user",
          },
        ],
        model,
      }),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(600_000),
    }
  );
  if (!response.ok) {
    throw new Error(`${model} ${task.id}: HTTP ${response.status}`);
  }
  const data = await response.json();
  return {
    ms: Date.now() - started,
    text: data.choices?.[0]?.message?.content ?? "",
    usage: data.usage,
  };
};

const main = async () => {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) {
    throw new Error("Set AI_GATEWAY_API_KEY.");
  }
  const [outDir = "results/slop", models = MODELS.join(","), tasks = ""] =
    process.argv.slice(2);
  const only = new Set(tasks.split(",").filter(Boolean));
  const picked = TASKS.filter((t) => !only.size || only.has(t.id));
  await Promise.all(
    models.split(",").map(async (model) => {
      const dir = path.join(outDir, model.split("/")[1]);
      fs.mkdirSync(dir, { recursive: true });
      for (const task of picked) {
        const file = path.join(
          dir,
          `${task.id}.${task.kind === "ui" ? "tsx" : "md"}`
        );
        if (fs.existsSync(file)) {
          continue;
        }
        try {
          const { text, usage, ms } = await generate(model, task, key);
          fs.writeFileSync(file, extract(text, task.kind));
          fs.appendFileSync(
            path.join(outDir, "usage.jsonl"),
            `${JSON.stringify({ model, ms, task: task.id, usage })}\n`
          );
          console.log(`${model} ${task.id} ${ms}ms`);
        } catch (error) {
          console.error(String(error));
        }
      }
    })
  );
};

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
