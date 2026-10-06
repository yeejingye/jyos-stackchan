# Architecture and feature composition

## Choose the smallest appropriate layer

The host (`firmware/host/app/main.ts`) initializes the framework, preferences, hardware and UI. Hardware drivers belong behind motion/input/audio/camera capabilities. MODs in `firmware/mods/` provide user behavior through `onLaunch` and `onContextCreated`. Services handle connectivity, HTTP and persistence. UI components live in the host Piu modules. Change shared host code for a shared capability; keep a user-facing behavior in a MOD component.

Joy installs the combined `research_companion` MOD. Its component manifests include Pomodoro and desk modules. Installing a different MOD replaces that application. Compose features into the same MOD and retain the existing face/AppBar rather than assuming independent MODs run side by side.

## Lifecycle hooks replace default behavior

A custom `onContextCreated` can replace the host's default hookup. This caused the first missing-petting regression: the top panel existed, but the combined MOD did not recreate the happy reaction. Explicitly attach every behavior the application needs, including touch subscriptions, UI actions and cleanup. Never infer factory feature retention from hardware presence.

## Keep controllers testable

Inject elapsed time, delay, motion, busy/ownership state and presentation callbacks into behavior controllers. Keep pure state transitions separate from platform adapters. `desk_companion/controller.js` and `pomodoro/timer.js` are examples; their adapters translate state into Piu UI, expressions, sound and hardware calls. This enables meaningful timing/cancellation tests without claiming simulated motors reached a pose.

## Share ownership explicitly

One feature owns servo motion through cleanup. Desk work yields to Pomodoro (including pause), command listening/audio cues and research presentation/completion. Cancel and await neutral/torque cleanup before transferring ownership. Keep visual expression/effect ownership aligned so old asynchronous callbacks cannot overwrite a newer foreground face. Generation/revision guards make stale callbacks inert.

Research uses a registry and flow runner; persist completion admission before attempting attention/audio. At-most-once attempts can skip an interrupted notice. A status acknowledgement proves service acceptance, not physical execution. Keep those distinctions visible in logs and docs.

References: [runtime context](../../../firmware/host/app/runtime-context.ts), [combined MOD](../../../firmware/mods/research_companion/mod.js), [desk adapter](../../../firmware/mods/desk_companion/adapter.js), [flow lifecycle](../../../knowledge_base/feat/research-companion/flow-lifecycle.md).
