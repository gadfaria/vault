# Camera bridge

The Câmeras module can't play the camera directly: browsers don't speak RTSP, and an HTTPS page
can't load a LAN address. A machine at home runs two programs:

```
camera ──RTSP──▶ go2rtc (127.0.0.1:1984) ──▶ cloudflared ──HTTPS──▶ cam.<domain> ──▶ Vault › Câmeras
```

- **go2rtc** reads the camera's RTSP stream and serves a player (`/stream.html?src=<stream>`)
  using WebRTC or MSE. It listens only on localhost.
- **cloudflared** publishes it at `https://cam.<domain>` without opening router ports.
  **Cloudflare Access** in front of it requires your Google login; without it anyone with the link
  could watch the camera.

The camera password lives only in `go2rtc.yaml` on that machine (git-ignored). The Vault stores
just the bridge address and the stream name.

The machine must stay on and awake, on the same network as the camera.

## 1. go2rtc

Download the binary for the machine from https://github.com/AlexxIT/go2rtc/releases
(`go2rtc_mac_arm64.zip` on Apple Silicon, `go2rtc_linux_arm64` on a Raspberry Pi) into
`~/.local/bin/go2rtc`, then:

```bash
cd bridge
cp go2rtc.example.yaml go2rtc.yaml   # fill in the camera IP and password
~/.local/bin/go2rtc -config go2rtc.yaml
```

Open http://127.0.0.1:1984 and check the stream plays. On macOS, allow go2rtc in
System Settings › Privacy & Security › Local Network if it asks (otherwise the camera
fails with "No route to host").

Run it as a service (macOS):

```bash
sed -e "s|GO2RTC_BIN|$HOME/.local/bin/go2rtc|" -e "s|BRIDGE_DIR|$PWD|g" com.vault.go2rtc.plist \
  > ~/Library/LaunchAgents/com.vault.go2rtc.plist
launchctl load ~/Library/LaunchAgents/com.vault.go2rtc.plist
```

On a Raspberry Pi, a systemd unit with the same command does the same.

## 2. Cloudflare Tunnel + Access

In the Cloudflare dashboard (Zero Trust), Access first, so the camera is never public:

1. **Access › Applications › Add › Self-hosted (public DNS)** for `cam.<domain>`, with a policy that
   allows only your e-mail (Google or one-time PIN login).
2. **Networks › Tunnels › Create a tunnel** (Cloudflared). Install the connector with the command
   it shows (`sudo cloudflared service install <token>`), and don't share the token. Add a public
   hostname `cam.<domain>` → HTTP `localhost:1984`.

Check it: `curl -I https://cam.<domain>/api/streams` must redirect to `cloudflareaccess.com`.

Moving to another machine: install go2rtc and the connector with the same token there, and stop
them here. The address doesn't change, so the Vault needs nothing.

## 3. Pan/tilt (optional)

For cameras that move (ONVIF PTZ), `ptz-server.mjs` (Node, no dependencies) serves a player with
arrows at `/ptz/?src=<stream>` and turns presses into ONVIF moves. It reads the camera credentials
from `go2rtc.yaml`, listens on `127.0.0.1:1985`, and accepts only move and stop, with a capped speed;
a move stops by itself after 1 s unless the page renews it. Every other request (player files, the
video socket) is passed through to go2rtc, whose `allow_paths` still applies.

```bash
node ptz-server.mjs   # try it; then as a service (macOS):
sed -e "s|NODE_BIN|$(which node)|" -e "s|BRIDGE_DIR|$PWD|g" com.vault.ptz.plist \
  > ~/Library/LaunchAgents/com.vault.ptz.plist
launchctl load ~/Library/LaunchAgents/com.vault.ptz.plist
```

In the tunnel, point `cam.<domain>` at HTTP (not HTTPS) `localhost:1985` instead of 1984. A
separate `ptz/*` route works too, but only listed **above** the general one (routes match top to
bottom). Either way it sits behind the same Access application.

Restart it after editing `go2rtc.yaml` (`launchctl kickstart -k gui/$(id -u)/com.vault.ptz`).

## 4. Vault

Câmeras › Nova câmera: bridge address `https://cam.<domain>`, stream `living-room`, and
"Tem controle de movimento" for a camera that moves.
The first time, use "Abrir em nova aba" to log in to Access; after that the player loads inside
the Vault.
