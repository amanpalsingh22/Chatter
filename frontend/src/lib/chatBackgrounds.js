export const CHAT_BACKGROUNDS = [
  { id: "stars", name: "Starry", description: "Tiny outlined stars" },
  { id: "orbit", name: "Orbit", description: "Wandering stars and trails" },
  { id: "grid", name: "Soft grid", description: "Clean geometric lines" },
  { id: "dots", name: "Dots", description: "Playful micro dots" },
  { id: "paper", name: "Paper", description: "Warm subtle texture" },
  { id: "aurora", name: "Aurora", description: "Cool atmospheric glow" },
  { id: "sunset", name: "Sunset", description: "Warm gradient glow" },
  { id: "plain", name: "Plain", description: "No background pattern" },
];

export const DEFAULT_CHAT_BACKGROUND = "plain";

export const isValidChatBackground = (backgroundId) =>
  CHAT_BACKGROUNDS.some(({ id }) => id === backgroundId);
