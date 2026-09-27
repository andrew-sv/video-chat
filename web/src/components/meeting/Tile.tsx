"use client";

import {
  ParticipantTile,
  useParticipantAttribute,
  useTrackRefContext,
} from "@livekit/components-react";
import { HAND_ATTRIBUTE } from "./hooks";
import { HandIcon } from "./icons";

/** Standard LiveKit tile plus a raised-hand badge. Rendered inside a TrackLoop. */
export function Tile() {
  const trackRef = useTrackRefContext();
  const hand = useParticipantAttribute(HAND_ATTRIBUTE, {
    participant: trackRef.participant,
  });

  return (
    <div className="relative h-full w-full">
      <ParticipantTile className="h-full w-full" />
      {hand && (
        <div
          className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-hand px-2 py-1 text-xs font-semibold text-black shadow"
          title="Hand raised"
        >
          <HandIcon width={14} height={14} />
          <span className="sr-only">Hand raised</span>
        </div>
      )}
    </div>
  );
}
