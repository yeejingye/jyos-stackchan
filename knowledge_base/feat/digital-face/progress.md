# Digital face progress

## 2026-10-05 — First implementation

Created branch `feat/modern-stackchan-face` from the timer and voice feature branch. Added `DigitalFace`, a reusable selectable host face composed from existing animated eyes and a speech-synced mouth plus a cyan rounded eye-frame primitive. The shared `DOUBTFUL` focus emotion gently narrows the eyelids. Large-screen host configurations default to Digital; compact `small-face` configurations retain their existing face. Simple, Dog and Image remain selectable, with labels in English, Simplified Chinese and Japanese.

The standard CoreS3 build and voice-enabled CoreS3 build both complete. The voice-enabled host was flashed with all three images independently verified; the configured local Research Companion MOD was restored and its archive digest matched. Startup logs show Wi-Fi connected, WakeNet and MultiNet loaded, the listener started and app behaviors ready. The owner still needs to assess the rendered face on the physical display. Eye spacing, focus expression, typography/panel composition and timer coexistence remain visual tuning work. This does not claim timer completion or voice accuracy.

## 2026-10-05 — Softer accent

Reduced the Digital face frame accent from bright cyan to a softer teal while preserving the eye color and expression. The voice-enabled CoreS3 host rebuilt and all three flashed images matched. The configured companion MOD remained installed; Joy restarted, reconnected to Wi-Fi, loaded WakeNet/MultiNet and reached app behaviors ready.

## 2026-10-05 — Further brightness reduction

Reduced the Digital-only frame accent to deep teal (`#12656c`) and set its irises to muted silver-teal (`#9cbac0`). The reusable eye component accepts an optional iris color; existing faces continue using the shared theme palette. This change is limited to Digital and keeps its gaze, blink, eyelid and focus expression behavior. The voice-enabled CoreS3 build completed; all three firmware images matched during flash verification, and the board responded to the watchdog reset on USB.
