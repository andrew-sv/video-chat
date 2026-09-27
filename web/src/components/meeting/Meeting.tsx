"use client";

import "@livekit/components-styles";
import { LiveKitRoom, PreJoin } from "@livekit/components-react";
import type { LocalUserChoices } from "@livekit/components-core";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DisconnectReason, Room } from "livekit-client";
import { buildRoomOptions } from "@/lib/room-options";
import { MAX_NAME_LENGTH } from "@/lib/limits";
import { Conference } from "./Conference";

type Session = { token: string; serverUrl: string; choices: LocalUserChoices };

export function Meeting({ roomId }: { roomId: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(false);

  async function join(choices: LocalUserChoices) {
    setError(null);
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomId, name: choices.username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not join");
      setSession({ token: data.token, serverUrl: data.serverUrl, choices });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join");
    }
  }

  if (left) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-semibold">You left the meeting</h1>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setLeft(false);
              setSession(null);
            }}
            className="rounded-xl bg-accent px-5 py-2.5 font-medium text-white"
          >
            Rejoin
          </button>
          <Link href="/" className="rounded-xl border border-border px-5 py-2.5">
            Home
          </Link>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main
        data-lk-theme="default"
        className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8"
      >
        <div className="text-center">
          <h1 className="text-xl font-semibold">Ready to join?</h1>
          <p className="font-mono text-sm text-muted">{roomId}</p>
        </div>
        <div className="w-full max-w-xl">
          <PreJoin
            onSubmit={join}
            onValidate={(v) => {
              const n = v.username.trim();
              return n.length > 0 && n.length <= MAX_NAME_LENGTH;
            }}
            onError={(e) => setError(`Camera/microphone: ${e.message}`)}
            joinLabel="Join now"
            userLabel="Your name"
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </main>
    );
  }

  return (
    <InCall
      roomId={roomId}
      session={session}
      onLeave={() => setLeft(true)}
    />
  );
}

function InCall({
  roomId,
  session,
  onLeave,
}: {
  roomId: string;
  session: Session;
  onLeave: () => void;
}) {
  const { choices } = session;
  const room = useMemo(
    () =>
      new Room(
        buildRoomOptions({
          audioDeviceId: choices.audioDeviceId,
          videoDeviceId: choices.videoDeviceId,
        }),
      ),
    [choices.audioDeviceId, choices.videoDeviceId],
  );
  const [fatal, setFatal] = useState<string | null>(null);

  if (fatal) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-semibold">Couldn&apos;t connect</h1>
        <p className="max-w-md text-muted">{fatal}</p>
        <button
          onClick={() => location.reload()}
          className="rounded-xl bg-accent px-5 py-2.5 font-medium text-white"
        >
          Try again
        </button>
      </main>
    );
  }

  return (
    <LiveKitRoom
      room={room}
      serverUrl={session.serverUrl}
      token={session.token}
      connect
      audio={choices.audioEnabled}
      video={choices.videoEnabled}
      onDisconnected={(reason) => {
        if (reason === DisconnectReason.CLIENT_INITIATED) onLeave();
        else setFatal(describeDisconnect(reason));
      }}
      onError={(e) => setFatal(e.message)}
      data-lk-theme="default"
      // Inline so it wins over .lk-room-container's own height rule.
      style={{ height: "100dvh", width: "100%" }}
    >
      <Conference roomId={roomId} />
    </LiveKitRoom>
  );
}

function describeDisconnect(reason?: DisconnectReason): string {
  switch (reason) {
    case DisconnectReason.ROOM_DELETED:
      return "The meeting has ended.";
    case DisconnectReason.PARTICIPANT_REMOVED:
      return "You were removed from the meeting.";
    case DisconnectReason.DUPLICATE_IDENTITY:
      return "You joined from another tab or device.";
    case DisconnectReason.JOIN_FAILURE:
      return "The meeting is full or unavailable.";
    default:
      return "The connection was lost and could not be restored.";
  }
}
