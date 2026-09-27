import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { isValidRoomId } from "@/lib/room-id";
import { MAX_NAME_LENGTH, MAX_PARTICIPANTS } from "@/lib/limits";

// Issues a short-lived LiveKit access token. This is the only server-side
// step in joining a call; all media flows browser <-> SFU directly.
export async function POST(request: Request) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return Response.json({ error: "Server is not configured" }, { status: 500 });
  }

  let body: { room?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const room = typeof body.room === "string" ? body.room : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!isValidRoomId(room)) {
    return Response.json({ error: "Invalid meeting code" }, { status: 400 });
  }
  if (!name || name.length > MAX_NAME_LENGTH) {
    return Response.json(
      { error: `Name must be 1-${MAX_NAME_LENGTH} characters` },
      { status: 400 },
    );
  }

  // Friendly early answer for full rooms. The SFU's max_participants is the
  // real enforcement (this check can race), so if the lookup fails we let the
  // join proceed rather than block people on a control-plane hiccup.
  try {
    const rooms = await new RoomServiceClient(
      LIVEKIT_URL.replace(/^ws/, "http"),
      LIVEKIT_API_KEY,
      LIVEKIT_API_SECRET,
    ).listRooms([room]);
    if ((rooms[0]?.numParticipants ?? 0) >= MAX_PARTICIPANTS) {
      return Response.json(
        { error: `This meeting is full (${MAX_PARTICIPANTS} people max).` },
        { status: 409 },
      );
    }
  } catch (e) {
    console.warn("room occupancy check failed", e);
  }

  // Identity must be unique per connection so the same person can join from
  // two devices without kicking themselves out.
  const identity = `${name.slice(0, 16)}#${crypto.randomUUID().slice(0, 8)}`;
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: "10m", // only needs to be valid for the initial connect; the SFU refreshes it
  });
  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true, // raise hand is stored as a participant attribute
  });

  return Response.json(
    { token: await token.toJwt(), serverUrl: LIVEKIT_URL },
    { headers: { "Cache-Control": "no-store" } },
  );
}
