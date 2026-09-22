// Any button on the page can open the chat widget by calling openChat().
export const OPEN_CHAT_EVENT = "weldsight:open-chat";
export const openChat = () => window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT));

// The latest photo inspection, so the assistant can answer "what does this result mean?"
let lastInspection = null;
export const setLastInspection = (result) => {
  if (!result) return (lastInspection = null);
  const { annotated_image, rust, ...rest } = result; // eslint-disable-line no-unused-vars
  lastInspection = {
    ...rest,
    rust: rust && { count: rust.count, coverage_pct: rust.coverage_pct, max_score: rust.max_score, risk_level: rust.risk_level },
  };
};
export const getLastInspection = () => lastInspection;
