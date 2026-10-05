# Digital face

## Goal

Give Joy a more modern, expressive face while keeping the eyes, mouth, theme and motion system reusable across the normal interface and feature modules.

## Current implementation

`DigitalFace` is a selectable host face style and the default for large-screen UI configurations. Its generously sized rounded eyes use the existing gaze, blink and eyelid behavior; deep muted-teal outline frames (`#12656c`) and softer silver-teal irises (`#9cbac0`) keep the display restrained; the existing animated mouth continues to follow speech. During focus, the shared `DOUBTFUL` emotion gently narrows the eyes. It remains compatible with the standard face state, expressions, breath motion and skin updates. The iris override applies only to Digital, so other face styles retain their theme-driven eye color.

Digital is the default on large-screen host UIs. Select **Simple**, **Dog**, **Digital** or **Image** from the face choice in the drawer to change it at runtime. The face can also be selected as the UI type `digital` when composing a host UI. Compact devices configured with `small-face` keep their existing layout.

## Design direction

- Keep the character recognizable and warm, with a polished digital appearance.
- Let the face remain the main visual element; timer or status panels belong to separate UI layers.
- Use brief, low-key motion. Avoid continuous effects that distract from a focus timer.
- Keep color and expression responsive to the existing shared face state.

## Status

Initial reusable style and selector integration are implemented on `feat/modern-stackchan-face`. CoreS3 builds and verified installation are complete. Device visual review, focused expression tuning, larger timer typography, documentation of final measurements and release acceptance remain open.
