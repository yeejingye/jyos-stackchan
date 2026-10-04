# On-device completion experiment

## Baseline checkpoint — 2026-10-04

Working implementation commit: `e39273c4`, on `codex/research-status`, published in draft PR #2. User confirmed audible completion speech, a suitable 45° upward pose and corrected horizontal turning toward them. Service diagnostics confirmed completion-card clearing. Detection and speech preparation/fetch currently depend on the Mac. Research events travel over Wi-Fi; USB is used for development/flashing.

Preserve this baseline before experimenting. Rollback means checking out the baseline and reinstalling its configured MOD; if the experiment changes host/native modules, rebuild and deploy the baseline host before reinstalling its MOD. Private local config stays ignored by Git.

## Experiment scope

1. Bundle the fixed completion sentence as local audio and play it on the robot without an HTTP audio fetch.
2. Investigate and integrate an on-device face detector into the Moddable host, keeping detection behind a replaceable capability.
3. Preserve bounded attention, 45° starting tilt, corrected yaw direction, once-only completion attempts and automatic card clearing.
4. Verify each increment on M5StackChan CoreS3. Mac still runs research and sends completion events; local hardware actions should no longer require Mac vision/audio endpoints.

Selected model: Espressif HumanFaceDetect 0.5.0, default MSR/MNP, with ESP-DL 3.3.13. The model is embedded in flash through an opt-in host manifest. M5Stack's UIFlow example uses `dl.model.HUMAN_FACE_DETECT`; this is not directly importable from a Moddable MOD. Native integration may require a host rebuild and dependency/toolchain checks.

## Progress

- Checkpoint `4c5f047e` committed and pushed on `codex/research-status` before experimentation.
- Experiment isolated on `codex/on-device-completion`.
- Bundled 47,682-byte PCM WAV; audio HTTP fetch removed.
- Native detector host build passed on ESP-IDF 6.1, with 49% of the app partition free.
- 405 unit tests, 16 companion tests, and 4 dependency-preparation tests passed.
- Experimental host flashed and digest verified.
- Native blank-frame inference and invalid-input/close checks passed before a test display-hook error; display hook corrected to use the created context.
- Offline completion test: local camera inference completed repeatedly (first call 259 ms, subsequent calls 106–129 ms), local audio reported PASS, hardware cleanup finished, and card clearing was logged. No face was detected in this run; real-face alignment remains unverified.
- Normal research MOD restored after the test; test flow is not left installed.
- The host reported connected Wi-Fi once boot completed. Its early “No Wi-Fi SSID” message was not sufficient to conclude that credentials were lost.

## Acceptance

- Completion audio plays without requesting `/v1/completion.wav`.
- Robot detects face location without sending camera frames to `/v1/face`.
- Local completion succeeds after an event even if Mac vision/audio helpers are unavailable.
- No-face/error paths finish and release camera/motor ownership; card clears.
- Baseline remains available for rollback; factory firmware is a separate implementation.

## Commands

From `firmware/`, after sourcing the existing xs-dev export and IDF Python environment:

```sh
npm run build -- --manifest host/app/manifest_m5stackchan_cores3_local_completion.json
UPLOAD_PORT=/dev/cu.usbmodem101 npm run deploy -- --manifest host/app/manifest_m5stackchan_cores3_local_completion.json
npm run mod -- mods/research_companion/manifest.local.json --port /dev/cu.usbmodem101
```

Rollback on the preserved baseline branch: build/deploy its standard host, then reinstall its configured research MOD. Keep local private configuration ignored. Face orientation, real-user accuracy, inference latency and reboot stability require device measurements; a successful build alone does not establish these.

## Local completion architecture

```mermaid
flowchart LR
    A[Claude research agent on Mac] --> S[Status service on Mac]
    S -->|Wi-Fi snapshots| F[Modular flow runner on robot]
    F -->|ready| T[Tilt up 45 degrees]
    T --> C[CoreS3 camera]
    C -->|RGB565LE in memory| D[ESP-DL face detector]
    D --> M[Bounded horizontal tracking]
    M --> W[Bundled completion WAV]
    W --> P[Robot speaker]
    P --> N[Neutral pose and torque release]
    N --> H[Hide card after 15 seconds]
```

The Mac-assisted baseline remains in checkpoint `4c5f047e`. The experimental research MOD requires the matching native host; it does not silently fall back to Mac vision. Optional diagnostics do not gate local face search or audio. The offline test MOD has its own entry point, shares the completion modules/resource, and deliberately targets an unreachable helper address. Restore the research MOD after testing so only an observed research task starts the flow.

## Experiment lessons

- Moddable includes may retain the first module mapping for a name. Shared modules/resources now live in `manifest.components.json`, with distinct research/test entry points.
- Switching the source mapped to a cached module can retain old bytecode if the replacement source has an older timestamp. The test entry point logs `LOADED` to verify which code is running.
- Serial monitor opening may reset this board. Configure DTR/RTS before opening and allow enough time for network startup and the complete flow.
- The bundled sentence is fixed PCM playback. Arbitrary on-device TTS is not part of this experiment.

## Orientation follow-up

The Mac baseline checked four orientations, whereas the first native experiment used only upright input. The local search now cycles through 0°, 90°, 180° and 270° across unsuccessful frames within the same eight-second deadline. It keeps the successful angle to obtain the second stable detection. Pixel rotation uses one bounded 50,688-byte scratch buffer; the camera buffer remains owned and closed by its caller. Native input accepts the original dimensions and the swapped dimensions for quarter turns.

Normalized detections are transformed back into original camera coordinates before applying the existing yaw direction. Behavioral tests verify pixel placement, inverse rotations, source preservation and coordinate round trips. The first experiment remains available at `48305124`.


Orientation device run: all four angles completed without inference errors; audio PASS, hardware finished and card clearing were observed again. No live face was detected, so physical tracking remains unverified.

Positive control: the official Espressif Mona Lisa example was converted to a 176×144 RGB565LE test resource. On-device smoke returned a face at normalized (0.4517, 0.5347), confidence 0.93245, and PASS after blank/input/close checks. This establishes that the native model and RGB565 conversion can detect a face, but does not establish live-camera visibility or tracking accuracy. No user camera image was uploaded or saved. Companion tests now total 17.
