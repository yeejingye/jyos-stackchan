# Desk companion

Implemented; hardware acceptance pending. Release impact: minor, optional companion MOD.

Enabled at boot. After 15 quiet minutes, Joy tilts upward 35 degrees while making four gentle alternating left/right turns (about 9 degrees, then 7 degrees), holding each for 2.5 seconds, returns to neutral and releases torque. The next interval begins after cleanup. No camera, speech or cloud dependency is introduced.

Drawer: **Look around** requests one sweep. **Auto look-around** switches automatic and manual movement on/off; switching off cancels the current sweep. Resume starts a fresh 15-minute interval. Pause is volatile across reboot and independent of Pomodoro pause.

Pomodoro (including paused sessions), research presentation/completion, voice cues and listening suppress movement. New service revisions, timer commands, voice cues and top touch-panel gestures reset inactivity. Unchanged service polls do not. Inactivity means observed software activity, not human absence; arbitrary screen touches are not tracked.

Research completion awaits cancellation cleanup. Pomodoro start during a sweep retries after cleanup and rechecks ownership. Small deliberate movements hold a 35-degree upward pitch and finish at neutral rather than restoring an unknown prior pose or torque state.

Run from firmware: `npm run test:desk`, `npm run test:pomodoro`, `npm run test:research`, `npm run mod:build -- mods/research_companion/manifest.json`.

Install the combined MOD using `npm run mod -- mods/research_companion/manifest.local.json --port /dev/cu.usbmodem101` when local config exists, otherwise manifest.json. Timer and desk mode work without a configured research service.

## Petting reaction

Alternating forward/backward strokes on the top touch panel within 1.5 seconds trigger a happy face, heart effect and gentle raised head shake, held for about five seconds before neutral return. Repeated petting extends the happy hold. This remains available with Auto look-around off, but yields to Pomodoro, voice activity and research. An interrupted sweep releases its motors before petting starts.

Stroke detection stays subscribed throughout look-around. A single swipe does not cancel the sweep; a recognized alternating pair immediately shows happy/heart feedback, ends the current hold and queues petting movement after neutral cleanup. Both features remain enabled, and petting restarts the 15-minute inactivity interval. Motor sequences never overlap.
