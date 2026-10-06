# Current StackChan status

Snapshot: **2026-10-06**. Robot name: **Joy**, a physical desk interface for JYOS. Hardware: the owner's complete M5StackChan CoreS3. Repository: `yeejingye/jyos-stackchan`; upstream: `stack-chan/stack-chan`.

## Stable repository and installed software

- `main` is the sole local and GitHub branch and the GitHub default.
- Firmware source checkpoint: `d1704bf1`, tagged `stable/joy-desk-companion-2026-10-06`.
- Repository cleanup: `a7401233`; all six GitHub Actions workflows removed. Builds, checks and deployment are manual. This is a personal checkpoint, not a new upstream `vX.Y.Z` release.
- Installed host: CoreS3 voice-enabled profile, `host/app/manifest_m5stackchan_cores3_joy_voice.json`, built and flashed using the repository wrappers.
- Installed application: combined `research_companion` MOD, incorporating research, Pomodoro and desk components. It is one MOD with composed features, not several independently installed MODs.
- Last observed USB port: `/dev/cu.usbmodem101`; ports and the Mac's LAN address can change.
- Private local configuration selects Berlin; saved device preferences take precedence. On 6 October, Berlin's effective offset is UTC+2.

## Features and confidence

| Capability | Implemented behavior | Evidence / remaining work |
| --- | --- | --- |
| Digital face | Reusable digital face with dimmed eyes and frames | Existing face checkpoint retained in current host |
| Modern sidebar | Rounded grouped controls; Desk companion, Pomodoro and Voice; secondary settings page | Native Piu rendering and interaction checks passed; physical visual review remains pending |
| Desk companion | After 15 quiet minutes, 35° upward gaze, four alternating turns, 2.5-second holds, neutral return and torque release | Nine controller checks pass; real full interval, geometry and torque state still need observation |
| Petting | Alternating top-panel strokes within 1.5 seconds trigger happy face, hearts and head shake; repeated petting extends the hold | Continuous direction changes fixed; touch hardware present and no blocker in live telemetry. Physical reaction confirmation still pending |
| Coexistence | Top-panel subscription stays active during sweep; recognized petting interrupts the hold and waits for motor cleanup | Automated sweep → petting → next idle interval verified. Foreground Pomodoro, voice and research suppress desk reactions |
| Pomodoro | One 20-minute focus / 5-minute rest cycle; manual start, pause, resume and cancel; countdown and chimes | Twenty control tests pass. Full-duration and physical coexistence acceptance remain open; reboot discards session |
| Hi Joy commands | Local wake phrase, spoken prompt and bounded Tomato / pause / resume / cancel commands | Code included in stable source; synthetic probes are not reliable owner speech acceptance. Voice recognition remains experimental |
| Research companion | Authenticated Mac status polling; phase face/card; local face search and fixed completion recording | Earlier controlled real-face, real research, speech, cleanup and replay checks passed. Latest combined deployment does not re-certify every geometry |
| Clock | Berlin daylight-saving adjustment and SNTP refresh on configured Wi-Fi connection | Latest fresh telemetry differed from Mac by about 0.112 seconds; a measurement, not a guaranteed precision specification |
| Diagnostics | Touch & clock status overlay; authenticated `/v1/device-status` and completion-stage reporting | Fresh telemetry: touch present, samples `[0,0,0]` at rest, no foreground blocker, idle motion |

## Last recorded verification

413 unit tests; 9 desk tests; 20 Pomodoro tests; 37 research/service tests; native Piu drawer checks and formatting checks passed. Host installation independently matched three flash images. Combined MOD digest matched, archive size 205,588 bytes. These are records of the completed runs, not claims that Actions are still running.

## Boundaries and next checks

Desk movement and manual Pomodoro do not need an active Mac service. Research status does: power, Wi-Fi, a reachable awake Mac and an authenticated LAN service. The service uses unencrypted HTTP on a trusted LAN. Completion audio is a fixed English WAV; general conversation, provider selection, JYOS Inbox capture and arbitrary English TTS are not integrated into the running companion. Local face detection locates faces without identifying people.

Next physical checks: continuous back-and-forth petting; sidebar appearance; full 15-minute idle interval; requested tilt/holds/neutral return; motor handover and torque release; full Pomodoro cycle; human command reliability and negative tests. Other hardware targets were not validated for these changes.

Sources: [checkpoint release note](../../release-notes/desk-companion.md), [desk evidence](../../../knowledge_base/feat/desk-companion/progress.md), [research acceptance](../../../knowledge_base/feat/research-companion/acceptance.md), [Pomodoro evidence](../../../knowledge_base/feat/pomodoro/progress.md).
