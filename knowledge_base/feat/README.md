# Feature index

| Feature | Lifecycle | Verification | Publication |
| --- | --- | --- | --- |
| [JYOS hello](jyos-hello/README.md) | Complete | Greeting and small movement observed | Pushed: `2751159e`; committed directly, no PR |
| [Research companion](research-companion/README.md) | In progress: Wi-Fi/status foundation | 8 Node tests, MOD build/flash, authenticated Wi-Fi poll, Finding sources screen; further checks pending | `codex/research-status`; [issue #1](https://github.com/yeejingye/jyos-stackchan/issues/1); [draft PR #2](https://github.com/yeejingye/jyos-stackchan/pull/2) |

## Feature record format

Each feature folder contains:

- `README.md`: purpose, scope, lifecycle, acceptance criteria, and Git/PR links.
- `design.md`: architecture, interfaces, behavior, and decisions.
- `progress.md`: dated milestones, verification evidence, blockers, and next action.

Copy [_template](_template/README.md) for a new feature. Feature IDs use folder names such as `research-companion`.

Lifecycle: **Proposed → Planned → In progress → Ready for review → Complete**. Track **Blocked/Paused** when applicable. Verification and publication are separate: a complete feature may still await push, and a pushed branch may still await testing or merge.

Mark Complete when agreed acceptance criteria are satisfied or explicitly revised with reasons. Mark Merged only after confirming the PR was merged into the intended base branch. A device upload is not a Git push.
