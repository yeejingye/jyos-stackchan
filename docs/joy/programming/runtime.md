# Runtime programming practices

## Motion and cancellation

Use the motion capability, explicit radians and bounded poses. On this CoreS3, negative pitch tilts upward: desk gaze is −35°; research attention is −45°. Do not generalize that sign or mechanical range to another driver without calibration. Current desk turns use yaw ±0.15 and ±0.12 radians with one-second moves and 2.5-second holds.

Serialize commands. Await movement before starting dependent camera work. Bound motor promises (desk adapter uses two seconds), camera/attention work and speech. Use interruptible holds and generation checks between steps; await cleanup before starting another feature. Always attempt neutral return and torque release in `finally`, including cancellation and errors. This deliberately establishes neutral/torque-off rather than guessing a prior physical state. A timeout stops waiting; it does not prove a motor stopped.

## Time and idleness

Use a monotonic elapsed clock for inactivity, countdowns and deadlines. Accumulate unsigned `Time.ticks` deltas to survive the platform counter wrapping; avoid wall-clock subtraction for timers because network sync can jump the clock. Reset the desk idle deadline after motion cleanup and observed software activity. Unchanged service polls are not activity; arbitrary screen touches are currently not counted. A 15-minute quiet interval measures software inactivity, not human absence.

Use wall time for the display clock. Apply both timezone and DST, and reevaluate after network sync or a seasonal boundary. Berlin follows the last-Sunday March/October transitions at 01:00 UTC and is checked against independent IANA offsets. The rest of the existing city presets remain fixed offsets. Refresh a configured SNTP clock on Wi-Fi connection even when its retained date looks plausible: that shortcut caused approximately 138 seconds of observed drift.

## Touch input

Keep the top-panel subscription alive during automatic movement. Recognize direction reversals during continuous contact; do not require finger release for every swipe. Reject small jitter and isolated taps. Petting matches opposite swipe directions within 1.5 seconds, shows feedback immediately and hands motors over after cleanup. One unmatched swipe resets inactivity but does not cancel a sweep. Turning auto look-around off still allows petting; foreground ownership can suppress it.

## Piu UI

Use drawer capability methods rather than reaching into internal widgets. Group related actions; expose positive toggle labels such as Listening and Auto look-around. Present Start when idle and Pause/Resume plus Cancel while the timer is active. Update labels/subtitles in place so a countdown refresh preserves the touch target and selected page. Retain choices and switch state when the drawer is hidden or on its settings page.

Test actual Piu rendering at the host's display/command-list limits; a controller test alone cannot detect draw-list overflow. Provide diagnostics for sensor availability, event count, ownership and time before changing sensitivity blindly. Remove temporary effects when the owning feature ends.

## Audio, camera and voice

Share microphone, playback and detector ownership. Suspend recognition during cues/completion; reopen capture after playback and release voice resources before camera attention. Bound copied PCM queues in PSRAM and yield between inference calls. Account for actual AFE feed/fetch frame sizes and returned data before decoding. Report dropped/invalid frames and internal RAM as evidence, not a guessed cause.

Pin model sources and SHA-256 values, prepare through `voice:prepare`, and verify the compiled model/profile before interpreting experiments. Fresh-build verification mattered: one stale-native-object comparison was discarded. Compare positive probes, near-sounding negatives and real live commands separately. Synthetic success does not establish owner recognition; lowering confidence until a command passes can introduce false activations. Do not record/export human audio without explicit approval. Temporary approved samples and generated archives must be removed after diagnosis; retain aggregate results rather than private recordings.

## Network and persistence

Keep tokens and device-specific configuration in ignored local manifests. Use bounded requests and watchdogs, authenticated endpoints, monotonically increasing task sequences and service revisions. Serialize state mutation and persist before acknowledgment. Keep replay history bounded and document capacity: service 128 task IDs; robot last 16 completion IDs. Treat reconnects, reboot, duplicate events and old callbacks as normal lifecycle conditions. Update the Mac's LAN address after a network change; localhost cannot be reached by the robot. This prototype's bearer HTTP belongs on a trusted LAN without port forwarding.

Sources: [desk controller](../../../firmware/mods/desk_companion/controller.js), [touch recognizer](../../../firmware/host/modules/input/touch-panel-gesture.ts), [timezone model](../../../firmware/host/modules/preferences/timezone-model.ts), [voice diagnosis](../../../knowledge_base/feat/pomodoro/voice-diagnosis.md), [research README](../../../firmware/mods/research_companion/README.md).
