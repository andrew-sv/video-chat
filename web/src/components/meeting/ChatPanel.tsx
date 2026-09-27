"use client";

import type { ReceivedChatMessage } from "@livekit/components-core";
import { useLocalParticipant } from "@livekit/components-react";
import { useEffect, useRef, useState } from "react";
import { MAX_CHAT_LENGTH } from "@/lib/limits";

export function ChatPanel({
  messages,
  send,
  isSending,
}: {
  messages: ReceivedChatMessage[];
  send: (text: string) => Promise<unknown>;
  isSending: boolean;
}) {
  const { localParticipant } = useLocalParticipant();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function submit() {
    const text = draft.trim();
    if (!text) return;
    try {
      await send(text);
      setDraft("");
      setError(null);
    } catch {
      setError("Message not sent. Check your connection.");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted">
            Messages are visible to everyone in the call and disappear when it
            ends.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.from?.identity === localParticipant.identity;
          return (
            <div key={m.id} className={mine ? "text-right" : ""}>
              <div className="text-xs text-muted">
                {mine ? "You" : (m.from?.name ?? "Unknown")} ·{" "}
                {new Date(m.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div
                className={`mt-0.5 inline-block max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-left text-sm ${
                  mine ? "bg-accent text-white" : "bg-surface-2"
                }`}
              >
                {m.message}
              </div>
            </div>
          );
        })}
      </div>
      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_CHAT_LENGTH}
          placeholder="Send a message"
          aria-label="Chat message"
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-base outline-none focus:border-accent md:text-sm"
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="rounded-xl bg-accent px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
      {error && <p className="px-3 pb-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
