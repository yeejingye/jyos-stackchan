# Design discussion

No architecture is approved for implementation yet. Prefer a local detector behind a reusable activation interface and reuse existing audio/conversation capabilities.

## Decisions

- Agreed: activation phrase is “Hi Joy”.
- Agreed: define the MiniSRS before development.
- Proposed: reuse ESP-SR `wn9_hijoy_tts`; confirm compatible versions, model licence, resource usage and native integration first.
- Open: acknowledgement versus immediate spoken-request capture, mute/reboot policy, shared resource ownership and measurable recognition criteria.

The [MiniSRS](feature.md) is canonical. Record resolved trade-offs here as discussion progresses.

## Provider selection direction — 2026-10-04

Owner requested selectable OpenAI, Gemini, OpenRouter and LM Studio adapters, beginning with an inventory of built-in support. The MiniSRS now distinguishes native voice from composed STT/LLM/TTS pipelines. No default provider is approved; the earlier single-provider recommendation is superseded by this modular direction. Mac-mediated provider management remains proposed, not an approved deployment requirement.

## Current direction: Pomodoro

Owner deferred the general conversational provider plan in favour of wake-triggered Pomodoro commands. Preserve activation as a reusable capability and link the [Pomodoro MiniSRS](../pomodoro/feature.md). Previous provider discussion is historical and not an active implementation commitment.
