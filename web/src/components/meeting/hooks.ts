"use client";

import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import {
  ConnectionQuality,
  type Participant,
  type RemoteTrackPublication,
  RoomEvent,
  Track,
} from "livekit-client";
import { useCallback, useEffect, useState } from "react";

export const HAND_ATTRIBUTE = "hand";

/**
 * Raised hands, keyed by participant identity, valued by the time the hand
 * went up (so the list can show who asked first). Stored as a participant
 * attribute, which the SFU syncs to everyone, including late joiners.
 */
export function useRaisedHands(): Map<string, number> {
  const room = useRoomContext();
  const [hands, setHands] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const recompute = () => {
      const next = new Map<string, number>();
      const all: Participant[] = [
        room.localParticipant,
        ...room.remoteParticipants.values(),
      ];
      for (const p of all) {
        const raisedAt = Number(p.attributes[HAND_ATTRIBUTE]);
        if (raisedAt) next.set(p.identity, raisedAt);
      }
      setHands(next);
    };
    recompute();
    room
      .on(RoomEvent.ParticipantAttributesChanged, recompute)
      .on(RoomEvent.ParticipantDisconnected, recompute)
      .on(RoomEvent.Connected, recompute);
    return () => {
      room
        .off(RoomEvent.ParticipantAttributesChanged, recompute)
        .off(RoomEvent.ParticipantDisconnected, recompute)
        .off(RoomEvent.Connected, recompute);
    };
  }, [room]);

  return hands;
}

export function useMyHand() {
  const { localParticipant } = useLocalParticipant();
  const hands = useRaisedHands();
  const raised = hands.has(localParticipant.identity);
  const toggle = useCallback(() => {
    // An empty value deletes the attribute.
    void localParticipant.setAttributes({
      [HAND_ATTRIBUTE]: raised ? "" : String(Date.now()),
    });
  }, [localParticipant, raised]);
  return { raised, toggle };
}

/**
 * Audio-only mode: stop receiving everyone's camera video. Screen shares stay
 * on since they are usually the content of the meeting. Audio is never touched.
 */
export function useAudioOnlyMode(enabled: boolean) {
  const room = useRoomContext();

  useEffect(() => {
    const apply = (pub: RemoteTrackPublication) => {
      if (pub.source === Track.Source.Camera) pub.setSubscribed(!enabled);
    };
    const applyAll = () => {
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.trackPublications.values()) apply(pub);
      }
    };
    const onPublished = (pub: RemoteTrackPublication) => apply(pub);

    applyAll();
    room.on(RoomEvent.TrackPublished, onPublished);
    return () => {
      room.off(RoomEvent.TrackPublished, onPublished);
    };
  }, [room, enabled]);
}

/** True once our own connection has been poor for a sustained stretch. */
export function useSustainedPoorConnection(thresholdMs = 8000): boolean {
  const room = useRoomContext();
  const [poor, setPoor] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = (q: ConnectionQuality, p: Participant) => {
      if (p !== room.localParticipant) return;
      clearTimeout(timer);
      if (q === ConnectionQuality.Poor || q === ConnectionQuality.Lost) {
        timer = setTimeout(() => setPoor(true), thresholdMs);
      } else {
        setPoor(false);
      }
    };
    room.on(RoomEvent.ConnectionQualityChanged, onChange);
    return () => {
      clearTimeout(timer);
      room.off(RoomEvent.ConnectionQualityChanged, onChange);
    };
  }, [room, thresholdMs]);

  return poor;
}
