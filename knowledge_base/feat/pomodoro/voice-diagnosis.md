# Hi Joy / Pomodoro voice diagnosis

## Boundaries and evidence

| Boundary | Test | Current evidence |
| --- | --- | --- |
| Wake word | Human Hi Joy | Owner confirms prompt responds immediately; WakeNet is independent of MultiNet. |
| Command vocabulary | ESP-SR API registration + active list + direct audio probes | MultiNet6 uses uppercase graphemes; registration/update succeed. Direct probes show command-specific failure; expanded results below. |
| Capture format | SDK source + runtime getters | 16 kHz, mono, signed 16-bit; SDK mono reads select one stereo channel. Correct metadata does not establish intelligibility. |
| Capture continuity / processing | Submitted, decoded, dropped counts | Latest owner observation: 309/372 decoded/submitted, one queue drop. About 2.016 seconds remained undecoded; live real-time throughput is insufficient. |
| Native detection | Direct known clip + native detection/timeout counters | Official Tell me a joke clip passes. This does not prove Pomodoro. New counters distinguish no native candidate from an undelivered result. |
| Native-to-JavaScript delivery | Native positive results consumed by detect() | Captured live window has zero native detections and zero delivered results; a positive hardware bridge check remains pending. |
| Command policy / timer | Behavioral tests of actual dispatcher, CommandWindow, PomodoroTimer | IDs start focus, pause, resume and cancel; unknown, expired and duplicate results rejected. Does not certify hardware UI or microphone recognition. |

## Important limitations

- Raw microphone audio is currently passed directly to MultiNet. Espressif recommends AFE-processed input; no noise suppression, VAD or echo cancellation is integrated in this adapter.
- A 12-second diagnostic window is temporary. Product authorization remains five seconds. Native MultiNet timeout is five seconds of processed audio; diagnostics now reset it after timeout to permit another attempt in the remaining authorized interval.
- Queue drops alone miss producer starvation and decoder latency. Compare delivered sample rate and processed/submitted counts together.
- Native reference probes bypass the queue and do not execute commands. A passing probe establishes model capability for that clip, not accuracy for the owner's voice.
- No live speech audio is exported by this diagnostic build.

## Sources

- [Espressif MultiNet input, vocabulary and recognition-state documentation](https://docs.espressif.com/projects/esp-sr/en/latest/esp32s3/speech_command_recognition/README.html)
- Installed Moddable SDK: `modules/io/audioin/esp32/audioin.c`, `xs_audioin_read`.

## Verification

All 19 Pomodoro behavior tests pass. Diagnostic host builds successfully. Hardware probes and live native counters are recorded below; a positive live command remains pending. This feature remains experimental and unmerged.

## Controlled hardware results

The active model prints all four intended commands, plus temporary diagnostic aliases. All aliases are removed before microphone listening.

| Probe | Search threshold | Native outcome |
| --- | --- | --- |
| Official Tell me a joke | 0.65 | ID 5 accepted, score 0.893 |
| Generated Tell me a joke | 0.65 | ID 5 accepted, score 0.921 |
| Generated Pomodoro | 0.65 | Timeout; decoded text `HOMMAORORO`, no command candidate |
| Generated Pause | 0.65 | Timeout; decoded text `PAUSE`, no command candidate |
| Generated Start a Pomodoro timer | 0.65 | Timeout; decoded text `START A HOMEMAORO TIMEER` |
| Generated Pause the timer | 0.65 | Timeout; decoded text `PAUSE THE TIMEER` |
| Generated Pomodoro | 0.20 | ID 1 detected, reported score 0.605; this demonstrates capability for that clip under this test configuration |
| Generated Pause | 0.20 | Incorrect ID 3 (Resume), score 0.484 |
| Target words and longer phrases | 0.55 | Still no candidate; both controls still pass |

The reported result score is not a sufficient predictor of recognition at another search threshold. The 0.55 trial did not reproduce the 0.20 Pomodoro success despite a reported score of 0.605. Therefore neither a blanket threshold reduction nor dispatching timeout text is an accepted fix. Live search returns to 0.65; a shared native acceptance policy also rejects malformed IDs/scores and insufficient-confidence results. Nineteen Pomodoro tests pass, including compilation/execution of that same portable C policy (requires a `cc` compiler).

## Conclusions for the four requested checks

1. **Can the model detect Pomodoro?** Yes, the direct generated clip produces ID 1 in one low-threshold configuration. No reliable detection is established at the current live policy or for the owner's voice. Registration is verified; command-specific decoding/acceptance is the leading blocker.
2. **Is input processing an issue?** Yes, decoder throughput is independently insufficient. Capture metadata and measured delivery are approximately correct; no custom SDK gain/bias conversion is enabled. No audio-intelligibility recording or AFE validation has been performed. Missing AFE remains a separate input-quality risk, but cannot alone explain failures on direct clean probes.
3. **Does detection work?** WakeNet works live and MultiNet accepts two control clips. The captured live window produces no native command candidate and times out; failure is before delivery to JavaScript. Native timeout now resets MultiNet for another attempt within the still-authorized diagnostic window.
4. **Does post-detection work?** The actual ID dispatcher, wake-window policy and timer state machine pass behavior tests. Native-to-XS delivery has instrumentation, but this live window contains no positive candidate to validate that bridge on hardware. No evidence presently implicates the UI/dispatch path; full hardware end-to-end acceptance remains open.

## Next work, in order

- Compare a phoneme-based English command model with explicit pronunciation for Pomodoro, using these same direct clips and negative/confusion probes before any human retry. MultiNet7 supports phoneme-based English customization; changing models is a new experiment, not a proven cure.
- Measure/repair sustained real-time inference and integrate the recommended AFE path with verified memory budget. Keep these measurements separate from vocabulary accuracy.
- Once a model passes direct probes, compare on-device buffered microphone audio with live inference to distinguish acoustic/capture quality from scheduling. Keep audio local unless export is explicitly agreed.
- Validate native result delivery, timer UI, pause/resume/cancel and false activation on hardware before restoring the five-second product window and completing acceptance.

## MultiNet7 comparison (2026-10-05)

The optional voice profile now packages `mn7_en` at the same pinned ESP-SR source commit and enables `CONFIG_SR_MN_EN_MULTINET7_QUANT`. The native build rejects a mismatched API selection. Explicit phonemes come from the pinned Espressif tool with g2p_en 2.1.0; resume uses verb-context pronunciation. Model loading stays at the default. The packed resource is 3,052,125 bytes. Before queue/task allocation, one startup reports 4,408,464 free PSRAM bytes and 78,315 internal bytes.

At the unchanged 0.65 search/acceptance threshold:

| Probe | Outcome | Wall/audio duration |
| --- | --- | --- |
| Official control | ID 5, accepted, score 0.781 | 2114/2400 ms |
| Generated Pomodoro | No candidate | 5286/5376 ms |
| Generated Pause | ID 2, accepted, score 0.692 | 1288/1504 ms |
| Generated Start a Pomodoro timer | No candidate | 5119/5376 ms |
| Generated Pause the timer | ID 2, accepted, score 0.658 | 1239/1472 ms |
| Same-voice control | ID 5, accepted, score 0.737 | 1787/1856 ms |
| Please resume (verb-context clip) | No candidate | 5151/5376 ms |
| Generated Cancel | ID 4, accepted, score 0.831 | 1366/1536 ms |
| Start a potato timer (negative) | No accepted command | 5654/5376 ms |

Generated-only Pomodoro search thresholds 0.50, 0.35 and 0.20 also produce no candidate. Live policy is restored to 0.65 before opening the microphone. Rounded-vowel alternatives did not improve the earlier Pomodoro comparison and have been removed. Thus MultiNet7 improves these Pause/Cancel probes and control-clip speed, but does not solve Pomodoro or resume.

A spontaneous live window in the earlier MN7 variant build ends at 363/373 processed/submitted frames with zero queue losses (about 0.32 seconds of unprocessed audio), versus the earlier MN6 backlog. Speech content is not logged, and this is one window, not sustained real-time or word-accuracy acceptance. A requested manual-start + spoken Cancel check will test positive native-to-XS delivery and actual timer UI together. All 407 unit tests and 19 Pomodoro tests pass; optional host/MOD builds and flash digests pass.

Current blockers: Pomodoro/Resume recognition, positive human-command delivery and UI evidence, AFE/capture-intelligibility validation, sustained throughput, full-duration timer/research coexistence and negative activation acceptance. The feature remains experimental and unmerged.

## 2026-10-05 — Cancel confirmed; Start Tomato Timer trial

Owner confirms spoken Cancel works. The captured live result is native ID 4 at probability 0.733, accepted at threshold 0.65, followed by JavaScript candidate=cancel accepted=true. This verifies positive recognition and native-to-JavaScript command delivery for that attempt.

At the owner’s request, replace the spoken start word with Start Tomato Timer, preserving internal command ID 1 / pomodoro. Pronunciation generated with the pinned Espressif tool is STnRT TcMdTb TiMk. A Samantha 145 words/minute, 16 kHz mono PCM probe is added; the retired Pomodoro probes and threshold sweep no longer run at startup. All 19 timer/control tests pass. Hardware recognition of the new phrase remains pending. Resume reliability and broader voice acceptance remain unfinished.

## 2026-10-05 — Verified Start Tomato Timer experiment

The voice-host retry at explicit 115200 baud completes, and independent verification matches all three images, including the 12,077,888-byte application. The diagnostic MOD also passes its digest check. Startup confirms WakeNet9 Hi Joy and MultiNet7 English running; the prior interrupted host write is resolved for this installation.

Direct synthetic probes: official control ID 5 / 0.781 passes; Start Tomato Timer produces no candidate (5177 ms processing / 5376 ms fed audio); Pause ID 2 / 0.692 passes; Pause the timer ID 2 / 0.658 passes; same-voice control ID 5 / 0.737 passes; Please resume produces no candidate; Cancel ID 4 / 0.831 passes; Start a potato timer gives no accepted command. Search and acceptance remain at 0.65. These are generated clips, not owner voice accuracy results.

A live wake window delivers roughly 16 kHz input and closes at 368/373 processed/submitted frames with zero drops, two native timeouts and zero command detections. The spoken content is not logged; the owner confirms saying Start Tomato Timer and seeing No command detected. There is no detected result for post-detection dispatch to reject. Start and resume recognition remain unresolved.

## 2026-10-05 — Tomato pronunciation comparison

Owner confirms the verified live Start Tomato Timer attempt ends with No command detected. Added a Daniel British-English synthetic clip and compared US/British audio against both US `STnRT TcMdTb TiMk` and alternate `STnRT TcMnTb TiMk` grammar. All four combinations produce zero candidates. Controls continue to pass: Pause 0.692, Pause the timer 0.658, Cancel 0.831, official/same-voice reference 0.781/0.737. The potato negative gives no accepted command under either grammar. The alternate grammar is removed; original US grammar and threshold 0.65 are restored before live listening. This comparison does not support the tomato-vowel mismatch hypothesis for these probes.

Host deployment independently verifies all three images, including the updated 12,151,808-byte application, and MOD verification passes. Startup and return to listening are observed without a captured panic. Recognition remains incomplete. Owner is asked to choose between preserving the exact phrase with a Mac-side offline recognizer or trying a simpler on-device phrase; neither alternative is implemented yet.
