// Lets any page tell the assistant what the user is looking at,
// and open the assistant panel from anywhere.
let current: unknown = null;

export function setAssistantContext(data: unknown) {
  current = data;
}
export function getAssistantContext() {
  return current;
}

export const OPEN_ASSISTANT_EVENT = "weldsight:open-assistant";
export function openAssistant() {
  window.dispatchEvent(new CustomEvent(OPEN_ASSISTANT_EVENT));
}
