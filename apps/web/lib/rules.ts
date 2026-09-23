import snapshot from "./rules.generated.json" with { type: "json" };

// Every count on the page reads from this build-time snapshot of the CLI's
// rule registry (scripts/generate-rules.mjs). Never type a count into copy.
export const RULES = {
  active: snapshot.active,
  domains: snapshot.domains,
  total: snapshot.total,
};

export const DOMAIN_LABELS: Record<string, string> = {
  authoring: "Agent instructions",
  copywriting: "Copy",
  craft: "Visual craft",
  interaction: "Interaction",
  motion: "Motion",
  product: "Product",
  typography: "Typography",
};
