# Research companion: Wi-Fi status foundation

Tracks one research task on a complete M5StackChan CoreS3. This first increment displays studying/progress/ready/error states. It does **not** yet connect Claude hooks, validate ResearchNotes, speak, move the head, or locate faces.

The robot polls an authenticated Mac HTTP service every two seconds. HTTP requests time out after three seconds. A failed poll shows a disconnected status; successful polls restore the latest state without reapplying duplicate revisions.

Status appears in a wide dark bottom card: 24px phase heading, 16px detail, and colored stage markers. Long custom text is shortened on-screen; the full text remains in the service snapshot. Markers show actual phases, not estimated completion percentages.

## Configure and run

From `firmware/`, copy the example config:

```sh
cp mods/research_companion/manifest.example.json mods/research_companion/manifest.local.json
```

Edit that ignored local file: set `host` to your Mac's Wi-Fi IPv4 address (`ipconfig getifaddr en0`), `port` to `8787`, and `token` to a random shared value of 16–128 letters/digits/underscores/hyphens. A token can be generated with:

```sh
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"
```

The host firmware must already be connected to the same Wi-Fi. Do not put your Wi-Fi password in this MOD config. Use the robot's existing Wi-Fi settings.

Start the Mac service in one terminal:

```sh
npm run research:serve -- --config mods/research_companion/manifest.local.json --host 0.0.0.0
```

Binding to `0.0.0.0` makes the service reachable on the LAN; omitting `--host` limits it to localhost. Use this HTTP prototype on a trusted LAN, without port forwarding: the shared token and messages are not encrypted. It transports brief status only, not note contents. Allow incoming connections if macOS prompts. Keep the Mac awake during testing.

In another terminal, install the MOD:

```sh
source ~/.local/share/xs-dev-export.sh
source ~/.espressif/python_env/idf6.1_py3.14_env/bin/activate
npm run mod -- mods/research_companion/manifest.local.json --port /dev/cu.usbmodem101
```

This replaces the current MOD and reboots. No host rebuild is needed. The service logs the first authenticated robot poll; the idle screen should read Ready to research.

## Send a synthetic research sequence

Run each command separately and watch the screen:

```sh
npm run research:event -- --config mods/research_companion/manifest.local.json --task demo-1 --sequence 1 --phase gathering
npm run research:event -- --config mods/research_companion/manifest.local.json --task demo-1 --sequence 2 --phase comparing
npm run research:event -- --config mods/research_companion/manifest.local.json --task demo-1 --sequence 3 --phase drafting
npm run research:event -- --config mods/research_companion/manifest.local.json --task demo-1 --sequence 4 --phase ready
```

`ready` here is a manual test event, not proof that Claude research finished. The later Claude adapter must confirm a saved/checked ResearchNote before sending it. Use a new task ID for another demo after ready/failed; terminal tasks cannot resume.

```sh
npm run research:state -- --config mods/research_companion/manifest.local.json
npm run test:research
npm exec -- biome check mods/research_companion tools/research-companion
```

Test reconnection by stopping the service with Ctrl+C, observing Mac disconnected, then restarting it. A restart begins a new empty service session; it does not restore the previous task. For localhost tests use the default CLI URL; an alternate service uses `--url http://HOST:PORT`. The CLI token can also come from `STACKCHAN_COMPANION_TOKEN` instead of a config file.

To restore the greeting:

```sh
npm run mod -- mods/jyos_hello/manifest.json --port /dev/cu.usbmodem101
```

## Protocol

- `GET /v1/state`: latest snapshot, including service ID and revision.
- `POST /v1/events`: event JSON; requires `Content-Type: application/json`.
- Both require `Authorization: Bearer <token>`.
- Event: `{ "version": 1, "taskId": "demo-1", "sequence": 1, "phase": "gathering" }`.
- Optional `text`: at most 80 characters. Default labels fit the screen; longer custom labels may wrap.
- Phases: confirming, gathering, comparing, drafting, needs-input, ready, failed. Service starts idle.
- New tasks start with sequence 1 and confirming/gathering. Only one active task is allowed. Sequence numbers increase; gaps are allowed.
- Exact retries receive `duplicate: true`. Stale, conflicting, retired-task, and busy-task events return 409 without changing state.
- Event replies acknowledge Mac-service acceptance, **not robot rendering or physical action**.
- State is memory-only. Session capacity is 128 task IDs without eviction; restart begins a new session. Cross-restart replay protection and persistent completion deduplication belong to the next increment.

## Screen troubleshooting

| Message | Meaning |
| --- | --- |
| Configure companion | Missing/invalid Mac address, token, or port |
| Configure Wi-Fi | Host boot Wi-Fi attempt did not connect; configure it, then reboot |
| Check shared token | Service responded 401; ensure both use the same token |
| Mac disconnected | Service unavailable, invalid response, or LAN connection blocked |

See [feature design](../../../knowledge_base/feat/research-companion/design.md) and [issue #1](https://github.com/yeejingye/jyos-stackchan/issues/1).
