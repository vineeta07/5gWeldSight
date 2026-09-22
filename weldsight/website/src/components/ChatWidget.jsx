import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { OPEN_CHAT_EVENT, getLastInspection } from "../utils/chat";
import { apiUrl } from "../utils/api";

// Talks to the Python backend at /api/chat (see backend/routes/chat.py).
// The Gemini key lives ONLY on the backend — never in this file or in VITE_ env vars.

const STARTERS = [
  "How does WeldSight detect weld defects?",
  "Why does industry inspection need 5G?",
  "What's inside the prototype?",
];

const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Let any button on the page open the chat (see utils/chat.js)
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (text) => {
    const content = text.trim();
    if (!content || loading) return;

    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/api/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Bypass-Tunnel-Reminder": "true"
        },
        body: JSON.stringify({
          messages: next.slice(-12).map(({ role, content }) => ({ role, content })), // keep context small
          app: "website",
          page: "Project website",
          context: getLastInspection() ? { latest_photo_inspection: getLastInspection() } : null,
        }),
      });
      if (!res.ok) throw new Error(`Server replied ${res.status}`);
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply, sources: data.sources || [] }]);
    } catch (err) {
      setError("The assistant is offline. Check that the backend is running, then try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close assistant" : "Ask the WeldSight assistant"}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-blue text-white shadow-lg
                   flex items-center justify-center transition-transform hover:scale-105
                   focus:outline-none focus-visible:ring-4 focus-visible:ring-blue/40"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="WeldSight assistant"
          className="fixed z-50 bottom-20 sm:bottom-24 right-4 left-4 sm:left-auto sm:right-6 sm:w-[380px]
                     h-[min(560px,70vh)] flex flex-col rounded-2xl overflow-hidden
                     bg-zinc border border-blue/20 shadow-2xl font-inter"
        >
          <header className="px-5 py-4 border-b border-white/10">
            <p className="font-outfit font-semibold text-white">AI assistant</p>
          </header>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray">Try one of these:</p>
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full text-left text-sm text-white px-3 py-2 rounded-lg
                               bg-white/[0.06] hover:bg-white/10 border border-white/5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] text-sm leading-relaxed px-3.5 py-2.5 rounded-2xl [&_strong]:font-bold [&_ul]:list-disc [&_ul]:ml-4 [&_p]:my-1 ${
                    m.role === "user"
                      ? "bg-blue text-white rounded-br-sm"
                      : "bg-white/[0.06] text-white rounded-bl-sm"
                  }`}
                >
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                  {m.sources?.length ? (
                    <span className="block mt-2 pt-2 border-t border-white/10 text-[11px] text-gray">
                      From the WeldSight notes: {m.sources.map((s) => s.title).join(" · ")}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}

            {loading && <p className="text-sm text-gray px-1">Thinking…</p>}
            {error && <p className="text-sm text-weld px-1">{error}</p>}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex gap-2 p-3 border-t border-white/10"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a question"
              aria-label="Your question"
              className="flex-1 bg-black text-white text-sm rounded-lg px-3 py-2.5 placeholder:text-gray
                         border border-white/10 focus:outline-none focus:border-blue"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 rounded-lg bg-blue text-white text-sm font-semibold disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </section>
      )}
    </>
  );
};

export default ChatWidget;
