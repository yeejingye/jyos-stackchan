# Research companion

A Claude Code `research-agent` run drives StackChan over Wi-Fi. It studies while the agent works, then tilts upward, briefly locates a face, announces “JY, your research note is ready for review,” returns to neutral and clears its card.

| Item | Current state |
| --- | --- |
| Implementation | Dedicated launcher, scoped interactive hooks, persistent service, modular flows, on-device completion |
| Tracking | [Issue #1](https://github.com/yeejingye/jyos-stackchan/issues/1) |
| Review | Stacked [PR #2](https://github.com/yeejingye/jyos-stackchan/pull/2) and [PR #3](https://github.com/yeejingye/jyos-stackchan/pull/3), unmerged |
| Release impact | Minor: opt-in host and MOD; normal firmware remains available |
| Verification | [Acceptance record](acceptance.md) separates automated results, device diagnostics and human observations |

Ready means a new, structurally validated research draft was saved. It does not mean human verification or Wiki publication. The current adapters support the public-source ResearchNote profile; private-context research needs an explicit policy before extending validation.

The Mac runs Claude and the status service. The robot performs completion face inference and plays a bundled sentence locally. USB is used for development and can provide power; runtime status travels over Wi-Fi. A powered robot and reachable, awake Mac are required.

[Developer commands](../../../firmware/mods/research_companion/README.md) · [Architecture](design.md) · [Flow lifecycle](flow-lifecycle.md) · [Development history](progress.md) · [Native experiment](on-device-experiment.md)
