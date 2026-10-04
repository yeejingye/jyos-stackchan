# Feature index

| Feature | Lifecycle | Verification | Publication |
| --- | --- | --- | --- |
| [JYOS hello](jyos-hello/README.md) | Complete | Greeting and small movement observed | Pushed: `2751159e`; committed directly, no PR |
| [Research companion](research-companion/feature.md) | Complete | 405 unit / 36 companion / 79 architecture tests, six-target manifest checks, real launcher/hooks and user-confirmed hardware lifecycle | [PR #3](https://github.com/yeejingye/jyos-stackchan/pull/3) merged before [PR #2](https://github.com/yeejingye/jyos-stackchan/pull/2) into jyos-stackchan on 2026-10-04; `de40965e`; issue #1 closed |

## Proposed features

- [Voice-controlled Pomodoro](pomodoro/feature.md): current specification focus; 20-minute focus, 5-minute rest and voice pause/cancel.

- [Hi Joy voice activation](hi-joy-voice-activation/feature.md): MiniSRS discussion on `spec/hi-joy-voice-activation`; no implementation or verification yet.

## Feature record format

Use one folder per independently triggered user-facing module or flow. Shared helpers, drivers and platform capabilities remain components referenced by the features that use them; create a separate feature only when they have their own requirements and lifecycle. Feature IDs are stable lowercase folder names. Source-module paths may change without changing the feature ID.

Each feature folder contains:

- `feature.md`: canonical feature specification, requirements, behaviour, commands, dependencies and limits.
- `README.md`: short entry point, status and links.
- `design.md`: detailed architecture and decisions.
- `acceptance.md`: requirements mapped to revision-specific evidence and remaining gaps.
- `progress.md`: dated development and publication history.
- `exports/feature.html` and `exports/feature.docx`: generated views for browsing and sharing. Edit Markdown and regenerate; exports identify their source hash.

Optional investigations, experiments and diagrams belong beside these records. Keep historical evidence and label superseded checkpoints rather than deleting them. Workbench captures link to the canonical repository documentation. Do not copy source code, secrets or private research outputs into documentation exports.

Copy [_template](_template/README.md) for a new feature. Feature IDs use folder names such as `research-companion`.

Lifecycle: **Proposed → Planned → In progress → Ready for review → Complete**. Track **Blocked/Paused** when applicable. Verification and publication are separate: a complete feature may still await push, and a pushed branch may still await testing or merge.

Mark Complete when agreed acceptance criteria are satisfied or explicitly revised with reasons. Mark Merged only after confirming the PR was merged into the intended base branch. A device upload is not a Git push.

## Export a feature

Use the document runtime returned by Codex's workspace dependency loader. No repository dependency installation is needed. From the repository root:

```bash
<bundled-node> knowledge_base/tools/export-feature.mjs \
  knowledge_base/feat/<feature-id>/feature.md \
  --runtime-root <bundled-dependencies-root>
```

The command creates HTML and Word exports plus temporary render inputs under `exports/.build/`. HTML includes offline diagrams and print styling. Word embeds the same diagrams. The exporter supports the simple flowchart syntax in the template; it fails explicitly on unsupported diagram syntax. Run the documents skill's DOCX renderer and inspect every page before sharing a Word export. The exporter does not certify physical behaviour or factual correctness.

Commit specifications and supporting records with their code changes. Exports remain local, reproducible outputs and are ignored by Git. Regenerate them when sharing a feature or reviewing its presentation; never treat an old export as the current specification without comparing its source hash.
