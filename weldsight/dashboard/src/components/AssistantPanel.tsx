import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Send, X } from "lucide-react";
import { api } from "../lib/api";
import { getAssistantContext } from "../lib/assistant";

interface Source {
  id: string;
  title: string;
}
interface Msg {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  offline?: boolean;
}
interface ChatReply {
  reply: string;
  sources: Source[];
  mode: string;
}

export const PAGE_TITLES: Record<string, string> = {
  "/": "Overview",
  "/surveillance": "Live feeds",
  "/map": "Facility map",
  "/video-analysis": "Video analysis",
  "/incidents": "Defect reports",
  "/analytics": "Analytics",
  "/evidence": "Inspection records",
  "/zones": "Weld zones",
  "/reports": "Reports",
  "/settings": "Settings",
};

const STARTERS = ["Which reports are still open?", "What should I check first today?", "How does the defect model decide the risk level?"];

export default function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { pathname } = useLocation();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const r = await api<ChatReply>(
        "/api/chat",
        {
          method: "POST",
          body: JSON.stringify({
            messages: next.slice(-12).map(({ role, content }) => ({ role, content })),
            app: "dashboard",
            page: PAGE_TITLES[pathname] ?? pathname,
            context: getAssistantContext(),
          }),
        },
        60000,
      );
      setMessages([...next, { role: "assistant", content: r.reply, sources: r.sources, offline: r.mode === "offline" }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `Sorry, I couldn't answer that. ${(e as Error).message}`, offline: true }]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <aside className="w-full sm:w-96 flex flex-col border-l border-slate-200 bg-white shadow-xl animate-slide-in" aria-label="Assistant">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">AI assistant</h2>

        </div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Close assistant">
          <X size={16} />
        </button>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">Ask about reports, cameras, a video you analysed, or weld defects in general.</p>
            {STARTERS.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full text-left text-sm px-3 py-2 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed [&_strong]:font-bold [&_ul]:list-disc [&_ul]:ml-4 [&_p]:my-1 ${
                m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              <ReactMarkdown>{m.content}</ReactMarkdown>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 text-xs text-slate-500">From the notes: {m.sources.map((s) => s.title).join(" · ")}</div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-sm text-slate-500">Thinking…</div>}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 p-3 border-t border-slate-200">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question"
          aria-label="Your question"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button type="submit" disabled={loading || !input.trim()} className="rounded-md bg-emerald-600 px-3 text-white disabled:opacity-40" aria-label="Send">
          <Send size={16} />
        </button>
      </form>
    </aside>
  );
}
