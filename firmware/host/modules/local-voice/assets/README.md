# Command recognition reference clip

`joy-reference-command.pcm` is the raw 16 kHz, mono, signed 16-bit little-endian “Tell me a joke” sample from Espressif ESP-SR’s MultiNet test. It is used only during diagnostic startup, never as a timer command.

Source: https://github.com/espressif/esp-sr/blob/76581015af7075681814627a5bb03d2f3f328f8a/test_apps/esp-sr-multinet/main/samples/tell_me_a_joke.h

Repository license: MIT (see `../LICENSE.models.txt`). Extracted byte SHA-256: `6277bddf1b8e5b44cf2c453b9763e013c2817f5011320d42128eb732d5ac4ac4`.

## Generated command probes

`joy-reference-pomodoro.pcm` and `joy-reference-pause.pcm` are local macOS Samantha speech probes, generated at 145 words/minute with `say`, converted with `afconvert` to 16 kHz mono signed 16-bit little-endian PCM, and prefixed with 0.5 seconds of silence. They test the registered command vocabulary directly without microphone input or real-time queue pressure. They are synthetic probes, not human recognition acceptance recordings. Diagnostic startup runs them after removing the temporary reference command, never dispatching their results to timer controls. Normal operation does not open these resources.

The same generation process also supplies `joy-reference-start-phrase.pcm` (Start a Pomodoro timer), `joy-reference-pause-phrase.pcm` (Pause the timer), and `joy-reference-control.pcm` (Tell me a joke). Temporary phrase aliases are used only during startup probes and removed before live listening. The same-voice control distinguishes generated audio compatibility from command-specific failure.

Additional probes: `joy-reference-resume.pcm` says “Please resume” to disambiguate the verb pronunciation; `joy-reference-cancel.pcm` says “Cancel”; `joy-reference-negative.pcm` says “Start a potato timer” and must produce no accepted command. They use the same Samantha generation/conversion and silence prefix. Diagnostic-only threshold calibration feeds the generated Pomodoro resource, never microphone recordings, and restores the live threshold before listening.
