"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { generateRoomId, parseRoomInput } from "@/lib/room-id";

export function NewMeetingButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/r/${generateRoomId()}`)}
      className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-white hover:brightness-110"
    >
      Start a new meeting
    </button>
  );
}

export function JoinForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const id = parseRoomInput(value);
        if (!id) {
          setError("Enter a code like abc-defg-hij or paste a meeting link.");
          return;
        }
        router.push(`/r/${id}`);
      }}
    >
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Meeting code or link"
          aria-label="Meeting code or link"
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-xl border border-border bg-surface-2 px-5 font-medium hover:bg-border"
        >
          Join
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
