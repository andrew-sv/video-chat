"use client";

import {
  CarouselLayout,
  ConnectionStateToast,
  DisconnectButton,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  LeaveIcon,
  RoomAudioRenderer,
  StartAudio,
  TrackToggle,
  useChat,
  useParticipants,
  useTracks,
} from "@livekit/components-react";
import {
  isTrackReference,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-core";
import { Track } from "livekit-client";
import { useMemo, useState } from "react";
import { MAX_PARTICIPANTS } from "@/lib/limits";
import { ChatPanel } from "./ChatPanel";
import { PeoplePanel } from "./PeoplePanel";
import { Tile } from "./Tile";
import {
  useAudioOnlyMode,
  useMyHand,
  useRaisedHands,
  useSustainedPoorConnection,
} from "./hooks";
import {
  ChatBubbleIcon,
  CloseIcon,
  HandIcon,
  LinkIcon,
  PeopleIcon,
} from "./icons";

type Panel = "chat" | "people" | null;

export function Conference({ roomId }: { roomId: string }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [audioOnly, setAudioOnly] = useState(false);
  const [dismissedWeakNet, setDismissedWeakNet] = useState(false);

  const participants = useParticipants();
  const hands = useRaisedHands();
  const myHand = useMyHand();
  const chat = useChat();
  const unread = useUnread(chat.chatMessages.length, panel === "chat");
  const weakNetwork = useSustainedPoorConnection();
  useAudioOnlyMode(audioOnly);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const screenShare = tracks.find(
    (t) => isTrackReference(t) && t.source === Track.Source.ScreenShare,
  );
  const cameras = useMemo(
    () =>
      tracks
        .filter((t) => t.source === Track.Source.Camera)
        // In audio-only mode remote cameras are unsubscribed; show avatars
        // instead of frozen/black video.
        .map((t): TrackReferenceOrPlaceholder =>
          audioOnly && !t.participant.isLocal
            ? { participant: t.participant, source: Track.Source.Camera }
            : t,
        ),
    [tracks, audioOnly],
  );

  // False on iOS/Android browsers, which have no screen capture API.
  const canScreenShare =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    "getDisplayMedia" in navigator.mediaDevices;

  return (
    <div className="flex h-full flex-col bg-background">
      <Header
        roomId={roomId}
        count={participants.length}
        audioOnly={audioOnly}
        onToggleAudioOnly={() => setAudioOnly((v) => !v)}
      />

      {weakNetwork && !audioOnly && !dismissedWeakNet && (
        <div
          role="status"
          className="mx-3 mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-hand/40 bg-hand/10 px-4 py-2 text-sm"
        >
          <span className="flex-1">
            Your connection is weak. Turn off incoming video to keep audio
            clear?
          </span>
          <button
            onClick={() => setAudioOnly(true)}
            className="rounded-lg bg-hand px-3 py-1 font-medium text-black"
          >
            Audio only
          </button>
          <button onClick={() => setDismissedWeakNet(true)} className="text-muted">
            Dismiss
          </button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 gap-3 px-3">
        <main className="min-h-0 min-w-0 flex-1">
          {screenShare && isTrackReference(screenShare) ? (
            <FocusLayoutContainer className="h-full">
              <CarouselLayout tracks={cameras}>
                <Tile />
              </CarouselLayout>
              <FocusLayout trackRef={screenShare} />
            </FocusLayoutContainer>
          ) : (
            <GridLayout tracks={cameras} className="h-full">
              <Tile />
            </GridLayout>
          )}
        </main>

        {panel && (
          <aside
            className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-none bg-surface md:static md:w-80 md:rounded-2xl md:border md:border-border lg:w-96"
            aria-label={panel === "chat" ? "Chat" : "Participants"}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-semibold">
                {panel === "chat" ? "Chat" : `People (${participants.length})`}
              </h2>
              <button
                onClick={() => setPanel(null)}
                className="rounded-lg p-1 text-muted hover:bg-surface-2"
                aria-label="Close panel"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              {panel === "chat" ? (
                <ChatPanel
                  messages={chat.chatMessages}
                  send={chat.send}
                  isSending={chat.isSending}
                />
              ) : (
                <PeoplePanel hands={hands} />
              )}
            </div>
          </aside>
        )}
      </div>

      <nav
        aria-label="Call controls"
        className="pb-safe flex items-center justify-center gap-2 px-2 pt-3"
      >
        <TrackToggle source={Track.Source.Microphone} className="ctrl" aria-label="Microphone" />
        <TrackToggle source={Track.Source.Camera} className="ctrl" aria-label="Camera" />
        {canScreenShare && (
          <TrackToggle
            source={Track.Source.ScreenShare}
            className="ctrl"
            aria-label="Share screen"
            captureOptions={{ audio: true, contentHint: "detail" }}
          />
        )}
        <CtrlButton
          label={myHand.raised ? "Lower hand" : "Raise hand"}
          pressed={myHand.raised}
          onClick={myHand.toggle}
          activeClass="!bg-hand !text-black"
        >
          <HandIcon />
        </CtrlButton>
        <CtrlButton
          label="Chat"
          pressed={panel === "chat"}
          onClick={() => setPanel(panel === "chat" ? null : "chat")}
          badge={unread}
        >
          <ChatBubbleIcon />
        </CtrlButton>
        <CtrlButton
          label="Participants"
          pressed={panel === "people"}
          onClick={() => setPanel(panel === "people" ? null : "people")}
          badge={hands.size}
          badgeClass="bg-hand text-black"
        >
          <PeopleIcon />
        </CtrlButton>
        <DisconnectButton className="ctrl !bg-danger !text-white" aria-label="Leave call">
          <LeaveIcon />
        </DisconnectButton>
      </nav>

      <RoomAudioRenderer />
      {/* Mobile Safari blocks autoplay; this shows a button when needed. */}
      <StartAudio label="Tap to enable audio" className="fixed left-1/2 top-16 z-30 -translate-x-1/2" />
      <ConnectionStateToast />
    </div>
  );
}

function Header({
  roomId,
  count,
  audioOnly,
  onToggleAudioOnly,
}: {
  roomId: string;
  count: number;
  audioOnly: boolean;
  onToggleAudioOnly: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = `${location.origin}/r/${roomId}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title: "Join my meeting", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user dismissed share sheet or clipboard blocked; nothing to do
    }
  }

  return (
    <header className="flex items-center gap-2 px-3 py-2 text-sm">
      <span className="font-mono text-muted">{roomId}</span>
      <button
        onClick={copyLink}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-surface-2"
      >
        <LinkIcon width={16} height={16} />
        <span className="hidden sm:inline">{copied ? "Copied!" : "Invite"}</span>
      </button>
      <div className="flex-1" />
      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-2">
        <input
          type="checkbox"
          checked={audioOnly}
          onChange={onToggleAudioOnly}
          className="accent-accent"
        />
        Audio only
      </label>
      <span className="text-muted" title="Participants">
        {count}/{MAX_PARTICIPANTS}
      </span>
    </header>
  );
}

function CtrlButton({
  label,
  pressed,
  onClick,
  children,
  badge,
  badgeClass = "bg-accent text-white",
  activeClass = "!bg-accent !text-white",
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
  badgeClass?: string;
  activeClass?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={`ctrl relative ${pressed ? activeClass : ""}`}
    >
      {children}
      {!!badge && (
        <span
          className={`absolute -right-1 -top-1 min-w-5 rounded-full px-1 text-center text-[11px] font-semibold leading-5 ${badgeClass}`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

/** Counts messages that arrived while the chat panel was closed. */
function useUnread(total: number, open: boolean): number {
  const [seen, setSeen] = useState(total);
  if (open && seen !== total) setSeen(total);
  return open ? 0 : total - seen;
}
