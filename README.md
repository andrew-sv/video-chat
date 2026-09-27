# Meet: browser video calls

Zoom-style video meetings: join from a link with nothing to install, up to 50
people per call, with video, audio, screen sharing, chat, raise hand, and
mute/camera controls. It works on laptops and phones, and on weak networks
audio stays clear while video degrades.

* `web/`: Next.js app (UI and the `/api/token` endpoint)
* `infra/`: LiveKit SFU configs (local dev and production template)
* [`ARCHITECTURE.md`](ARCHITECTURE.md): design, scaling to 1M concurrent calls, and how each requirement is met

## Run locally

```sh
brew install livekit livekit-cli          # SFU server + CLI (Linux: see docs.livekit.io)

# terminal 1: media server
livekit-server --config infra/livekit.dev.yaml --dev

# terminal 2: web app
cd web
cp .env.example .env.local
pnpm install
pnpm dev                                   # http://localhost:3000
```

Open http://localhost:3000, start a meeting, and open the link in a second
browser window.

**Fill a call with fake participants** (they publish test-pattern video):

```sh
lk load-test --url ws://localhost:7880 --api-key devkey --api-secret secret \
  --room abc-defg-hij --video-publishers 12 --audio-publishers 3
# then open http://localhost:3000/r/abc-defg-hij
```

**Test from a phone**: browsers only allow camera access on `https://` or
`localhost`. Tunnel both ports (for example with `cloudflared tunnel --url`),
set `LIVEKIT_URL` to the SFU tunnel's `wss://` URL, and start the SFU without
`--bind 127.0.0.1` restrictions.

## Deploy

* **Web app**: deploy `web/` to Vercel (or any Node host). Set `LIVEKIT_URL`,
  `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
* **SFU**: either LiveKit Cloud (just set the three env vars) or self-hosted
  nodes from `infra/livekit.prod.yaml`. See ARCHITECTURE.md.
