# On-device completion experiment

## Baseline checkpoint — 2026-10-04

Working implementation commit: `e39273c4`, on `codex/research-status`, published in draft PR #2. User confirmed audible completion speech, a suitable 45° upward pose and corrected horizontal turning toward them. Service diagnostics confirmed completion-card clearing. Detection and speech preparation/fetch currently depend on the Mac. Research events travel over Wi-Fi; USB is used for development/flashing.

Preserve this baseline before experimenting. Rollback means checking out the baseline and reinstalling its configured MOD; if the experiment changes host/native modules, rebuild and deploy the baseline host before reinstalling its MOD. Private local config stays ignored by Git.

## Experiment scope

1. Bundle the fixed completion sentence as local audio and play it on the robot without an HTTP audio fetch.
2. Investigate and integrate an on-device face detector into the Moddable host, keeping detection behind a replaceable capability.
3. Preserve bounded attention, 45° starting tilt, corrected yaw direction, once-only completion attempts and automatic card clearing.
4. Verify each increment on M5StackChan CoreS3. Mac still runs research and sends completion events; local hardware actions should no longer require Mac vision/audio endpoints.

No model has yet been selected or integrated for this experiment. M5Stack's UIFlow example uses `dl.model.HUMAN_FACE_DETECT`; this is not directly importable from a Moddable MOD. Native integration may require a host rebuild and dependency/toolchain checks.

## Progress

- Checkpoint prepared before experimental changes.

## Acceptance

- Completion audio plays without requesting `/v1/completion.wav`.
- Robot detects face location without sending camera frames to `/v1/face`.
- Local completion succeeds after an event even if Mac vision/audio helpers are unavailable.
- No-face/error paths finish and release camera/motor ownership; card clears.
- Baseline remains available for rollback; factory firmware is a separate implementation.
