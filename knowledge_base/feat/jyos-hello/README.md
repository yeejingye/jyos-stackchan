# Feature: JYOS hello

| Field | Value |
| --- | --- |
| Lifecycle | Complete |
| Verification | Build/flash verified; greeting and movement observed |
| Publication | Pushed in `2751159e` |
| Branch | `jyos-stackchan` |
| PR | None; initial baseline committed directly |
| Release impact | Minor for the optional MOD; host unchanged |

## Purpose and scope

Demonstrate custom JYOS behavior on the complete CoreS3 robot without changing the host firmware: greeting, expression, three small turns, and visible completion/error status.

## Acceptance criteria

- [x] Display Hello JYOS and a happy face.
- [x] Execute small yaw movements and return forward.
- [x] Show Motion done after successful commands.
- [x] Build and verify the installed MOD archive.
- [x] Commit and push code and developer documentation.

Error display and torque-release paths are implemented but were not fault-injected or independently measured.

[Design](design.md) · [Progress](progress.md) · [Code](../../../firmware/mods/jyos_hello/mod.js)
