# Research companion

Tracks one research task on a complete M5StackChan CoreS3. On a newly observed task completing, the MOD searches for a face for up to eight seconds, makes bounded horizontal adjustments, plays a spoken completion cue, and clears the ready card after fifteen seconds. On this experimental branch, face inference and playback run on the robot. The fixed completion sentence is a bundled WAV, not arbitrary local text-to-speech. Deploy the experimental local-completion host before installing this MOD. Automatic Claude hooks remain a separate pending increment; the live research tests use a temporary external runner.

The robot polls an authenticated Mac HTTP service every two seconds. HTTP requests time out after three seconds. Idle hides the research card. A failed poll during active work shows a disconnected status; completion expiry runs locally even if Wi-Fi drops. The service task may remain ready after its card is cleared.

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

The service supplies research status. This experimental MOD does not need Mac speech preparation or Apple Vision. Its fixed completion sentence, “JY, your research note is ready for review,” is stored in `assets/research-ready.wav`.

Binding to `0.0.0.0` makes the service reachable on the LAN; omitting `--host` limits it to localhost. Use this HTTP prototype on a trusted LAN, without port forwarding: the shared token and messages are not encrypted. It transports brief status only, not note contents. Allow incoming connections if macOS prompts. Keep the Mac awake during testing.

Build and deploy the experimental host once, then install the MOD:

```sh
source ~/.local/share/xs-dev-export.sh
source ~/.espressif/python_env/idf6.1_py3.14_env/bin/activate
npm run build -- --manifest host/app/manifest_m5stackchan_cores3_local_completion.json
UPLOAD_PORT=/dev/cu.usbmodem101 npm run deploy -- --manifest host/app/manifest_m5stackchan_cores3_local_completion.json
npm run mod -- mods/research_companion/manifest.local.json --port /dev/cu.usbmodem101
```

This replaces the current MOD and reboots. The host rebuild is required for native face detection; subsequent MOD edits only need `npm run mod`. The service logs the first authenticated robot poll; idle should show the normal face with no card.

## Send a synthetic research sequence

Run each command separately and watch the screen:

```sh
npm run research:event -- --config mods/research_companion/manifest.local.json --task demo-1 --sequence 1 --phase gathering
npm run research:event -- --config mods/research_companion/manifest.local.json --task demo-1 --sequence 2 --phase comparing
npm run research:event -- --config mods/research_companion/manifest.local.json --task demo-1 --sequence 3 --phase drafting
npm run research:event -- --config mods/research_companion/manifest.local.json --task demo-1 --sequence 4 --phase ready
```

`ready` here is a manual test event, not proof that Claude research finished. The later Claude adapter must confirm a saved/checked ResearchNote before sending it. Use a new task ID for another demo after ready/failed; terminal tasks cannot resume.

Allow at least one poll interval between the start and ready commands: the robot deliberately ignores completion for a task it never saw active. Keep a face visible to its front camera. The largest detected face is the target; this detects location, not personal identity. The first hardware test rebooted during completion; stage diagnostics and an explicit camera-start correction were added. Camera orientation, motion direction, speech and clearing still need successful on-device confirmation before describing the sequence as hardware validated.

## Completion modules

Completion begins with a 45° upward head tilt (pitch −π/4 radians) over 1.5 seconds, including when no face is detected. The MOD waits for this movement before starting camera detection. Horizontal tracking preserves this pitch. The head returns to neutral after the announcement.

Horizontal tracking is now limited to ±30°, with adjustments capped at 10° per step. Positive detections were reported with the 45° tilt, but physical alignment and horizontal direction still need confirmation.

Current experimental detector: Espressif HumanFaceDetect 0.5.0 (MSR/MNP), running on the ESP32-S3 with ESP-DL 3.3.13. The model is embedded in flash. The MOD cycles through four orientations when no face is found, then keeps the successful orientation for confirmation. Coordinates are mapped back to the camera before moving. Real-face accuracy still requires device verification. This does not establish which model a particular factory firmware uses.

- `flow-runner.js`: injected display/completion handlers, timers, duplicate suppression, generation guards and dismissal; reusable for other flows.
- `completion.js`: explicit camera start/capture/stop, two stable detections, bounded yaw ±30°, local native face inference, bundled WAV playback, and optional stage diagnostics.
- Host `local-face-detector`: in-memory RGB565 inference; no camera upload.
- Mac `completion.mjs` / `detect-face.swift`: retained for the baseline Mac-assisted implementation; unused by this experimental MOD.

No-face and speech errors fall back to visual ready and automatic expiry. Face attention has an eleven-second outer deadline; speech has a twelve-second outer deadline. Audio is a finite three-second clip. Completion IDs are consumed before physical actions and the last sixteen IDs are stored in robot preferences, preventing immediate reconnect/reboot replay. This provides at-most-once attempts: reboot during an announcement does not retry it. A completed task received without first observing it active is ignored. This is bounded replay protection, not a durable general queue.

The sequence returns the head to neutral and releases torque; it does not infer or restore an unknown previous torque state. Horizontal direction/mirroring and alignment range require device calibration. Set `faceTracking: false` in local researchCompanion config only to isolate speech/clearing during diagnostics.

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
- Baseline-only `POST /v1/face` (unused by this experimental MOD): fixed 176×144 RGB565 little-endian frame (`application/octet-stream`), maximum 50,688 bytes; one detection request at a time.
- Baseline-only `GET /v1/completion.wav` (unused by this experimental MOD): prepared completion clip, also authenticated.
- `GET /v1/diagnostics`: most recent robot-reported completion stage; stage-only messages contain no images. The service prints stages during device checks.
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

## Offline completion test

The test MOD simulates a research completion locally and intentionally points helpers at loopback. It starts after host startup plus twelve seconds, then searches, speaks, restores neutral pose and expires the card. It temporarily replaces the research MOD:

```sh
npm run mod -- mods/research_companion/__tests__/local-completion/manifest.json --port /dev/cu.usbmodem101
npm run mod -- mods/research_companion/manifest.local.json --port /dev/cu.usbmodem101
```

The second command restores normal research triggering. See the [experiment record](../../../knowledge_base/feat/research-companion/on-device-experiment.md) for measured results and rollback.

## Launch real research

Use the dedicated launcher for direct research-agent runs. It reports actual web/write activity, gates readiness on successful agent exit plus a new validated ResearchNote, and keeps research functional when the companion is unavailable. It never hooks unrelated Claude stops. Existing interactive Claude sessions are not automatically instrumented by this command.

```sh
npm run research:run -- --config mods/research_companion/manifest.local.json \
  --project /Users/yeejingye/workspace/personal/jyos-system \
  --output "/Users/yeejingye/JYOS/Workbench/00 Inbox/Research - TOPIC.md" \
  --question "Your research question" \
  --source-host docs.m5stack.com --source-host moddable.com
```

Choose a new Markdown output path inside Workbench. Source-host restrictions are optional exact HTTPS hostnames; metadata validation does not establish factual correctness. The agent receives public-source-only scope and permission to write the selected note. Existing notes and paths escaping Workbench are rejected. Ctrl+C terminates the agent and reports failure/cancellation rather than ready. Notification requests have a 1.5-second deadline; research has a 15-minute execution limit. Private token stays in the ignored local config. No transcript or camera image is retained by this launcher.
