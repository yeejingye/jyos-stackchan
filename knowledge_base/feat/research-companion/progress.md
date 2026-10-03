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
