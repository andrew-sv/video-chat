"use client";

import { useIsMuted, useParticipants } from "@livekit/components-react";
import { type Participant, Track } from "livekit-client";
import { CamOffSmall, HandIcon, MicOffSmall } from "./icons";

export function PeoplePanel({ hands }: { hands: Map<string, number> }) {
  const participants = useParticipants();

  // Raised hands first (in the order they were raised), then everyone else
  // alphabetically.
  const sorted = [...participants].sort((a, b) => {
    const ha = hands.get(a.identity);
    const hb = hands.get(b.identity);
    if (ha && hb) return ha - hb;
    if (ha) return -1;
    if (hb) return 1;
    return (a.name || a.identity).localeCompare(b.name || b.identity);
  });

  return (
    <ul className="h-full space-y-1 overflow-y-auto p-2">
      {sorted.map((p) => (
        <PersonRow key={p.identity} participant={p} hand={hands.has(p.identity)} />
      ))}
    </ul>
  );
}

function PersonRow({ participant, hand }: { participant: Participant; hand: boolean }) {
  const micMuted = useIsMuted({ participant, source: Track.Source.Microphone });
  const camMuted = useIsMuted({ participant, source: Track.Source.Camera });
  const name = participant.name || participant.identity;

  return (
    <li className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold uppercase">
        {name.charAt(0)}
      </div>
      <span className="min-w-0 flex-1 truncate text-sm">
        {name}
        {participant.isLocal && <span className="text-muted"> (you)</span>}
      </span>
      {hand && <Status label="Hand raised"><HandIcon width={16} height={16} className="text-hand" /></Status>}
      {camMuted && <Status label="Camera off"><CamOffSmall className="text-muted" /></Status>}
      {micMuted && <Status label="Muted"><MicOffSmall className="text-danger" /></Status>}
    </li>
  );
}

function Status({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span title={label}>
      {children}
      <span className="sr-only">{label}</span>
    </span>
  );
}
