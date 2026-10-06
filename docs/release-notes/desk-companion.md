# Desk companion

Release impact: minor.

Joy checkpoint: `stable/joy-desk-companion-2026-10-06` on `codex/desk-companion`. This tag preserves the deployed CoreS3 voice host and combined companion source; it is a personal checkpoint rather than an upstream firmware release.

Validation: 413 unit checks, 9 desk companion checks, 20 Pomodoro checks, 37 research/service checks, and native Piu drawer checks. The CoreS3 host's three flash images and the 205,588-byte companion MOD were verified after installation. Live telemetry confirmed the touch panel present, no foreground blocker, Berlin UTC+2, and approximately 0.112 seconds of clock difference from the Mac.

Physical continuous-petting feedback and a full 15-minute idle cycle remain pending observation. Other hardware targets were not tested. Private Wi-Fi/service credentials and generated firmware are excluded from the checkpoint. To reproduce the installed clock setup, set `config.time.timezone` to `berlin` in the private companion manifest (saved device preferences take precedence). Build with `npm run build:joy-voice`; install the host with `npm run flash:joy-voice -- --port <port>` and the combined MOD with `npm run mod -- mods/research_companion/manifest.local.json --port <port>`, from `firmware/`.

The optional companion MOD adds gentle look-around after 15 quiet minutes, Look around now, and independent pause/resume. Pomodoro and research have priority. Hardware acceptance pending.

The host drawer uses rounded controls and feature sections, with appearance/settings on a secondary page. Pomodoro exposes Start only while idle and Pause/Resume plus Cancel while active. Desk mode now holds a 35-degree upward tilt through four slower alternating turns.

The combined companion preserves top-panel petting: alternating strokes trigger a happy expression, hearts and a raised head shake. Petting remains available with automatic desk movement off and yields to foreground features.

Continuous back-and-forth strokes now emit direction changes without requiring finger release. A Touch & clock status control reports sensor readings, recognized gestures and foreground ownership. Berlin is available as a clock timezone with automatic daylight-saving adjustment, reevaluated after network time synchronization.

Configured network time synchronization now refreshes retained clocks on Wi-Fi connection, even when their existing date looks valid.
