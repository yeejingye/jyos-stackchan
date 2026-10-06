# Design

A separate component owns elapsed-time policy and an injected motion sequence. Its adapter supplies wrap-safe ticks, bounded hardware operations, timers and drawer controls. The research MOD supplies foreground ownership; Pomodoro reports commands and voice cues.

Cancellation invalidates future turns, retaining ownership through neutral return and torque release. Completion awaits cleanup; timer start retries after cleanup. Hardware timeout is two seconds per API call, with separate physical settling delays.

## Drawer controls

Shared drawer rows use rounded cards, muted teal accents and a wider 220-pixel panel. Feature groups lead the home view; ungrouped appearance/settings controls move into a secondary page. Switches show positive enabled states. Pomodoro actions follow its lifecycle and countdown labels update in place, preserving touch targets. Choice pages survive background timer updates.
