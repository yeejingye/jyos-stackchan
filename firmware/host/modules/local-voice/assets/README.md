# Command recognition reference clip

`joy-reference-command.pcm` is the raw 16 kHz, mono, signed 16-bit little-endian “Tell me a joke” sample from Espressif ESP-SR’s MultiNet test. It is used only during diagnostic startup, never as a timer command.

Source: https://github.com/espressif/esp-sr/blob/76581015af7075681814627a5bb03d2f3f328f8a/test_apps/esp-sr-multinet/main/samples/tell_me_a_joke.h

Repository license: MIT (see `../LICENSE.models.txt`). Extracted byte SHA-256: `6277bddf1b8e5b44cf2c453b9763e013c2817f5011320d42128eb732d5ac4ac4`.

## Generated command probes

`joy-reference-pomodoro.pcm` and `joy-reference-pause.pcm` are local macOS Samantha speech probes, generated at 145 words/minute with `say`, converted with `afconvert` to 16 kHz mono signed 16-bit little-endian PCM, and prefixed with 0.5 seconds of silence. They test the registered command vocabulary directly without microphone input or real-time queue pressure. They are synthetic probes, not human recognition acceptance recordings. Diagnostic startup uses a temporary reference command alongside the probes, removes that command before live listening, and never dispatches probe results to timer controls. Normal operation does not open these resources.

The same generation process also supplies `joy-reference-start-phrase.pcm` (Start a Pomodoro timer), `joy-reference-pause-phrase.pcm` (Pause the timer), and `joy-reference-control.pcm` (Tell me a joke). Temporary phrase aliases are used only during startup probes and removed before live listening. The same-voice control distinguishes generated audio compatibility from command-specific failure.

Additional probes: `joy-reference-resume.pcm` says “Please resume” to disambiguate the verb pronunciation; `joy-reference-cancel.pcm` says “Cancel”; `joy-reference-negative.pcm` says “Start a potato timer” and must produce no accepted command. They use the same Samantha generation/conversion and silence prefix. Diagnostic-only threshold calibration feeds the generated Pomodoro resource, never microphone recordings, and restores the live threshold before listening.

## Start Tomato Timer revision

`joy-reference-tomato.pcm` says “Start Tomato Timer”, generated with the same Samantha process above. It replaces the active Pomodoro startup probe. Historical Pomodoro assets remain as diagnostic evidence but are no longer bundled or run. The old threshold sweep is retired. Startup retains pause, control, resume, cancel and near-sounding potato negative probes; the start phrase stays in the live vocabulary after probes finish.

### Pronunciation comparison

`joy-reference-tomato-uk.pcm` is a Daniel (British English) 145 words/minute macOS speech probe, generated with say and afconvert, 16 kHz mono signed 16-bit little-endian PCM with 0.5 seconds of leading silence. Diagnostics compare Samantha and Daniel recordings against the official-tool US pronunciation and an alternate tomato vowel using the same Espressif phoneme alphabet (`TcMdTb` versus `TcMnTb`). The alternate grammar is removed and the US grammar restored before live capture. A potato negative probe also runs against the alternate grammar. This tests a pronunciation hypothesis without recording the owner or dispatching timer commands.

## Isolated Tomato command trial

Current diagnostics use `joy-reference-tomato-word.pcm` (Samantha saying Tomato), `joy-reference-tomato-word-uk.pcm` (Daniel saying Tomato), and `joy-reference-potato-word.pcm` (Samantha saying Potato). All use the same 145 words/minute generation, afconvert 16 kHz mono signed 16-bit conversion, and 0.5-second silence prefix. They replace the longer-phrase resources in the bundled diagnostics; historical clips remain in the repository. The active start word is now tomato (`TcMdTb`); diagnostic-only alternate pronunciation is `TcMnTb`. Neither generated probe dispatches a timer event.
