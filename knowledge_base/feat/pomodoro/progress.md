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
