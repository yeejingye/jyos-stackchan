# Repository context

## Purpose and baseline

Make StackChan a physical companion and interface for JYOS, with the Mac handling agent integration and heavier processing.

| Item | Current baseline |
| --- | --- |
| Hardware | Complete Kickstarter M5StackChan CoreS3; ESP32-S3 confirmed by flasher |
| Firmware | Community StackChan v1.1.0 source baseline; generated version `9.5.0+stackchan.1` |
| MOD | `firmware/mods/jyos_hello` |
| Observed behavior | Greeting, happy face, small head turns, and Motion done status |
| Host | Apple Silicon Mac; zsh; Moddable SDK 9.5.0 and ESP-IDF 6.1 |
| USB | Last verified `/dev/cu.usbmodem101`; rediscover if it changes |
| Planned operation | Wi-Fi connection; spoken research completion |

## Git workflow

- Fork: [yeejingye/jyos-stackchan](https://github.com/yeejingye/jyos-stackchan).
- `origin`: `git@github.com:yeejingye/jyos-stackchan.git`.
- `upstream`: `https://github.com/stack-chan/stack-chan.git`.
- Stable/default branch: `jyos-stackchan`.
- Feature branches: `codex/<feature-name>`; PR base is this fork's `jyos-stackchan`.
- Use focused PRs with release impact (`none`, `patch`, `minor`, `major`), validation evidence, and relevant limitations. Adopt upstream releases on a separately tested update branch.

## Development boundaries

Prefer MODs for behavior changes. Use repository npm wrappers from `firmware/`; do not directly invoke `mcconfig`/`mcrun`, override the managed output path, or edit generated `firmware/dist/` files. Keep the release dependency lock intact unless deliberately updating dependencies.

Commands and installation instructions: [developer guide](../firmware/mods/jyos_hello/README.md).

## External JYOS research configuration

Read-only references identified during planning:

- Claude subagent: `/Users/yeejingye/workspace/personal/jyos-system/.claude/agents/research-agent.md`.
- Full role: `/Users/yeejingye/workspace/personal/jyos-system/agents/research-agent/AGENT.md`.
- Output schema: `/Users/yeejingye/workspace/personal/jyos-system/schema/types/research-note.md`.
- Output destination: an agreed new note under `/Users/yeejingye/JYOS/Workbench/`.

These paths are local references, not files supplied by this repository. The research subagent produces a sourced working ResearchNote for human review; it does not directly publish to the Wiki. Robot notifications are planned outside that agent's restricted writing scope.
