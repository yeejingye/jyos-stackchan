# Progress: Research companion

| Date | Stage | Milestone | Evidence |
| --- | --- | --- | --- |
| 2026-10-03 | Proposed | Research-status companion and face-directed completion discussed | User requested planning only |
| 2026-10-03 | Planned | Claude Code, Wi-Fi, spoken completion selected | User preferences |
| 2026-10-03 | Investigated | Research agent located in `jyos-system/.claude/agents` | Read agent configuration, full role, ResearchNote schema |
| 2026-10-03 | Design | External adapter preferred; saved note gates completion | Agent tool/write boundaries and human-review workflow |
| 2026-10-03 | Tracked | GitHub issue created; Issues enabled on fork | [Issue #1](https://github.com/yeejingye/jyos-stackchan/issues/1) |
| 2026-10-03 | Implemented | Mac HTTP service, manual CLI, shared protocol, research MOD | Branch `codex/research-status`; private config ignored |
| 2026-10-03 | Tested | Protocol, service, and CLI tests passed | `npm run test:research`: 8 tests; Biome checks passed |
| 2026-10-03 | Device | MOD built, installed, digest verified; robot reached Mac over Wi-Fi | Service logged authenticated robot poll; visual transition confirmation pending |

## Verification and publication

Increment A is implemented and has the evidence above. No Claude configuration changes, speech, motor gestures, or face tracking were made. Synthetic gathering/comparing events were sent; these are not actual research results. Service stop/restart, screen behavior, and real Claude completion semantics remain unverified.

Commands: `npm run test:research`, `npm exec -- biome check mods/research_companion tools/research-companion`, `npm run mod:build -- mods/research_companion/manifest.json`, and configured MOD installation through `npm run mod`. See [usage guide](../../../firmware/mods/research_companion/README.md).

## Next action

Confirm visual state transitions and disconnect/reconnect on hardware. Then design increment B's research-specific event adapter and saved-note checks. Increment C must verify speech playback before claiming spoken completion. Tracking issue remains open across these increments.
