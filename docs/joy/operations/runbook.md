# Operating and diagnosing Joy

## Sidebar and features

Tap the face to reveal the top menu, then tap the top-right burger before it hides after approximately four seconds. The drawer groups Desk companion, Pomodoro and Voice. Its secondary Settings page contains ungrouped controls, including Touch & clock status.

Look around starts a sweep when auto movement is enabled and no foreground owner blocks it. Auto look-around off stops the sweep and disables automatic/manual sweeps; switching back on starts a fresh 15-minute interval. Petting remains enabled while auto is off. Stroke the top panel back and forth within 1.5 seconds for happy/heart/head-shake feedback. Active or paused Pomodoro, voice cues/listening and research presentation take priority.

Start focus begins one 20/5 Pomodoro cycle; Pause/Resume and Cancel appear during a session. Listening toggles voice recognition independently of the timer. Reboot clears the timer and volatile auto-pause state. Hi Joy → spoken prompt → Tomato/pause/resume/cancel is implemented, but human command reliability is still under acceptance. Use the manual controls as the dependable control path.

## Mac research service

From `firmware/`, set the private companion host to the current Mac Wi-Fi IPv4 address (`ipconfig getifaddr en0` on this machine), then reinstall the MOD after a changed address. Keep its token private and matching the service.

```sh
npm run research:serve -- --config mods/research_companion/manifest.local.json --host 0.0.0.0
npm run research:state -- --config mods/research_companion/manifest.local.json
```

Binding all interfaces permits robot LAN access; omitting the host option leaves the service local-only. Keep the Mac awake. Research status is not an Internet dependency; it is a Mac/Wi-Fi dependency. Normal desk and manual timer operation remain local. A restarted configured service restores persisted identity/task/revision. Do not interpret service-ready as factual correctness of a note.

## Troubleshooting

| Symptom | Check first |
| --- | --- |
| No petting reaction | Touch & clock status: panel ready, changing samples, gesture/event count and Blocked reason. Verify the combined MOD and continuous-stroke host fix are installed. Firmware presence is not physical touch confirmation. |
| Look-around does not start | Auto switch, foreground ownership, 15 minutes since observed activity/cleanup. A single touch restarts inactivity. |
| Clock is hours wrong | Settings timezone; Berlin preferred locally, with saved preferences overriding MOD defaults. Only Berlin currently has seasonal adjustment. |
| Clock is minutes wrong | Wi-Fi/SNTP reachability and correct host version; plausible retained dates now resync. Compare fresh telemetry timestamps, not old cached reports. |
| Mac disconnected | Awake Mac, current LAN address, matching port/token, listening interface and same Wi-Fi; address changes caused a previous outage. |
| Check shared token | HTTP 401; compare the private robot and service configuration without publishing the token. |
| Voice command fails | Manual controls, model/profile build evidence, microphone/frame/drop diagnostics, live positives and negatives. Do not lower the live threshold blindly. |
| Servo/camera/voice stall | Ownership, bounded deadlines, cleanup, resource pressure and startup logs. A failure trace can support a hypothesis; it does not prove root cause. |
| Device stays in download mode | Confirm reset/bootloader state and serial reachability. Previous recovery required physical download-mode recovery and an explicit watchdog reset; do not erase flash without a specific reason. |

Authenticated service diagnostics: `GET /v1/device-status` reports the latest robot clock, touch samples/events, blocking owner and motion; `GET /v1/diagnostics` reports the last completion stage. Both require the configured bearer token. A rest sample `[0,0,0]` is expected when not touching. Check report age before relying on it.

## Recovery and repository care

The stable tag `stable/joy-desk-companion-2026-10-06` preserves firmware source; `main` includes the subsequent pipeline removal. Rebuild using [the matching profile and private manifest](../programming/build-and-test.md) to restore a deployment. It is a source checkpoint, not a backup of credentials, generated artifacts or every device preference.

Before destructive branch cleanup, save unique history and preserve worktree files. The 6 October cleanup saved a temporary bundle under `/private/tmp/stackchan-before-main-cleanup-20261006.bundle` and detached the older linked worktree; temporary files may be removed by the OS and are not durable backup storage. The unrelated local overview HTML edit was preserved outside the stable commit. Do not silently overwrite it while maintaining this new documentation.
