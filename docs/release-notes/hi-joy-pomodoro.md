# Hi Joy Pomodoro — unreleased

Release impact: **minor** (opt-in firmware capability).

Adds an on-device Hi Joy command interface for a single 20-minute focus / 5-minute rest cycle, with pause, resume, cancel, manual drawer controls, microphone mute and a translucent countdown. Requires the optional Joy voice CoreS3 host. The existing standard host remains supported.

Research completion presentation and audio wait until Pomodoro ends or is cancelled. The latest eligible completion is retained in memory, deduplicated on admission, and lost on reboot. Pomodoro sessions also return directly to normal mode after reboot.

Automated timer tests and host/MOD build checks are separate from live microphone acceptance. Live voice accuracy, false activation, readability and full-duration timing verification remain required before release.
