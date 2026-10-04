# Current status

See [acceptance](acceptance.md) and [architecture](design.md) for the current implementation. Entries below are chronological development history; earlier pending items may have been completed in later entries.

# Progress: Research companion

| Date | Stage | Milestone | Evidence |
| --- | --- | --- | --- |
| 2026-10-03 | Proposed | Research-status companion and face-directed completion discussed | User requested planning only |
| 2026-10-03 | Planned | Claude Code, Wi-Fi, spoken completion selected | User preferences |
| 2026-10-03 | Investigated | Research agent located in `jyos-system/.claude/agents` | Read agent configuration, full role, ResearchNote schema |
| 2026-10-03 | Design | External adapter preferred; saved note gates completion | Agent tool/write boundaries and human-review workflow |
| 2026-10-03 | Tracked | GitHub issue created; Issues enabled on fork | [Issue #1](https://github.com/yeejingye/jyos-stackchan/issues/1) |
| 2026-10-03 | Implemented | Mac HTTP service, manual CLI, shared protocol, research MOD | Branch `codex/research-status`; private config ignored |
| 2026-10-03 | Tested | Protocol, service, and CLI tests passed | `npm run test:research`: 8 tests; Biome checks passed |
| 2026-10-03 | Device | MOD built, installed, digest verified; robot reached Mac over Wi-Fi | Service logged authenticated robot poll; visual transition confirmation pending |
| 2026-10-03 | Observed | Gathering state rendered on the robot | User confirmed Finding sources display |
| 2026-10-03 | Pushed / review | Implementation pushed and draft PR opened | `b74fd3c7`; [PR #2](https://github.com/yeejingye/jyos-stackchan/pull/2), base `jyos-stackchan`; not merged |
| 2026-10-03 | Observed / UI | Comparing evidence confirmed; user requested larger, modern text | Replaced balloon with wide dark card, 24px heading, 16px detail, stage markers; formatted, compiled, installed, digest verified; visual review pending |
| 2026-10-03 | Live research | Claude research-agent researched StackChan-to-Mac Wi-Fi communication and saved a new working ResearchNote | Temporary external wrapper observed nine successful web-tool results and one Write; sent confirming → gathering → drafting → ready; no permanent Claude configuration changes |
| 2026-10-03 | Observed / live completion | Robot displayed Research ready after the real research run | User confirmed the final ready display |

## Verification and publication

2026-10-04 corrected-direction retest: user confirmed “It turned toward me.” Service reported stable face detections and movement commands, then speech-finished and cleared. Together with the earlier user confirmations of the 45° tilt and audible speech, this validates the physical direction on this unit. The detector still locates a face rather than recognizing the owner's identity; long-run robustness remains outside this short completion test.

2026-10-04 alignment feedback: user observed movement away from them with the widened range. Reversed horizontal correction for the actual CoreS3 camera/servo pairing while retaining the 45° pitch, ±30° yaw limit and 10° step cap. Correct direction remains pending physical retest. Current face detection runs through macOS Vision VNDetectFaceRectanglesRequest; it is distinct from M5Stack factory firmware.

2026-10-04 45° test: user confirmed the upward angle looked right, but did not observe successful alignment. Service diagnostics reported three face-found/motion-start pairs, followed by speech-finished and cleared. This establishes detector responses and motor requests, not physical alignment or identity. Widened completion yaw from ±0.15 radians (~9°) to ±30°, with steps capped at 10°, to address the limited horizontal reach. Direction and alignment still need user confirmation.

2026-10-04 follow-up: user confirmed the slight upward move but requested 45° before face detection. Changed the shared completion pitch to −π/4 (within the configured CoreS3 0–90° upward range), slowed initial/neutral movement to 1.5 seconds, and added a settle wait before camera start. Horizontal adjustments preserve the same pitch. Physical confirmation of the 45° pose and positive detection remains pending.

2026-10-04: repeat completion test reported speech-finished and cleared; user confirmed audible speech but no face-directed movement. Added a slight upward attention pose (pitch −0.15 radians, about 9°) before face search/speech, including no-face fallback, and retained that pitch during horizontal tracking. Corrected yaw lookup to the runtime's body.rotation shape. Neutral return after the announcement remains unchanged. Physical upward direction/amplitude confirmation is pending.

### Completion implementation and device verification

2026-10-03: implemented reusable FlowRunner, camera attention, fragment copying, local Apple Vision helper, local macOS speech preparation, authenticated face/WAV endpoints, stage diagnostics, and 15-second automatic clearing. Tests cover lifecycle/deduplication, ownership transfer, fallback, buffer fragment copying, PCM conversion and HTTP boundaries; 15 tests pass. Biome checks pass. MOD builds and USB installs were digest verified.

The first completion hardware test rebooted (user reported). Diagnostics then showed capture succeeded but upload failed. The native disposable camera buffer has no ArrayBuffer.slice method; upload now copies bounded fragments through Uint8Array and catches asynchronous callback errors. Camera startup was also corrected to follow the host's start/capture/stop lifecycle, keeping the touch panel paused during streaming. After these fixes, completion-check-3 reported multiple captured frames, speech-start, speech-finished, and cleared at the Mac service. No stable face was reported in that run. Audible speech, positive face-directed motion and user confirmation of the corrected physical sequence remain pending. Orientation support and the isolated fragment helper were subsequently compiled/installed; a final hardware-ownership guard prevents a new task taking camera/audio ownership before an existing completion finishes.

Implementation is ready for further hardware validation, not merged. Automatic research-agent triggering remains pending and is distinct from these completion modules. Images are processed in memory locally and not retained.

Second live test, 2026-10-03: repeated the Wi-Fi question with a fresh run ID and a distinct `Research - StackChan WiFi - 2026-10-03 - live-test-2.md` in Workbench/00 Inbox. Claude exited successfully, returned eight successful public web-tool results and one Write, and the companion service reached ready. This run additionally checked official source URL scope, working maturity, access metadata, wiki ingestion disabled, source/generation provenance and no human-verification field before emitting ready. Robot visual confirmation for this second run remains pending; face-directed completion, speech and automatic clearing remain unimplemented. A successful tool result is not proof of complete source reading or factual verification.

Increment A is implemented and has the evidence above. No Claude configuration changes, speech, motor gestures, or face tracking were made. Gathering and comparing displays were user-verified before the card redesign. A subsequent real Claude run emitted progress through a temporary wrapper, saved its note, and reached ready at the Mac service; the user confirmed Research ready on the robot. Service stop/restart remains pending. The Mac service is running in the current development session.

### Live test evidence and limits

- Question: “How can StackChan communicate with a Mac over Wi-Fi?”
- Saved artifact: `/Users/yeejingye/JYOS/Workbench/00 Inbox/Research - StackChan WiFi - 2026-10-03 - live-test.md`.
- Runner: `/tmp/stackchan-live-research.mjs`; transcript: `/tmp/stackchan-live-research-transcript.jsonl`. These are temporary local test files, not a reusable product adapter.
- Claude exited successfully, with no reported permission denials. The wrapper observed nine successful WebSearch/WebFetch tool results, one Write, and a saved note with ResearchNote identity frontmatter.
- Manual inspection confirmed working maturity, explicit AI access, normal sensitivity, wiki ingestion disabled, sources and generation provenance, and no human-verification field.
- The first attempt failed before research because variadic CLI options consumed the prompt; adding `--` before the prompt fixed it. The failure was reflected on the companion service before the successful retry.
- Tool-success counts do not prove source coverage or factual correctness. The draft included community sources despite an official-source-only instruction and relied on fetch summaries; treat its recommendation as preliminary. Its generation timestamp uses midnight rather than the actual run time.
- Ready means an output was saved for review. The user confirmed the robot's ready display; spoken completion and face tracking are not implemented.

Commands: `npm run test:research`, `npm exec -- biome check mods/research_companion tools/research-companion`, `npm run mod:build -- mods/research_companion/manifest.json`, and configured MOD installation through `npm run mod`. See [usage guide](../../../firmware/mods/research_companion/README.md).

## Next action

2026-10-03 requirement update: [modular flow lifecycle](flow-lifecycle.md) specifies research-only triggering, face-directed completion, bounded announcement and automatic return to idle. It separates trigger/flow definitions from shared display, attention, speech and cleanup modules. These new requirements are documented, not yet implemented; the real-test result above remains valid for the status foundation only.

Verify disconnect/reconnect on hardware. Then turn the temporary test into increment B's reusable research-specific event adapter, including stricter saved-note validation and tool failure handling. Improve the card transparency after this functional test. Increment C must verify speech playback before claiming spoken completion. Tracking issue remains open across these increments.


## 2026-10-04 — on-device completion experiment

Preserved and pushed the working Mac-assisted checkpoint `4c5f047e` before creating `codex/on-device-completion`. Added an opt-in CoreS3 ESP-DL native face detector and bundled completion audio. Host build/deploy passed; offline device run reported audio PASS, hardware cleanup and card clearing. Repeated local inference took 106–129 ms after the first call, but no real face was detected, so physical alignment remains pending. The normal research MOD was restored. Tests: 405 unit, 16 companion, 4 dependency checks. See [experiment details](on-device-experiment.md).


Follow-up: added bounded four-orientation camera search and coordinate mapping back to the calibrated yaw direction. All 17 companion tests passed. The rotated device run completed audio and clearing without a detected live face. An official reference image then passed on-device positive detection at 93.2% confidence, plus blank-frame and cleanup checks. Live face placement/alignment remains pending human confirmation.


Live rerun with user present, 2026-10-04: the local completion test loaded and connected. Ten camera inferences cycled through all four orientations, reporting no face (first call 260 ms; warm calls 105–128 ms). Audio returned PASS, hardware cleanup finished and the card cleared. The normal research MOD was restored. Physical tilt/turn/speech feedback is pending; the live-camera detection issue remains unresolved despite positive reference-image detection.


Camera diagnostics: both neutral and 45° snapshots rendered as full bitmaps on the robot; no camera images left the device. Neutral brightness mean/stddev 131/82, upward view 182/27, with valid 50,688-byte RGB565LE frames. All eight angle checks returned no face. Camera output is not entirely blank/dark. The user later reported being away during these snapshots, so their no-face result does not establish a detection failure with a person present. Normal research MOD restored; 18 companion tests passed.

Repeated camera diagnostics after asking the user to stay in front of StackChan: both full bitmap previews worked; all four orientations at both poses returned no face. Neutral/upward brightness mean/stddev was 132/82 and 170/72. The user confirmed their face appeared in the 45° view; all rotated inferences still failed. FINISHED was logged. Next: compare live-camera pixel format/color ordering with detector input and assess face scale/quality.

Pixel-format follow-up: 19 companion tests passed. SDK camera/detector declarations agree on RGB565LE. The temporary device comparison stalled after two no-face results; all other color/mirror checks remain unverified. USB restoration and revised upload both failed to connect. Physical restart requested; restoring the normal MOD is the next required action.

Recovery after physical restart: macOS listed `/dev/cu.usbmodem101`, `npm run scan` identified ESP32-S3, and the normal configured research MOD was successfully installed and verified (71,844 bytes; matching flash digest). The revised pixel comparison remains untested on hardware.

Revised pixel-comparison retry: the diagnostic archive (9,876 bytes) uploaded and verified, but the serial monitor reported USB_UART_CHIP_RESET with DOWNLOAD(USB/UART0), without LOADED or any inference results. Esptool hard reset did not start the app; its ROM run command connected but failed with “Serial data stream stopped.” An alternate DTR state produced no output. The normal research MOD was then restored and verified (71,844 bytes, matching digest). Runtime startup is not confirmed by flash verification. The revised comparison remains unvalidated; no production face-search change was made.

After restoration, the user reported a blank/frozen screen. Physical restart requested to recover application startup. Successful archive verification does not imply the application is running.

Successful revised pixel comparison after physical-button recovery: the next monitor opening reported SPI_FAST_FLASH_BOOT, followed by LOADED and network ready. All 32 combinations (four color/byte variants × mirrored/unmirrored × four rotations) completed on the same copied 45° frame without a face detection. Warm inference was 105–113 ms; first call 250 ms. Frame brightness mean/stddev 141/77, mean RGB 148/139/140. Full bitmap preview rendered and FINISHED confirmed cleanup. These tested transformations did not recover detection on this frame; they do not establish live accuracy or explain the earlier stall. The user reported their face filled most of the snapshot and was slightly tilted sideways. Whole-face edge coverage, image uprightness and natural colors were not explicitly confirmed. Next useful controlled check: upright head at greater distance to compare face size/pose. The normal research MOD was restored afterward with a matching flash digest.

Completion increment 1: replaced the temporary direct-run script with `npm run research:run`. Agent success, successful web/write activity, new contained output path, source provenance and review/access metadata gate readiness. Notification failure does not fail research. Public-source scope, fixed research-agent selection, cancellation and a 15-minute limit are included. Added an explicit YAML dependency. All 24 companion tests passed; real launcher run and interactive-session integration remain pending.

Completion increment 2: live upright-face test at requested 60 cm detected a normal-color face (confidence 0.531; mirrored 0.665). Actual completion then obtained two consistent detections at 0.867/0.798, audio PASS and clearing. Off-center completion detected 0.881/0.965, requested yaw 0.09375 and 0.17386 radians, and the face moved from x≈0.656 toward x≈0.523; audio PASS, hardware finished and clearing logged. Physical confirmation is pending. Added named research/timer flow registration, a display-only timer definition, flow-bound task identity, shared persisted completion gating and five-minute offline expiry. Cancellation now still returns to neutral and releases torque while retaining ownership. All 30 companion tests passed; timer/recovery hardware checks remain pending.

Completion increment 3: installed research-scoped hooks in JYOS local Claude settings (excluded from Git). Exact research-agent start/stop, tracked tool identities, explicit result marker and newly saved valid note gate completion; unrelated activity emits nothing. Direct launcher suppresses duplicate hooks. Hook metadata uses private ignored files and serialized updates. Added persisted companion snapshots/retired IDs; event publication waits for successful persistence, with rollback on storage failure. All 36 companion tests passed. Interactive live hook execution and hardware service-restart verification remain pending.

Completion increment 4: production MOD deployed/verified (76,876 bytes), new persistent service authenticated robot polls, and the permanent launcher completed real Claude research to a new Workbench ResearchNote: `Research - StackChan HTTP companion acceptance - 2026-10-04.md`. The initial attempt correctly failed with no saved note; Claude path write permissions require Edit(path), not Write(path), which was corrected. Retry passed note/source/review validation and emitted ready automatically. Device stages reported face-found, motion-start, speech-finished and cleared. No manual ready event was used. Note remains working/unverified and explicitly reports summary-only evidence and inference. Added neutral-settle delay before torque release and a translucent status surface. Current local checks: 405 firmware unit tests, 36 companion tests and Biome passed. A feature-branch read-only CI workflow was added; hardware/UI feedback and recovery checks remain pending.

## Final acceptance — 2026-10-04

Real delegated research-agent hooks were exercised. Missing specification permissions and invalid output metadata correctly emitted failed, without success announcements. With explicit public-note access metadata and the run timestamp supplied by the hook, a new validated note emitted ready; robot diagnostics reported face-found, motion-start, speech-finished and cleared. The dedicated launcher had already completed the same end-to-end path.

A timer demonstration used the shared registry without research hardware. Restarting the service during the active timer restored the exact task/service ID/revision; completing and retrying returned duplicate without repeating completion. A robot serial reset booted normally, reconnected and did not replay the old completed research snapshot. The user confirmed the full physical sequence, including direction, speech once, neutral return, card clearing and normal face after reboot without speech replay.

Architecture checks initially exposed the upstream assumption that every top-level MOD is a sample. Added an explicit fork-application catalog with manifest/README completeness and included application imports in production-boundary checks. All 79 architecture checks passed; standard manifest preflight passed for six targets. CI now includes architecture checks. Feature acceptance and current design pages replace stale increment descriptions; chronological experiment notes remain historical evidence.

## Digital-twin visual pass — 2026-10-04

Replaced the large multi-line card with a compact 272×46 translucent status strip, a short phase label, a pulsing activity marker and small lifecycle markers. Existing face expressions distinguish comparison, drafting, ready, input-needed and failure. The head stays still while research is running. Installed and verified the 76,936-byte MOD on CoreS3. User visual review remains the final aesthetic check before merge.
