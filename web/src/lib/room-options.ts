import {
  AudioPresets,
  type RoomOptions,
  VideoPresets,
} from "livekit-client";

function isLikelyMobile(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Client media settings. The theme throughout: audio is small and must never
 * break, video is large and is allowed to degrade.
 */
export function buildRoomOptions(devices: {
  audioDeviceId?: string;
  videoDeviceId?: string;
}): RoomOptions {
  // Phones get a lower capture resolution: saves CPU, battery and uplink,
  // and a phone tile is never shown large to others anyway.
  const capture = isLikelyMobile() ? VideoPresets.h540 : VideoPresets.h720;

  return {
    // Subscriber side: only receive the resolution each tile is actually
    // rendered at, and pause video that is off-screen or in a hidden tab.
    adaptiveStream: true,
    // Publisher side: stop encoding simulcast layers nobody is watching.
    dynacast: true,
    audioCaptureDefaults: {
      deviceId: devices.audioDeviceId,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    videoCaptureDefaults: {
      deviceId: devices.videoDeviceId,
      resolution: capture.resolution,
    },
    publishDefaults: {
      // Audio: speech preset (~24 kbps Opus) marked high priority so the
      // browser's congestion controller sends it ahead of video.
      audioPreset: { ...AudioPresets.speech, priority: "high" },
      red: true, // redundant audio encoding: survives packet loss
      dtx: true, // send almost nothing while silent: 50 open mics cost ~nothing
      // Video: three simulcast layers so the SFU can pick a lower one per
      // receiver instead of making everyone suffer for the weakest link.
      simulcast: true,
      videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
      videoEncoding: { ...capture.encoding, priority: "low" },
      degradationPreference: "balanced",
      videoCodec: "vp8", // hardware/software support everywhere incl. older iOS
    },
    disconnectOnPageLeave: true,
  };
}
