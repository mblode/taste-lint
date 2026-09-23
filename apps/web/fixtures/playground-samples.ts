// Deliberately bad copy for the landing-page playground. It lives under
// fixtures/ because taste-lint.config.json excludes this folder from
// `npm run taste`: these strings exist to trip the rules.

export interface PlaygroundSample {
  id: string;
  label: string;
  text: string;
}

export const PLAYGROUND_SAMPLES: PlaygroundSample[] = [
  {
    id: "toasts",
    label: "Toasts and errors",
    text: [
      "Successfully saved your changes! 🎉",
      "Please make a selection before you continue...",
      "The app thinks your session expired, i.e. you were away too long.",
    ].join("\n"),
  },
  {
    id: "hero",
    label: "Landing hero",
    text: [
      "A powerful, seamless platform designed to be easy to use.",
      "We believe that great teams deserve intuitive tools.",
      "In order to start, connect your repo.",
    ].join("\n"),
  },
  {
    id: "clean",
    label: "Clean copy",
    text: [
      "Changes saved",
      "Choose a plan to continue",
      "Your session expired after 30 minutes. Sign in again to pick up where you left off.",
    ].join("\n"),
  },
];

/** The before/after pair below the playground. */
export const BEFORE_AFTER = {
  after: "Changes saved",
  before: "Successfully saved your changes! 🎉",
};
