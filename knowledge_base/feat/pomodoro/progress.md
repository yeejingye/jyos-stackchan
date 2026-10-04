# Progress

| Date | Milestone | Evidence |
| --- | --- | --- |
| 2026-10-04 | Scope changed to Pomodoro | Owner specified Hi Joy/Pomodoro, 20-minute focus, 5-minute rest, pause/cancel and unobtrusive countdown |
| 2026-10-04 | Draft MiniSRS created | Existing specification branch retained; no implementation |
| 2026-10-04 | Cycle and resume decisions confirmed | Owner chose finish after one cycle and accepted Hi Joy resume with visible paused countdown |
| 2026-10-04 | Research speech deferral agreed | Owner requested deferring speech until Pomodoro ends; cancellation and queue policy remain open |
| 2026-10-04 | Cancellation releases deferred speech | Owner confirmed waiting research speech should be announced after early cancellation returns Joy to normal mode |
| 2026-10-04 | Phase cues and repeated start agreed | Owner accepted gentle focus/rest completion chimes and preserving the current session for repeated Pomodoro commands |
| 2026-10-04 | Reboot policy confirmed | Owner chose normal mode without session restoration |
| 2026-10-04 | Implementation authorised | Owner: proceed as plan; specification defaults finalised before code |

## 2026-10-04 — Timer implementation checkpoint

Implemented a pure elapsed-time timer (20-minute focus, 5-minute rest, one cycle), pause/resume/cancel, wake-window command policy, translucent countdown strip and drawer controls. Research display yields during Pomodoro; eligible completions are admitted and deduplicated immediately, with the latest retained in memory until the session ends. This corrects the earlier five-minute queue expiry, which would otherwise discard announcements during a full session. Reboot discards both timer and pending announcement.

Validation: eight Node behavior tests pass; research companion MOD builds with the repository wrapper; Biome passes on changed firmware files. Native recognition and live device acceptance remain pending. No device upload at this checkpoint.

## 2026-10-04 — Local voice integration and first upload

Added opt-in Joy voice host with ESP-SR 2.5.5, Hi Joy WakeNet and four-command English MultiNet. Models are pinned and checksum-verified, then embedded in host resources (4,079,263 bytes (including required FST)); no model partition or cloud service is needed. The initial host binary was 11,993,872 bytes; subsequent fixes change its size. Prior firmware artifacts were preserved under `/tmp/stackchan-before-joy-voice` before the host variant switch.

The adapter accumulates bounded PCM frames, requires a five-second wake window, ignores input during mute/own cues/completion, and releases speech models before local face detection. Manual drawer controls remain available on initialization failure. The initial compiler include error (cJSON) and terminal PATH error (esptool) were resolved. An existing macOS test-fixture alias issue was fixed by resolving its temporary directory to a canonical path.

Validation: 8 Pomodoro tests, 36 research regressions, 405 unit tests, 79 architecture checks and six-target manifest preflight pass. Voice host and configured companion MOD uploaded to `/dev/cu.usbmodem101`; both flash digests verified. Live startup and speech acceptance are being checked with the owner; none of the recognition accuracy targets is claimed complete.

## 2026-10-04 — Live fault and recovery

The first voice startup crashed after loading WakeNet. Espressif's reference model packaging also includes `fst` for MultiNet 6/7; the missing graph was added to the locked bundle and checked before native model construction. After that correction, both engines loaded and the listener reported 512 samples/frame.

The owner then reported repeated restarts during listening. No usable runtime backtrace was captured, so the precise runtime cause is not established. A recovery MOD setting `joyVoice.enabled: false` was uploaded and verified; the owner confirmed **normal face, stable**. The speech experiment is not accepted as complete.

Inference was moved into a dedicated native worker with a two-frame queue and copied PCM. The XS/UI callback never waits for recognition; queue saturation drops input rather than accumulating work. Generation guards discard events from old wake windows or suspension. The worker owns model resets, and close waits for worker shutdown before freeing its models. This revised host builds successfully; controlled startup/listening validation is pending. Packed-resource validation tests were added; all 407 unit tests pass.

### Runtime diagnosis update

The worker test produced a usable backtrace: `dl_convq_queue_bzero` → WakeNet `model_clean` → `joy_voice_worker`. The null-address fault is in the Hi Joy WakeNet reset path, including a reset before first inference. The revised binding avoids WakeNet `clean()` entirely: a used wake engine is destroyed/recreated for a fresh wake session, and MultiNet is not cleaned before it has processed audio. Recognition remains disabled on the robot during this rebuild. The worker isolation also remains, so inference does not block face/timer callbacks.

### Owner feedback: spoken wake acknowledgement

After the WakeNet reset fix, the owner confirmed stable operation and a wake chime, but no response to Pomodoro. The sharp tone was replaced with a lower, smoothly enveloped PCM cue; the owner found it too quiet and requested a spoken prompt instead: **“Hi JY. What can I help you?”**

A fixed, local 2.028-second English WAV now supplies wake acknowledgement; no cloud TTS or LLM is used. The command window opens only after the prompt finishes, with generation guards preventing late authorization if mute/completion interrupts it. Phase-end chimes remain soft PCM cues. Microphone capture is reopened after playback to restore its capture configuration. Thirteen Pomodoro behavior tests pass, including cue shape and asynchronous greeting authorization.

English command recognition remains under investigation. The next diagnostic build reports only aggregate input level/frame timings, with a trial 0.65 MultiNet threshold behind wake authorization. Human recognition accuracy and negative-command acceptance are not yet established.

### Command throughput diagnostic

The owner confirmed the full spoken greeting, but Pomodoro still did not start. Native counters measured up to 179 ms inference for a 32 ms input frame; one command window processed 46 frames and dropped 85. The input-level diagnostic was incorrectly placed in the ignored-input branch, so its zero readings do not establish silent capture. It now measures completed active frames. A new experimental build selects MultiNet’s full-PSRAM loader mode and logs available PSRAM before/after loading. Build and live throughput validation remain pending.

The full-PSRAM experiment faulted at startup with `InstrFetchProhibited`, PC/EXCVADDR zero, consistent with an unavailable function pointer. The manual recovery MOD was restored and flash verified. The loader callback is now checked before calling it; unsupported models retain their default loading mode. Spoken-command acceptance remains open.

### On-face command diagnostics

At the owner’s request, the diagnostic MOD now overlays a compact translucent two-line status above the countdown. It shows wake detection, greeting, command listening, detected command/acceptance, or listening timeout. During listening it shows raw PCM peak and cumulative dropped frames; these are diagnostics, not confidence scores. MultiNet supplies command IDs rather than general transcripts, so unrecognized speech is labeled “No command detected.” The overlay expires after six seconds and is enabled only by `joyVoice.diagnostics`. All 13 Pomodoro unit tests and changed-file Biome checks pass; hardware visual validation is pending.

### Follow-up: audio present, no command

The owner saw the listening overlay followed by “No command detected,” with raw peak around 4229 and cumulative dropped frames around 317. Nonzero samples are present; intelligibility has not been verified. The serial capture did not include a command-window attempt, so no new per-window throughput result is claimed. The overlay now reports frame-loss deltas for the current window. A scheduling experiment gives the bounded inference worker priority 5 rather than the UI’s priority 4 and allows either CPU core, instead of pinning inference to core 1. This tests contention as a hypothesis; command acceptance remains pending.

### Isolate the model with reference audio

The owner confirmed that “pause” also ends with no detected command, despite nonzero input and zero queue drops. Diagnostic startup now runs Espressif’s 16 kHz mono “Tell me a joke” reference clip directly through MultiNet, on the native worker, before opening the microphone. Its temporary command ID 5 is removed after the test and is never dispatched to timer controls. The reference resource remains rooted until worker shutdown. The overlay and aggregate log report pass/fail. This distinguishes native model/vocabulary integration from the live capture path; it does not certify microphone recognition. All 13 Pomodoro tests and the voice host build pass; live reference outcome is pending.

Reference outcome: **passed**, detected ID 5 as expected in 3612 ms. The live path remains unaccepted. Inspection found that priority-5 inference can preempt the priority-4 XS producer on every queue submission, delaying microphone draining even when the native queue reports no drops. The next experiment uses a 64-frame bounded queue in PSRAM (about 66 KB, at most 2.048 seconds of 16 kHz audio) and a one-tick yield after each inference. Generation checks still discard stale frames/results, and expired wake windows reject late commands. This corrects producer contention; live continuity and latency must still be measured.

## 2026-10-05 — Diagnostic command gain

Buffered/yielding capture still produced no live Pomodoro candidate. The reference passed again (3603 ms), while the owner reported low live peaks and zero queue drops. A diagnostic-only 4× command gain experiment now scales signed PCM with saturation protection; wake audio and non-diagnostic operation are unchanged. The overlay shows raw/processed peak and per-window loss. Three signal-behavior tests verify silence/polarity, unity and saturation, and rejection without mutation; all 16 Pomodoro tests pass. Input gain remains an experiment, not a claimed recognition fix.

The owner reports no recognition with the gain experiment either. Gain is removed from the live path. The next diagnostic measures actual delivered sample rate and decoded/submitted frame counts, plus runtime format, to distinguish capture discontinuities from decoder backlog. It is instrumentation, not a claimed recognition fix.
