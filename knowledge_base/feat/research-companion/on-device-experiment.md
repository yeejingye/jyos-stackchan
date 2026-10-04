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


## Live camera diagnostics

The temporary `__tests__/camera-diagnostics` MOD warms the camera, displays a full bitmap snapshot on the robot at neutral pitch and at 45° upward pitch, computes brightness statistics, and tests each snapshot in four orientations. No camera images are uploaded or saved.

Device measurements (176×144 RGB565LE, 50,688 bytes):

| Pose | Mean brightness (0–255) | Standard deviation | Dark pixels | Mean RGB | Preview |
| --- | --- | --- | --- | --- | --- |
| Neutral | 131 | 82 | 9% | 132, 130, 136 | Full bitmap |
| 45° | 182 | 27 | 0% | 189, 181, 176 | Full bitmap |

All eight inferences returned no face. These statistics rule out an entirely blank/dark frame; they do not establish which objects or faces are visible. The user subsequently reported being away during these snapshots, so this run does not test detection with a person present. The 45° frame contains less brightness variation; its contents cannot be inferred reliably from statistics alone. The normal research MOD was restored after diagnostics. Companion tests total 18, including blank/saturated/varied camera-statistics checks.

```sh
npm run mod -- mods/research_companion/__tests__/camera-diagnostics/manifest.json --port /dev/cu.usbmodem101
npm run mod -- mods/research_companion/manifest.local.json --port /dev/cu.usbmodem101
```

Repeat after requesting the user remain in front of the robot: neutral brightness mean/stddev 132/82, RGB means 135/131/127; 45° view 170/72, RGB means 178/169/161. Both previews rendered as full bitmaps; all eight orientation checks returned no face (105–107 ms warm inference). The user confirmed that the 45° view showed their face. Image uprightness and whole-face coverage were not explicitly confirmed. Framing alone no longer explains the result: the next diagnostic should compare live-camera pixel format/color ordering against the native detector input and inspect face scale/quality. The diagnostic completed with FINISHED.

## Pixel-format comparison follow-up

Local SDK inspection confirms the camera converts RGB565BE sensor bytes to RGB565LE when requested; the native detector declares RGB565LE. Added temporary diagnostic copies for byte swapping, red/blue channel swapping, horizontal mirroring and four rotations. Behavioral tests verify source preservation and reversible independent transforms; all 19 companion tests pass.

The first device run stopped reporting after normal-color unmirrored 0° and 90° checks (both no face; 248/105 ms). The remaining variants did not complete, and the cause of the stall is unknown. The robot then stopped responding to esptool; restoration and a revised diagnostic upload both failed with “No serial data received.” A physical restart was requested. The revised MOD reduces overlapping preview memory and removes short timer waits, but has only been built, not validated on hardware. Do not treat this comparison as completed or the normal MOD as restored until a verified recovery flash succeeds.

Recovery after physical restart: macOS listed `/dev/cu.usbmodem101`, `npm run scan` identified ESP32-S3, and the normal configured research MOD was successfully installed and verified (71,844 bytes; matching flash digest). The revised pixel comparison remains untested on hardware.

Revised pixel-comparison retry: the diagnostic archive (9,876 bytes) uploaded and verified, but the serial monitor reported USB_UART_CHIP_RESET with DOWNLOAD(USB/UART0), without LOADED or any inference results. Esptool hard reset did not start the app; its ROM run command connected but failed with “Serial data stream stopped.” An alternate DTR state produced no output. The normal research MOD was then restored and verified (71,844 bytes, matching digest). Runtime startup is not confirmed by flash verification. The revised comparison remains unvalidated; no production face-search change was made.

After restoration, the user reported a blank/frozen screen. Physical restart requested to recover application startup. Successful archive verification does not imply the application is running.

Successful revised pixel comparison after physical-button recovery: the next monitor opening reported SPI_FAST_FLASH_BOOT, followed by LOADED and network ready. All 32 combinations (four color/byte variants × mirrored/unmirrored × four rotations) completed on the same copied 45° frame without a face detection. Warm inference was 105–113 ms; first call 250 ms. Frame brightness mean/stddev 141/77, mean RGB 148/139/140. Full bitmap preview rendered and FINISHED confirmed cleanup. These tested transformations did not recover detection on this frame; they do not establish live accuracy or explain the earlier stall. The user reported their face filled most of the snapshot and was slightly tilted sideways. Whole-face edge coverage, image uprightness and natural colors were not explicitly confirmed. Next useful controlled check: upright head at greater distance to compare face size/pose. The normal research MOD was restored afterward with a matching flash digest.
