# Architecture

## Shape of the system

```
 Browser (desktop / mobile)                          Control plane
 ┌───────────────────────────┐   1. POST /api/token  ┌──────────────────────────┐
 │ Next.js client            │ ────────────────────▶ │ Next.js on Vercel        │
 │ livekit-client (WebRTC)   │ ◀──────────────────── │ issues 10-min JWT,       │
 └─────────────┬─────────────┘      token + SFU URL  │ checks room occupancy    │
               │                                     └──────────────────────────┘
               │ 2. WebSocket signaling + WebRTC media (UDP, TCP or TURN/TLS :443)
               ▼
 ┌─────────────────────────────── Region (e.g. us-east) ───────────────────────┐
 │  L4 load balancer / anycast ──▶  SFU node  SFU node  SFU node  …  (LiveKit)   │
 │                                      │         │         │                  │
 │                                      └──── Redis (room → node routing) ──────│
 └──────────────────────────────────────────────────────────────────────────────┘
```

* **Media plane: LiveKit SFU** (open source, Apache 2.0, self-hosted). Each
  participant uploads once and the SFU forwards packets to everyone else. It
  never decodes or re-encodes, which is what makes it cheap enough at this scale.
* **Control plane: Next.js.** It has one job: mint an access token. It never
  touches media, so it scales like any stateless web endpoint.
* **Chat, raise hand and presence** travel over the SFU's own data channels and
  participant attributes. Nothing else is stateful per call.

## Why a single room never spans nodes

The product limit is 50 people per call. A 50-person room is small for one SFU
node, so **each room lives on exactly one node** and the cluster scales out by
spreading rooms, not by splitting them. That removes the hardest distributed
systems problem (cascading media between servers for one call) from the design.
Redis records which node owns each room, so a participant who reaches any node
is routed to the right one.

Trade-off: everyone in a call connects to the room's node, even from the other
side of the world. The first joiner's region is chosen (`regionaware` selector),
which is right for the typical call where people are near each other. If
intercontinental calls turn out to matter, the next step is SFU cascading (or
LiveKit Cloud, which does it).

## Capacity at 1M concurrent calls

Everything below is an **estimate to validate with a load test**, not a measurement.

| Input | Assumption |
|---|---|
| Concurrent calls at peak | 1,000,000 (given) |
| Average participants per call | ~3 (most calls are 1:1 or small; 50 is the ceiling). **Validate with product data.** |
| Concurrent participants | ~3M |
| Uplink per participant | ~0.5–1.5 Mbps video (simulcast; dynacast drops unwatched layers) + ~24–32 kbps audio |
| Downlink per participant | ~1–2 Mbps (grid tiles pull the 180p layer at ~150 kbps each; 1:1 pulls 720p) |

That gives roughly **3–5 Tbps of SFU egress at peak**, spread across regions.
Bandwidth, not CPU or the control plane, is the dominant cost.

**Nodes needed** = concurrent participants ÷ participants per node. The
participants-per-node figure depends on instance type and the call-size mix.
Measure it: run `lk load-test` against one production-spec node, raising load
until p99 forwarding latency or packet loss degrades, then run at ~60–70% of
that. `infra/livekit.prod.yaml` stops placing new rooms on a node at 70%
system load and caps tracks and bytes per node, so a hot node sheds new rooms
instead of degrading existing calls.

**Control plane**: 10M DAU joining a few calls a day is a few hundred token
requests per second on average and low thousands at peak. Each is a JWT
signature plus one Redis-backed occupancy lookup, which is trivial for serverless.

## Requirement → mechanism

| Requirement | How |
|---|---|
| Join from a link, no install | `/r/abc-defg-hij` URL → pre-join screen (camera preview, name) → call. Pure WebRTC in the browser. |
| 50 participants, video, audio, screen share | SFU `room.max_participants: 50` (hard limit) + friendly 409 from `/api/token`. Paginated grid; screen share takes focus with cameras in a strip. |
| Chat, raise hand, mute, camera | Chat: LiveKit text streams. Hand: `hand` participant attribute (synced to late joiners, sorted by time raised). Mute/camera: track toggles. |
| Laptops and mobile browsers | Responsive layout using `100dvh` and safe-area insets; chat/people become full-screen sheets; swipeable grid pages; share sheet for invites; `StartAudio` for iOS autoplay rules; lower capture resolution on touch devices; screen share offered only where the browser supports it. |
| Weak networks | Simulcast (180p/360p/720p) so each receiver gets a layer that fits its bandwidth. Adaptive stream fetches only the resolution a tile is shown at and pauses off-screen or hidden-tab video. Dynacast stops encoding layers nobody watches. TCP and TURN/TLS on 443 get through restrictive firewalls. Automatic reconnect with ICE restart. |
| **Audio stays clear when video drops** | (1) Opus speech preset at ~24 kbps, marked **high network priority**, with video marked low, so the browser's congestion controller cuts video first. (2) **RED** (redundant audio) survives packet loss without retransmission delay. (3) **DTX**: silent mics send almost nothing, so 50 open mics cost little. (4) SFU congestion control drops video layers, then **pauses video entirely**, before touching audio. (5) If our own connection stays poor for 8 s, the UI offers **audio-only mode**, which unsubscribes all camera video. |

## Production checklist (not built yet)

* **SFU fleet**: Kubernetes (LiveKit Helm chart) or VM autoscaling groups per
  region with host networking, regional Redis, a TURN/TLS certificate, and an L4
  load balancer. Autoscale on node CPU and bandwidth, and drain nodes gracefully
  (existing rooms finish, no new rooms placed).
* **Abuse**: rate-limit `/api/token` per IP (Vercel Firewall); optionally require
  sign-in to *create* a meeting while keeping joins anonymous.
* **Host controls**: mute others, remove participants, lower hands, lock the
  room, waiting room. These need a host role in the token plus server-side
  RoomService calls.
* **Persistence**: chat history for late joiners and recording via LiveKit Egress.
* **Observability**: SFU Prometheus metrics (packet loss, jitter, and the
  bitrate of forwarded video layers), client-side connection-quality telemetry,
  and join success rate by browser.
* **E2EE**: LiveKit supports insertable-streams E2EE if required.

## Build vs. buy

The client code is identical against **LiveKit Cloud**: change `LIVEKIT_URL`
and the keys. At 3–5 Tbps, self-hosting is usually much cheaper in bandwidth
but means owning a global media fleet. A reasonable path is to launch on Cloud,
measure real call-size and bandwidth numbers, then move the heaviest regions to
self-hosted nodes.
