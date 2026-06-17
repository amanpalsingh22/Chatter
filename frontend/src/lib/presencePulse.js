const PRESENCE_PULSE_PREFERENCE_KEY = "chatty.presencePulse";

export const isPresencePulseEnabled = () =>
  localStorage.getItem(PRESENCE_PULSE_PREFERENCE_KEY) !== "disabled";

export const setPresencePulseEnabled = (enabled) => {
  localStorage.setItem(PRESENCE_PULSE_PREFERENCE_KEY, enabled ? "enabled" : "disabled");
};
