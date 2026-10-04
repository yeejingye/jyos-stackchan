# Feature index

| Feature | Lifecycle | Verification | Publication |
| --- | --- | --- | --- |
| [JYOS hello](jyos-hello/README.md) | Complete | Greeting and small movement observed | Pushed: `2751159e`; committed directly, no PR |
| [Research companion](research-companion/README.md) | Ready for review; acceptance complete | 405 unit / 36 companion / 79 architecture tests, six-target manifest checks, real launcher/hooks and user-confirmed hardware lifecycle | Pushed on `codex/on-device-completion`; [issue #1](https://github.com/yeejingye/jyos-stackchan/issues/1); stacked [PR #3](https://github.com/yeejingye/jyos-stackchan/pull/3) → [PR #2](https://github.com/yeejingye/jyos-stackchan/pull/2), unmerged |

## Feature record format

Each feature folder contains:

- `README.md`: purpose, scope, lifecycle, acceptance criteria, and Git/PR links.
- `design.md`: architecture, interfaces, behavior, and decisions.
- `progress.md`: dated milestones, verification evidence, blockers, and next action.

Copy [_template](_template/README.md) for a new feature. Feature IDs use folder names such as `research-companion`.

Lifecycle: **Proposed → Planned → In progress → Ready for review → Complete**. Track **Blocked/Paused** when applicable. Verification and publication are separate: a complete feature may still await push, and a pushed branch may still await testing or merge.

Mark Complete when agreed acceptance criteria are satisfied or explicitly revised with reasons. Mark Merged only after confirming the PR was merged into the intended base branch. A device upload is not a Git push.
