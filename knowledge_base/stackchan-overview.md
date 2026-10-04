# Joy — JYOS StackChan overview

Updated 2026-10-04 · Canonical overview source. The HTML is a reading view; detailed feature specifications own behavioural requirements.

## Identity and executive summary

Joy is the chosen companion name for JYOS StackChan: a physical desktop interface to the owner's knowledge and agent system. Hardware is the Kickstarter complete M5StackChan CoreS3. The repository is yeejingye/jyos-stackchan, forked from stack-chan/stack-chan; delivered research baseline is de40965e.

Joy currently makes Claude research activity visible and announces completion. The Mac runs research and a Wi-Fi status service; the robot handles expressions, local face detection, bounded movement and fixed completion audio. Pomodoro is the next specification, not an implemented feature.

## Hardware basics

ESP32-S3, 16 MB flash, 8 MB PSRAM, 320×240 touchscreen, camera, dual microphones, speaker, two-axis servo mechanism, RGB LEDs, three-zone top touch panel, microSD, Wi-Fi/BLE and a 550 mAh battery. Factory hardware inventory is not a claim that all interfaces are supported/tested by our current firmware.

## Factory / out-of-box firmware

These belong to the original M5Stack firmware, replaced in our development deployment. They are not automatically retained by our custom MOD.

- **AI Agent:** Wake phrase “Hi, StackChan”, spoken question answering, configurable model, voice, personality and memory.
- **Expressive companion:** Animated expressions, idle movement, touch and shake reactions.
- **App interaction:** Video viewing, remote avatar control and camera/servo control; factory guide says avatar voice calls are not yet available.
- **Control and updates:** ESP-NOW remote control, dance routines, online app downloads and OTA updates.

Factory AI Agent does not establish that an LLM runs inside the robot. Backend entitlement, cost and reuse from custom firmware remain unverified.

## Available community firmware capabilities

- **Audio:** Microphone recording/playback; OpenAI Realtime and Gemini Live conversation workers; remote Whisper STT and several TTS adapters.
- **Offline Japanese voice:** stackchan-voice synthesises Japanese on CoreS3. Our English research sentence is a bundled recording, not general English TTS.
- **Hardware interfaces:** Face/display, bounded servo motion, camera, touch, LEDs and networking. Available APIs do not mean every hardware feature has been validated in our deployment.

## Added together

- **[Research companion](feat/research-companion/feature.md) — Delivered · merged:** Claude research progress drives thoughtful, gathering, comparing and drafting expressions, with a compact translucent status strip. Completion triggers a 45° upward tilt, bounded on-device face search, a fixed spoken cue, neutral return and automatic clearing.
- **[JYOS greeting](feat/jyos-hello/README.md) — Earlier demonstration:** Displayed “Hello JYOS” and exercised small head movements through the jyos_hello MOD. This is an earlier demonstration, not a separate mode currently running beside research.
- **[Reusable flow framework](feat/research-companion/flow-lifecycle.md) — Delivered foundation:** Shared flow registration, lifecycle ownership, completion guards and cleanup support additional modules. The existing timer example is display-only, not a running Pomodoro scheduler.

## Planned and deferred

- **[Voice-controlled Pomodoro](feat/pomodoro/feature.md) — Specification draft:** “Hi Joy” then “Pomodoro”: 20 minutes focus, 5 minutes rest, then finish. Voice pause/resume/cancel; unobtrusive countdown; gentle phase chimes. Research speech waits until finish or cancellation. Reboot returns to normal mode.
- **[Hi Joy activation](feat/hi-joy-voice-activation/feature.md) — Planned · untested:** Reusable wake-word and bounded-command capability. Espressif lists a Hi Joy model, but integration and recognition have not been validated on this robot.
- **[Conversation and Inbox capture](feat/hi-joy-voice-activation/feature.md) — Deferred:** Selectable cloud/local model adapters, research debrief, spoken reflection and requested Workbench Inbox capture remain future proposals. No general conversational service is active in the research MOD.

## Operating boundaries

The research feature requires power, Wi-Fi and an awake, reachable Mac; USB is needed for deployment/diagnostics rather than routine status communication. Local camera inference locates faces, not identities; camera images remain on the robot. Its fixed clip does not establish an active general conversational LLM. Face alignment is bounded and condition-dependent. Status transport uses bearer-authenticated unencrypted HTTP on a trusted LAN. Saved-note validation checks structure/provenance, not factual correctness.

## Sources

- [M5Stack product and factory guide](https://docs.m5stack.com/en/StackChan), inspected 2026-10-04.
- [Current architecture](architecture.md), [feature index](feat/README.md), [research specification](feat/research-companion/feature.md), [acceptance evidence](feat/research-companion/acceptance.md).
- [Offline speech guide](../firmware/docs/stackchan-voice.md), [conversation API](../firmware/host/modules/conversation/chat.ts).
- [Pomodoro MiniSRS](feat/pomodoro/feature.md), owner decisions recorded 2026-10-04.
