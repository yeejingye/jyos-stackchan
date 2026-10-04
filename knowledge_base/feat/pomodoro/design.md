# Design discussion

Owner chose a bounded Pomodoro interaction instead of developing a general voice/LLM pipeline now. Reuse shared activation and flow lifecycle capabilities; keep the timer independent of recognition.

Candidate design: on-device wake/command recognition and elapsed-time timer, compact translucent status strip, fixed audio cues. Recognition availability and shared resource coexistence are unverified. No implementation architecture approved yet.

Owner confirmed one cycle then finish, and Hi Joy resume with a visible paused countdown. Transition cues and resource-priority behaviour remain open before implementation planning. The [MiniSRS](feature.md) is canonical.

Owner requested research speech deferral until Pomodoro ends. Record the proposed full-session quiet period (focus, rest and pause); Cancellation also ends the quiet period: first return to normal mode, then release waiting research speech. Multiple-completion and stale-notice policy remain open before implementation.

Owner confirmed gentle chimes at focus/rest completion and preservation of an existing session when Pomodoro is said again. Repeated Pomodoro while paused must not implicitly resume. Chime sound/volume and failure recovery remain specification details.

Owner confirmed reboot returns directly to normal mode without restoring Pomodoro. Deferred research notice recovery must remain separate from timer reset and completion replay protection.

## Implementation baseline

Owner authorised proceeding with the readiness plan. Defaults and recognition targets are recorded in the MiniSRS; latest-only deferred speech is admitted while fresh, retained through the session, and remains silent after reboot. Voice engine feasibility is the first implementation gate.
