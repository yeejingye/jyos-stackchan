# Progress

2026-10-06: Created codex/desk-companion from feat/modern-stackchan-face, retaining current face implementation. Added independent component, combined MOD integration and feature controls. CoreS3 combined MOD built, installed on /dev/cu.usbmodem101 and flash digest verified. Desk tests 4/4, Pomodoro 19/19 and research 36/36 pass; Biome and diff whitespace checks pass. Physical observations and publication pending.

2026-10-06: Raised sweep pitch to 35 degrees upward on request. Added observable pose assertions for the requested 30–45 degree range and neutral cleanup.

2026-10-06: Modernized the shared drawer into grouped rounded cards with positive Auto look-around / Listening switches, timer-dependent actions and a secondary settings page. Extended sweep to four alternating turns with 2.5-second settling per turn. Desk 4/4 and Pomodoro 20/20 checks pass. Isolated native Piu simulator checks pass, including rendering, state retention on hidden pages and in-place countdown updates. CoreS3 voice-enabled host built successfully. Screenshot inspection unavailable while Mac is locked; physical appearance and movement observation remain pending.

Installation verified: updated CoreS3 voice host (all three images matched) and combined MOD (201,532 bytes, digest matched) on /dev/cu.usbmodem101. Final unit suite 410/410; desk 4/4; Pomodoro 20/20; Biome and whitespace checks pass. Work remains uncommitted on codex/desk-companion.

2026-10-06: Fixed the missing petting reaction in the combined MOD: its startup hook replaces the host default hook, so top-panel strokes previously only reset inactivity. Added alternating-swipe recognition and a shared-ownership happy/heart/head-shake reaction. Eight desk checks pass, including foreground interruption and sweep-to-petting handover.

Corrected MOD installed on CoreS3 and flash digest verified (203,400 bytes). Physical petting reaction confirmation remains pending.

2026-10-06: Improved coexistence: live stroke detection throughout automatic sweeps, immediate visual feedback on recognized petting, interruptible movement holds, and automatic sweep preserved after petting. Nine behavioral tests pass including the complete automatic-sweep → petting → next-idle-sweep lifecycle.

2026-10-06: Fixed the host recognizer ignoring stroke reversals while a finger remains touching the panel. Added continuous-stroke and jitter regression checks. Added Berlin timezone with independently validated IANA daylight-saving boundaries and post-sync reevaluation. Added on-device touch/clock diagnostics and authenticated device telemetry; corrected the private MOD's stale Mac address. Unit suite 413/413 passes; CoreS3 host installed with all three flash images verified. Physical stroke feedback still requires observation.

Live telemetry confirms touch hardware present, no foreground blocking, Berlin base offset plus summer adjustment, and about 138 seconds of retained UTC drift. Removed the plausible-date shortcut that prevented SNTP refresh on Wi-Fi connection, with regression coverage for an already-valid clock. Combined MOD installed and digest verified (205,588 bytes).

Clock-sync host installation verified against all three flash images. Fresh post-reboot telemetry confirms Berlin UTC+2, clock difference approximately 0.112 seconds from the Mac, touch present and no foreground blocker. Unit suite remains 413/413. Physical back-and-forth stroking confirmation is pending user observation.
