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

### Half-rate delivered audio

The owner observed 8592 delivered samples/second and 17/17 decoded/submitted frames. This points to a problem before or at frame delivery rather than decoder backlog in that interval, but a single reading does not establish the hardware clock rate. Compiled configuration is 16 kHz stereo; the SDK mono path selects one channel. The next scheduling experiment lowers inference from priority 5 to 3, below the priority-4 XS producer, while retaining bounded buffering and yielding. Full-window delivered rate and recognition remain to be measured.

The owner measured 16039 samples/second with 10/13 frames decoded after capture-first scheduling; the window still ended without a command. Delivered rate is now approximately correct in that reading. A diagnostic-only 12-second window tests whether recognition is delayed beyond five seconds, and timeout shows final decoded/submitted/lost totals. Normal non-diagnostic authorization remains five seconds. This experiment is not acceptance of increased product latency.

The extended window ended with 134/350 decoded/submitted frames and 156 losses. A longer window therefore does not solve throughput. Live word trials are paused while a voice-only cache profile is evaluated: 32 KB instruction cache, 64 KB data cache, 64-byte data lines, following Espressif speech example configurations. PSRAM type and clock remain unchanged. A clean build is required so previous generated choices cannot persist. Configuration tests verify extra defaults are present only when requested, base files remain unchanged, and a subsequent normal build returns to its baseline. Runtime speed and available-memory impact remain to be measured.

Reference configuration: https://github.com/espressif/esp-sr/blob/76581015af7075681814627a5bb03d2f3f328f8a/test_apps/esp-sr-multinet/sdkconfig.ci.mn5q8_en

Cache-profile validation: clean voice host build succeeded; generated IDF configuration reports instruction cache 0x8000, data cache 0x10000 and data line size 64. All 407 unit tests and 16 Pomodoro tests pass, as do changed-file Biome checks. Firmware installation and runtime reference-speed measurement are in progress.

Cache-only runtime outcome: startup and reference recognition passed; reference wall time improved from approximately 5437 to 4189 ms, but this does not prove real-time processing. The next profile selects 80 MHz PSRAM as in Espressif speech examples, preserving its existing memory type. The reference log now includes processed-audio duration so wall time can be compared directly with input duration. SDK defaults are merged by key, and configuration tests verify replacements are unique and normal builds revert to their baseline. Memory-clock stability and speed remain pending.

80 MHz profile build succeeds; generated IDF settings confirm PSRAM speed 80 and the larger cache. All 407 unit tests pass after the key-based defaults merge. Runtime reference real-time ratio and hardware stability remain pending.

80 MHz runtime outcome: the diagnostic reference recognized ID 5 correctly in 2280 ms for 2208 ms of processed audio (wall/audio ratio about 1.03). This is near real time for this reference, but still slightly slower, and does not establish sustained live throughput or microphone command accuracy. Startup reached local listening without a fault in the captured log. A live Pomodoro attempt is pending; the experimental profile remains unaccepted for release.

Live follow-up: the owner reports 313/374 decoded/submitted frames with zero queue drops. Sixty-one frames (about 1.95 seconds of audio) remained undecoded at the observation; retaining audio in the bounded queue does not establish real-time recognition. No successful command was reported. The next isolated experiment pins recognition to the opposite core from the XS constructor's current core, retains priority 3, and logs both locations. Since the SDK creates XS without explicit affinity, this is a placement experiment rather than a guarantee of permanent CPU separation. Build and live outcome are pending.

CPU-placement experiment: host build and host/MOD digest verification passed. Logs confirm constructor on core 0 and worker on core 1. The reference still recognizes ID 5, taking 2352 ms for 2208 ms of audio (ratio about 1.07); this does not improve the standalone benchmark. No startup fault appeared in the captured log. A live comparison is pending to evaluate contention during microphone/UI activity; recognition acceptance remains open.

## 2026-10-05 — Four-boundary diagnosis

Owner reports 309/372 frames, one loss, no Pomodoro command. New diagnostics separate native detections, native timeouts and results delivered to XS. All 18 Pomodoro tests pass, including the production ID dispatcher through CommandWindow into PomodoroTimer, checking start/pause/resume/cancel and rejection of stale/unknown/duplicate IDs.

Direct model probes bypass microphone and queue: the official reference recognizes ID 5 in 2370 ms for 2208 ms audio; generated Samantha Pomodoro returns no detection (3640 ms / 3552 ms), as does Pause (3349 ms / 3200 ms). This shows throughput alone cannot explain failure, but does not establish universal inability to recognize those words. Longer-phrase and same-voice reference controls are being added to distinguish command length/vocabulary from synthesized-input compatibility.

A live window captured by the new instrumentation shows approximately 16 kHz delivered input, 333/374 frames processed with zero queue losses, one native timeout, zero native detections and zero delivered command results. Thus there was no detected command for the JavaScript policy to reject in this captured window. Native MultiNet is now cleaned after timeout, allowing another attempt in the remaining diagnostic authorization interval.

See [voice diagnosis](voice-diagnosis.md) for evidence at each boundary and limitations. Native probes never dispatch to the timer, and the extra diagnostic phrases are removed before live listening.

Expanded controls: model active list confirms all intended words. Same-voice Tell me a joke passes (score 0.921), but longer timer phrases also fail. Timeout text includes HOMMAORORO for Pomodoro, PAUSE for Pause, START A HOMEMAORO TIMEER and PAUSE THE TIMEER. Generated-only search threshold 0.20 detects Pomodoro as ID 1 (score 0.605), but incorrectly detects Pause as Resume/ID 3 (score 0.484). A narrowed 0.55 trial still fails the target words. Reported score alone therefore does not predict decoder acceptance at another threshold. Low-threshold changes are not retained as a fix; live search is restored to 0.65 with an explicit checked native acceptance policy.

All 19 Pomodoro behavior tests pass, including running the production portable C confidence gate. Diagnostic builds succeed. The diagnosis identifies command-specific model/acceptance failure and independent live backlog; no positive native result was produced in the captured live window, so post-detection hardware acceptance remains open. Restored-threshold firmware installation is in progress. No claim of a working voice feature or merge readiness is made.

Restored-threshold host and diagnostic MOD installation both completed with matching flash digests. All 19 Pomodoro tests pass. The feature remains experimental: human command accuracy, positive native-to-XS hardware delivery, full timer UI acceptance and negative voice tests are unfinished.

## 2026-10-05 — MultiNet7 comparison

A clean optional voice build now selects MultiNet7 English in both SDK configuration and the checksummed resource catalog. Verified packed resource is 3,052,125 bytes (previous MN6 resource 4,079,263 bytes). All 407 unit tests pass; the first clean host build succeeds. Explicit pronunciations are generated with Espressif's pinned multinet_g2p.py and g2p_en 2.1.0. Isolated resume is classified as a noun, so the command uses the verb-context result from please resume / resume the timer. The native compilation checks that MultiNet7's command API configuration is enabled; regular host builds remain outside this optional profile. Live/model clip acceptance remains pending.

Rollback host binary and MOD archive are preserved under /tmp/stackchan-before-mn7. Temporary pronunciation-tool dependencies and NLTK resources are under /tmp/joy-g2p. Slow Python resource-index downloads were replaced with bounded official NLTK resource downloads; redundant download processes were stopped. No private user audio was used for these probes.

MultiNet7 with explicit phonemes: host/MOD uploads verified. Startup reports 4,408,464 free PSRAM bytes and 78,423 internal bytes before queue/task allocations. Official control passes in 2077 ms for 2400 ms audio; same-voice control passes in 1666/1856 ms. Pause now passes as ID 2 (score 0.692, 1400/1504 ms); its longer phrase also returns ID 2 (score 0.658, 1266/1472 ms). Pomodoro and its longer phrase still time out with no candidate. Single-clip real-time ratios improve but do not establish live throughput. The next comparison adds rounded-vowel pronunciation variants for the same Pomodoro command, keeping threshold 0.65 and default loading. Resume/cancel and a near-sounding negative fixture are prepared for confusion checks.

Rounded-vowel alternatives do not improve either Pomodoro probe and are removed. A spontaneous live window captured during this experiment delivers roughly 16 kHz and ends at 363/373 processed/submitted frames, zero queue drops, with no native command candidate. The spoken content was not logged, so no specific human-word accuracy claim is made. Final backlog is about 0.32 seconds in that window; this improves on the earlier MN6 observations but is not sustained-throughput acceptance. The next suite adds resume (verb-context audio), cancel, a near-sounding negative phrase, and generated-only Pomodoro search-threshold calibration. Live search/acceptance stays at 0.65.

Consolidated MN7 suite: Pause accepts ID 2 at 0.692, Cancel ID 4 at 0.831; both controls pass. Generated Pomodoro and verb-context resume still fail, and Pomodoro remains undetected at generated-only search settings 0.50/0.35/0.20. Start a potato timer gives no accepted command at live policy. No low search threshold or unsuccessful rounded-vowel variants remain in live operation. Host/MOD installation passes digest checks. All 407 unit tests and 19 Pomodoro tests pass. A manual-start + spoken Cancel observation is requested to verify microphone recognition, native delivery, dispatcher and visible cancellation independently of the unresolved start word.

## 2026-10-05 — Cancel confirmed; Start Tomato Timer trial

Owner confirms spoken Cancel works. The captured live result is native ID 4 at probability 0.733, accepted at threshold 0.65, followed by JavaScript candidate=cancel accepted=true. This verifies positive recognition and native-to-JavaScript command delivery for that attempt.

At the owner’s request, replace the spoken start word with Start Tomato Timer, preserving internal command ID 1 / pomodoro. Pronunciation generated with the pinned Espressif tool is STnRT TcMdTb TiMk. A Samantha 145 words/minute, 16 kHz mono PCM probe is added; the retired Pomodoro probes and threshold sweep no longer run at startup. All 19 timer/control tests pass. Hardware recognition of the new phrase remains pending. Resume reliability and broader voice acceptance remain unfinished.

## 2026-10-05 — Blank-screen recovery

Owner reports blank display after the Start Tomato Timer upload. USB bootloader connection succeeds, but filtered application monitoring gives no startup messages; a no-reset connection does not synchronize, so download mode is not established as the cause. Hardware-button power cycling, USB reset and watchdog reset do not visibly recover the screen. Voice-disabled MOD alone also does not recover it.

Independent flash verification matches the bootloader and partition table but fails for the current voice-host application build. This establishes a mismatch with the artifact; the underlying cause (including whether the local artifact changed after deployment) is unresolved. A clean non-voice host using manifest_m5stackchan_cores3_local_completion.json is built and deployed, followed by the voice-disabled recovery MOD. Application write hash and MOD digest checks pass. Independent application readback now passes (8,361,952 bytes at 0x10000). Owner confirms the normal face has returned after the non-voice host and recovery MOD installation. No erase-flash command is used. Voice trials remain suspended until recovery is confirmed.

## 2026-10-05 — Interrupted host upload identified

Review of the saved Start Tomato Timer host upload log identifies a serial disconnect at about 61.5% of the compressed application write, followed by esptool/CMake/make errors. The earlier report that the host upload was verified was incorrect: the subsequent MOD digest did not verify the host. This directly explains the application mismatch and blank-screen recovery; it does not prove a voice-model startup crash.

Deployment now independently verifies all images listed by IDF flasher_args.json, and a mismatch fails the npm command even if mcconfig reports success. Explicit upload baud is forwarded as UPLOAD_SPEED to Moddable's makefile. All 409 unit tests pass, including failed verification after a successful mock mcconfig deployment. Verified recovery host/MOD are preserved under /tmp/stackchan-verified-recovery. A fresh voice build is being prepared for a 115200-baud upload; Joy remains recovered during preparation.

## 2026-10-05 — Verified Start Tomato Timer experiment

The voice-host retry at explicit 115200 baud completes, and independent verification matches all three images, including the 12,077,888-byte application. The diagnostic MOD also passes its digest check. Startup confirms WakeNet9 Hi Joy and MultiNet7 English running; the prior interrupted host write is resolved for this installation.

Direct synthetic probes: official control ID 5 / 0.781 passes; Start Tomato Timer produces no candidate (5177 ms processing / 5376 ms fed audio); Pause ID 2 / 0.692 passes; Pause the timer ID 2 / 0.658 passes; same-voice control ID 5 / 0.737 passes; Please resume produces no candidate; Cancel ID 4 / 0.831 passes; Start a potato timer gives no accepted command. Search and acceptance remain at 0.65. These are generated clips, not owner voice accuracy results.

A live wake window delivers roughly 16 kHz input and closes at 368/373 processed/submitted frames with zero drops, two native timeouts and zero command detections. The spoken content is not logged; the owner confirms saying Start Tomato Timer and seeing No command detected. There is no detected result for post-detection dispatch to reject. Start and resume recognition remain unresolved.

## 2026-10-05 — Tomato pronunciation comparison

Owner confirms the verified live Start Tomato Timer attempt ends with No command detected. Added a Daniel British-English synthetic clip and compared US/British audio against both US `STnRT TcMdTb TiMk` and alternate `STnRT TcMnTb TiMk` grammar. All four combinations produce zero candidates. Controls continue to pass: Pause 0.692, Pause the timer 0.658, Cancel 0.831, official/same-voice reference 0.781/0.737. The potato negative gives no accepted command under either grammar. The alternate grammar is removed; original US grammar and threshold 0.65 are restored before live listening. This comparison does not support the tomato-vowel mismatch hypothesis for these probes.

Host deployment independently verifies all three images, including the updated 12,151,808-byte application, and MOD verification passes. Startup and return to listening are observed without a captured panic. Recognition remains incomplete. Owner is asked to choose between preserving the exact phrase with a Mac-side offline recognizer or trying a simpler on-device phrase; neither alternative is implemented yet.

## 2026-10-05 — Owner requests isolated Tomato

Replace the active spoken start phrase with Hi Joy, greeting, then Tomato. Internal ID 1 continues to dispatch pomodoro with the existing 20-minute focus / 5-minute rest lifecycle. The overlay says Heard: Tomato. Espressif's pinned pronunciation tool returns TcMdTb. New Samantha/Daniel single-word positive probes and Samantha Potato negative probe replace the longer-phrase diagnostic assets; the alternate tomato-vowel comparison remains diagnostic-only. All 19 timer/control tests pass and the optional voice host builds successfully. Verified deployment and recognition results are pending.

## 2026-10-05 — Isolated Tomato model result

Full host verification matches all three images (application 12,069,888 bytes), and MOD verification passes. Startup confirms the expected models and returns to local listening. Samantha Tomato is accepted as native command ID 1 at probability 0.741 (1635 ms processing / 1760 ms fed audio), with search/acceptance unchanged at 0.65. Samantha Potato produces no candidate. Pause, Pause the timer, Cancel and reference controls pass. Daniel Tomato fails under both US and alternate British grammar; Samantha Tomato also fails under the alternate British grammar. The US grammar is restored before live capture. Resume remains unresolved. All 19 timer/control tests pass; owner live Tomato countdown confirmation is requested and pending.

## 2026-10-05 — Approved recorded-voice diagnosis

Owner reports live Tomato still fails and explicitly approves a temporary local recording through Joy, then confirms readiness. A temporary authenticated Wi-Fi capture MOD provides a three-second countdown and three-second WAV capture, with one-time download and an in-memory expiry. Captured format is 16 kHz, mono, 16-bit PCM, 48,000 samples; peak 7,123, RMS 893.4, DC -0.3, no clipped samples. Activity falls around 1.12–1.88 seconds, inside the window. These checks establish basic format/level properties, not perceptual intelligibility.

Diagnostic-only engine options accept bounded recordedPCM and comparisonPCM buffers; buffers remain rooted while the worker owns them. A native privacy flag suppresses decoder text/raw strings for recorded tests. No recorded bytes are part of the host image. The approved recording and a bounded 2x gain copy are temporarily packaged in an excluded MOD archive for device replay.

Direct replay produces zero candidates in all four conditions: raw/US grammar, gain2/US grammar, raw/British grammar, gain2/British grammar. Pause, Cancel and reference controls still pass. Thus live queue timing and post-detection dispatch do not explain this sample's failure on their own; 2x gain and the tested vowel alternative do not solve it. No retraining is performed and no lower live confidence threshold is adopted. After one local playback, the owner confirms the recording is clear but quiet. This supports intelligible capture; it does not establish quietness as the sole cause or rule out other input-quality issues.

Host independently verifies all three images; recorded-test MOD verifies; normal diagnostic MOD is restored and verifies. Its 195,360-byte archive covers the prior 193,772-byte recorded archive range. Temporary WAV/PCM samples, amplified copy, capture credentials, and capture/replay source/build directories are deleted and absence checked. No user recording or transcript is committed. Only aggregate measurements and outcomes are retained.
