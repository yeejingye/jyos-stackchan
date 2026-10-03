# Feature: Research companion

| Field | Value |
| --- | --- |
| Lifecycle | In progress: Wi-Fi/status foundation implemented |
| Verification | 8 Node tests passed; MOD built/installed; authenticated Wi-Fi polling and Finding sources display observed; remaining screen/reconnect checks pending |
| Publication | Pushed: `b74fd3c7`; draft PR #2 |
| Branch | `codex/research-status` |
| PR / base | [#2](https://github.com/yeejingye/jyos-stackchan/pull/2) (draft, unmerged) / `jyos-stackchan` |
| Release impact | Expected minor; reassess final implementation |

Tracking issue: [#1](https://github.com/yeejingye/jyos-stackchan/issues/1). First increment usage: [research MOD guide](../../../firmware/mods/research_companion/README.md).

## Purpose

Represent a Claude Code research job physically: study while it runs, show meaningful progress, then find Jingye, look toward him, and announce that the note is ready for review.

## Agreed direction

- Research source: JYOS's Claude Code `research-agent` subagent.
- Normal connection: Wi-Fi; USB remains available for development/flashing.
- Completion: spoken through the robot, with expression and gesture.
- Face locating: bounded camera-assisted search, preferably processed on the Mac.
- Optional LLM reaction layer: contextual wording and approved gestures based on real events.

## Delivery increments

| Increment | Scope | Acceptance |
| --- | --- | --- |
| A | Wi-Fi commands and connection state | Commands acknowledged; disconnect/reconnect tested |
| B | Research events and studying behavior | Correct task progress; stale/duplicate events handled |
| C | Spoken completion | One announcement per successful research job |
| D | Face locating and attention gesture | Face tracking works in tested desk area; absence times out gracefully |
| E | Optional contextual reactions | Grounded wording; invalid reactions fall back predictably |

Increment A now has an authenticated polling service, task state machine, CLI, and visual MOD. Service replies acknowledge event acceptance, not robot rendering. Automatic Claude result validation, durable state/deduplication, speech, and vision are not implemented.

## Overall acceptance criteria

- [ ] Match events to one active research job and its output note.
- [ ] Show distinct researching, needs-input, ready, failure, and disconnected states.
- [ ] Announce readiness only after successful note save and agreed checks.
- [ ] Attempt face locating, then speak even if no face is found.
- [ ] Prevent repeated announcements after duplicate events or reconnects.
- [ ] Keep Claude research functional when robot/service is unavailable.
- [ ] Record software tests, hardware observations, limitations, and PR publication.

[Design](design.md) · [Progress](progress.md)
